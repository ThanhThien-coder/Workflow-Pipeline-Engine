package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.dto.request.template.CreateTemplateRequest;
import com.pipeline.wpe.dto.response.template.DagValidationResponse;
import com.pipeline.wpe.dto.response.template.TemplateDetailResponse;
import com.pipeline.wpe.dto.response.template.TemplateSummaryResponse;
import com.pipeline.wpe.entity.PipelineTemplateEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.CycleDetectedException;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.PipelineTemplateRepository;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.engine.KahnDagService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Unit Tests for PipelineTemplateService")
class PipelineTemplateServiceTest {

    @Mock
    private PipelineTemplateRepository templateRepository;

    @Mock
    private UserRepository userRepository;

    @Spy
    private KahnDagService kahnDagService = new KahnDagService();

    @InjectMocks
    private PipelineTemplateService templateService;

    private Map<String, Object> validGraphData;
    private UserEntity adminUser;

    @BeforeEach
    void setUp() {
        validGraphData = Map.of(
            "phases", List.of(Map.of("id", "p1", "name", "Phase 1")),
            "phaseEdges", List.of(),
            "nodes", List.of(Map.of("id", "n1", "phaseId", "p1", "title", "Task 1")),
            "edges", List.of()
        );
        adminUser = UserEntity.builder()
            .id(1L)
            .username("admin")
            .systemRole(SystemRole.ADMIN)
            .build();
    }

    @Test
    @DisplayName("10.3.1 getTemplates: Lọc danh mục templates theo category và search")
    void testGetTemplatesFilter() {
        PipelineTemplateEntity t1 = PipelineTemplateEntity.builder().id(1L).name("Agile SDLC").category("Software Engineering").isSystemStandard(true).graphData(validGraphData).build();
        PipelineTemplateEntity t2 = PipelineTemplateEntity.builder().id(2L).name("Content Strategy").category("Marketing").isSystemStandard(false).graphData(validGraphData).build();

        when(templateRepository.findAll()).thenReturn(List.of(t1, t2));

        List<TemplateSummaryResponse> list = templateService.getTemplates("Software Engineering", null, null);
        assertEquals(1, list.size());
        assertEquals("Agile SDLC", list.get(0).name());
    }

    @Test
    @DisplayName("10.3.2 getTemplateById: Lấy chi tiết template thành công")
    void testGetTemplateById() {
        PipelineTemplateEntity t = PipelineTemplateEntity.builder().id(1L).name("Agile SDLC").category("Software Engineering").graphData(validGraphData).build();
        when(templateRepository.findById(1L)).thenReturn(Optional.of(t));

        TemplateDetailResponse detail = templateService.getTemplateById(1L);
        assertNotNull(detail);
        assertEquals("1", detail.id());
        assertNotNull(detail.graphData());
    }

    @Test
    @DisplayName("10.3.3 createTemplate: Tạo template thành công khi đồ thị hợp lệ")
    void testCreateTemplateSuccess() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(adminUser));

        CreateTemplateRequest req = new CreateTemplateRequest("New Template", "Desc", "General", false, validGraphData);
        PipelineTemplateEntity saved = PipelineTemplateEntity.builder().id(99L).name("New Template").category("General").graphData(validGraphData).build();

        when(templateRepository.save(any(PipelineTemplateEntity.class))).thenReturn(saved);

        TemplateDetailResponse response = templateService.createTemplate(req, 1L);
        assertNotNull(response);
        assertEquals("99", response.id());
        verify(templateRepository).save(any(PipelineTemplateEntity.class));
    }

    @Test
    @DisplayName("10.3.3 createTemplate: Ném CycleDetectedException khi đồ thị có chu trình lặp")
    void testCreateTemplateCycleDetected() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(adminUser));

        Map<String, Object> cycleGraphData = Map.of(
            "phases", List.of(
                Map.of("id", "p1", "name", "P1"),
                Map.of("id", "p2", "name", "P2")
            ),
            "phaseEdges", List.of(
                Map.of("parentPhaseId", "p1", "childPhaseId", "p2"),
                Map.of("parentPhaseId", "p2", "childPhaseId", "p1")
            ),
            "nodes", List.of()
        );

        CreateTemplateRequest req = new CreateTemplateRequest("Cycle Template", "Desc", "General", false, cycleGraphData);

        assertThrows(CycleDetectedException.class, () -> templateService.createTemplate(req, 1L));
        verify(templateRepository, never()).save(any());
    }

    @Test
    @DisplayName("10.3.4 validateGraph: Dry Run thẩm định đồ thị thành công")
    void testValidateGraphDryRun() {
        DagValidationResponse response = templateService.validateGraph(validGraphData);
        assertTrue(response.valid());
        assertTrue(response.violations().isEmpty());
    }

    @Test
    @DisplayName("createTemplate: User thường gọi createTemplate -> ném ForbiddenException ACCESS_DENIED")
    void testCreateTemplateForbiddenForRegularUser() {
        UserEntity regularUser = UserEntity.builder().id(2L).username("user").systemRole(SystemRole.USER).build();
        when(userRepository.findById(2L)).thenReturn(Optional.of(regularUser));

        CreateTemplateRequest req = new CreateTemplateRequest("New Template", "Desc", "General", false, validGraphData);

        ForbiddenException ex = assertThrows(ForbiddenException.class, () -> templateService.createTemplate(req, 2L));
        assertEquals("ACCESS_DENIED", ex.getErrorCode());
        verify(templateRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateTemplate: User thường gọi updateTemplate -> ném ForbiddenException, không save")
    void testUpdateTemplateForbiddenForRegularUser() {
        UserEntity regularUser = UserEntity.builder().id(2L).username("user").systemRole(SystemRole.USER).build();
        when(userRepository.findById(2L)).thenReturn(Optional.of(regularUser));

        CreateTemplateRequest req = new CreateTemplateRequest("Updated Template", "Desc", "General", false, validGraphData);

        ForbiddenException ex = assertThrows(ForbiddenException.class, () -> templateService.updateTemplate(1L, req, 2L));
        assertEquals("ACCESS_DENIED", ex.getErrorCode());
        verify(templateRepository, never()).save(any());
    }

    @Test
    @DisplayName("deleteTemplate: User thường gọi deleteTemplate -> ném ForbiddenException, không delete")
    void testDeleteTemplateForbiddenForRegularUser() {
        UserEntity regularUser = UserEntity.builder().id(2L).username("user").systemRole(SystemRole.USER).build();
        when(userRepository.findById(2L)).thenReturn(Optional.of(regularUser));

        ForbiddenException ex = assertThrows(ForbiddenException.class, () -> templateService.deleteTemplate(1L, 2L));
        assertEquals("ACCESS_DENIED", ex.getErrorCode());
        verify(templateRepository, never()).delete(any());
    }

    @Test
    @DisplayName("createTemplate: currentUserId = null gọi createTemplate -> ném ForbiddenException")
    void testCreateTemplateForbiddenWhenUserIdNull() {
        CreateTemplateRequest req = new CreateTemplateRequest("New Template", "Desc", "General", false, validGraphData);

        ForbiddenException ex = assertThrows(ForbiddenException.class, () -> templateService.createTemplate(req, null));
        assertEquals("ACCESS_DENIED", ex.getErrorCode());
        verify(templateRepository, never()).save(any());
        verify(userRepository, never()).findById(any());
    }

    @Test
    @DisplayName("deleteTemplate: Admin xóa template hệ thống isSystemStandard(true) -> ném ConflictException SYSTEM_TEMPLATE_LOCKED")
    void testDeleteSystemTemplateThrowsConflict() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(adminUser));

        PipelineTemplateEntity systemTemplate = PipelineTemplateEntity.builder()
            .id(1L)
            .name("System Template")
            .isSystemStandard(true)
            .build();
        when(templateRepository.findById(1L)).thenReturn(Optional.of(systemTemplate));

        ConflictException ex = assertThrows(ConflictException.class, () -> templateService.deleteTemplate(1L, 1L));
        assertEquals("SYSTEM_TEMPLATE_LOCKED", ex.getErrorCode());
        verify(templateRepository, never()).delete(any());
    }

    @Test
    @DisplayName("deleteTemplate: Admin xóa template thường isSystemStandard(false) -> gọi delete")
    void testDeleteRegularTemplateSuccess() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(adminUser));

        PipelineTemplateEntity regularTemplate = PipelineTemplateEntity.builder()
            .id(1L)
            .name("Custom Template")
            .isSystemStandard(false)
            .build();
        when(templateRepository.findById(1L)).thenReturn(Optional.of(regularTemplate));

        templateService.deleteTemplate(1L, 1L);
        verify(templateRepository).delete(regularTemplate);
    }

    @Test
    @DisplayName("createTemplate: Admin tạo template -> createdBy của entity được lưu bằng đúng id admin")
    void testCreateTemplateCreatedByMatchesAdminId() {
        Long adminId = 99L;
        UserEntity customAdmin = UserEntity.builder().id(adminId).username("admin99").systemRole(SystemRole.ADMIN).build();
        when(userRepository.findById(adminId)).thenReturn(Optional.of(customAdmin));

        CreateTemplateRequest req = new CreateTemplateRequest("Admin Template", "Desc", "General", false, validGraphData);
        PipelineTemplateEntity saved = PipelineTemplateEntity.builder().id(100L).name("Admin Template").createdBy(adminId).build();
        when(templateRepository.save(any(PipelineTemplateEntity.class))).thenReturn(saved);

        templateService.createTemplate(req, adminId);

        ArgumentCaptor<PipelineTemplateEntity> captor = ArgumentCaptor.forClass(PipelineTemplateEntity.class);
        verify(templateRepository).save(captor.capture());
        assertEquals(adminId, captor.getValue().getCreatedBy());
    }
}

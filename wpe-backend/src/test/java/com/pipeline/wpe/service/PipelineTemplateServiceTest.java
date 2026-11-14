package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.JoinPolicy;
import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.common.enums.TemplateVisibility;
import com.pipeline.wpe.dto.request.template.CreateTemplateRequest;
import com.pipeline.wpe.dto.request.template.SaveProjectAsTemplateRequest;
import com.pipeline.wpe.dto.response.template.DagValidationResponse;
import com.pipeline.wpe.dto.response.template.TemplateDetailResponse;
import com.pipeline.wpe.dto.response.template.TemplateSummaryResponse;
import com.pipeline.wpe.entity.*;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.CycleDetectedException;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.*;
import com.pipeline.wpe.service.admin.AdminAuditService;
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

import java.util.*;

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

    @Mock
    private ProjectAuthorizationService projectAuthorizationService;

    @Mock
    private WorkPhaseRepository workPhaseRepository;

    @Mock
    private NodeRepository nodeRepository;

    @Mock
    private NodeDependencyRepository nodeDependencyRepository;

    @Mock
    private PhaseDependencyRepository phaseDependencyRepository;

    @Mock
    private AdminAuditService adminAuditService;

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
        PipelineTemplateEntity t1 = PipelineTemplateEntity.builder().id(1L).name("Agile SDLC").category("Software Engineering").isSystemStandard(true).visibility(TemplateVisibility.PUBLIC).graphData(validGraphData).build();
        PipelineTemplateEntity t2 = PipelineTemplateEntity.builder().id(2L).name("Content Strategy").category("Marketing").isSystemStandard(false).visibility(TemplateVisibility.PUBLIC).graphData(validGraphData).build();

        when(templateRepository.findAll()).thenReturn(List.of(t1, t2));

        List<TemplateSummaryResponse> list = templateService.getTemplates("Software Engineering", null, null);
        assertEquals(1, list.size());
        assertEquals("Agile SDLC", list.get(0).name());
    }

    @Test
    @DisplayName("getTemplates: Không trả template PRIVATE của người khác nhưng có của chính mình")
    void testGetTemplatesFilterPrivate() {
        Long myUserId = 2L;
        Long otherUserId = 3L;

        PipelineTemplateEntity tPublic = PipelineTemplateEntity.builder()
            .id(1L)
            .name("Public Template")
            .visibility(TemplateVisibility.PUBLIC)
            .createdBy(1L)
            .graphData(validGraphData)
            .build();

        PipelineTemplateEntity tMyPrivate = PipelineTemplateEntity.builder()
            .id(2L)
            .name("My Private Template")
            .visibility(TemplateVisibility.PRIVATE)
            .createdBy(myUserId)
            .graphData(validGraphData)
            .build();

        PipelineTemplateEntity tOtherPrivate = PipelineTemplateEntity.builder()
            .id(3L)
            .name("Other Private Template")
            .visibility(TemplateVisibility.PRIVATE)
            .createdBy(otherUserId)
            .graphData(validGraphData)
            .build();

        when(templateRepository.findAll()).thenReturn(List.of(tPublic, tMyPrivate, tOtherPrivate));

        List<TemplateSummaryResponse> list = templateService.getTemplates(null, null, null, myUserId);
        assertEquals(2, list.size());
        List<String> names = list.stream().map(TemplateSummaryResponse::name).toList();
        assertTrue(names.contains("Public Template"));
        assertTrue(names.contains("My Private Template"));
        assertFalse(names.contains("Other Private Template"));
    }

    @Test
    @DisplayName("10.3.2 getTemplateById: Lấy chi tiết template thành công")
    void testGetTemplateById() {
        PipelineTemplateEntity t = PipelineTemplateEntity.builder().id(1L).name("Agile SDLC").category("Software Engineering").visibility(TemplateVisibility.PUBLIC).graphData(validGraphData).build();
        when(templateRepository.findById(1L)).thenReturn(Optional.of(t));

        TemplateDetailResponse detail = templateService.getTemplateById(1L);
        assertNotNull(detail);
        assertEquals("1", detail.id());
        assertNotNull(detail.graphData());
    }

    @Test
    @DisplayName("getTemplateByIdOrSlug: Get PRIVATE của người khác -> ném ResourceNotFoundException")
    void testGetTemplateByIdOrSlugOtherPrivateThrowsNotFound() {
        Long myUserId = 2L;
        Long otherUserId = 3L;

        PipelineTemplateEntity tOtherPrivate = PipelineTemplateEntity.builder()
            .id(10L)
            .name("Secret Template")
            .visibility(TemplateVisibility.PRIVATE)
            .createdBy(otherUserId)
            .graphData(validGraphData)
            .build();

        when(templateRepository.findById(10L)).thenReturn(Optional.of(tOtherPrivate));

        assertThrows(ResourceNotFoundException.class, () ->
            templateService.getTemplateByIdOrSlug("10", myUserId)
        );
    }

    @Test
    @DisplayName("10.3.3 createTemplate: Tạo template thành công khi đồ thị hợp lệ")
    void testCreateTemplateSuccess() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(adminUser));

        CreateTemplateRequest req = new CreateTemplateRequest("New Template", "Desc", "General", false, validGraphData);
        PipelineTemplateEntity saved = PipelineTemplateEntity.builder().id(99L).name("New Template").category("General").visibility(TemplateVisibility.PUBLIC).graphData(validGraphData).build();

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
    @DisplayName("updateTemplate: User thường gọi updateTemplate với template PUBLIC -> ném ForbiddenException, không save")
    void testUpdateTemplateForbiddenForRegularUser() {
        UserEntity regularUser = UserEntity.builder().id(2L).username("user").systemRole(SystemRole.USER).build();
        when(userRepository.findById(2L)).thenReturn(Optional.of(regularUser));

        PipelineTemplateEntity publicTemplate = PipelineTemplateEntity.builder()
            .id(1L)
            .name("Public Template")
            .visibility(TemplateVisibility.PUBLIC)
            .createdBy(99L)
            .build();
        when(templateRepository.findById(1L)).thenReturn(Optional.of(publicTemplate));

        CreateTemplateRequest req = new CreateTemplateRequest("Updated Template", "Desc", "General", false, validGraphData);

        ForbiddenException ex = assertThrows(ForbiddenException.class, () -> templateService.updateTemplate(1L, req, 2L));
        assertEquals("ACCESS_DENIED", ex.getErrorCode());
        verify(templateRepository, never()).save(any());
    }

    @Test
    @DisplayName("deleteTemplate: User thường xóa template PUBLIC -> ném ForbiddenException, không delete")
    void testDeleteTemplateForbiddenForRegularUser() {
        UserEntity regularUser = UserEntity.builder().id(2L).username("user").systemRole(SystemRole.USER).build();
        when(userRepository.findById(2L)).thenReturn(Optional.of(regularUser));

        PipelineTemplateEntity publicTemplate = PipelineTemplateEntity.builder()
            .id(1L)
            .name("Public Template")
            .visibility(TemplateVisibility.PUBLIC)
            .createdBy(99L)
            .build();
        when(templateRepository.findById(1L)).thenReturn(Optional.of(publicTemplate));

        ForbiddenException ex = assertThrows(ForbiddenException.class, () -> templateService.deleteTemplate(1L, 2L));
        assertEquals("ACCESS_DENIED", ex.getErrorCode());
        verify(templateRepository, never()).delete(any());
    }

    @Test
    @DisplayName("deleteTemplate: User xóa template PRIVATE của mình -> delete được gọi")
    void testDeleteOwnPrivateTemplateSuccess() {
        Long myUserId = 2L;
        UserEntity regularUser = UserEntity.builder().id(myUserId).username("user").systemRole(SystemRole.USER).build();
        when(userRepository.findById(myUserId)).thenReturn(Optional.of(regularUser));

        PipelineTemplateEntity myPrivate = PipelineTemplateEntity.builder()
            .id(5L)
            .name("My Template")
            .visibility(TemplateVisibility.PRIVATE)
            .createdBy(myUserId)
            .isSystemStandard(false)
            .build();

        when(templateRepository.findById(5L)).thenReturn(Optional.of(myPrivate));

        templateService.deleteTemplate(5L, myUserId);
        verify(templateRepository).delete(myPrivate);
    }

    @Test
    @DisplayName("deleteTemplate: User khác xóa template PRIVATE của người khác -> ném ResourceNotFoundException")
    void testDeleteOtherUsersPrivateTemplateThrowsNotFound() {
        Long myUserId = 2L;
        Long otherUserId = 3L;
        UserEntity regularUser = UserEntity.builder().id(myUserId).username("user2").systemRole(SystemRole.USER).build();
        when(userRepository.findById(myUserId)).thenReturn(Optional.of(regularUser));

        PipelineTemplateEntity otherPrivate = PipelineTemplateEntity.builder()
            .id(6L)
            .name("Other Template")
            .visibility(TemplateVisibility.PRIVATE)
            .createdBy(otherUserId)
            .isSystemStandard(false)
            .build();

        when(templateRepository.findById(6L)).thenReturn(Optional.of(otherPrivate));

        assertThrows(ResourceNotFoundException.class, () ->
            templateService.deleteTemplate(6L, myUserId)
        );
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
    @DisplayName("deleteTemplate: Admin xóa template hệ thống isSystemStandard(true) -> gọi delete và record TEMPLATE_DELETED")
    void testDeleteSystemTemplate_asAdmin_success() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(adminUser));

        PipelineTemplateEntity systemTemplate = PipelineTemplateEntity.builder()
            .id(1L)
            .name("System Template")
            .isSystemStandard(true)
            .build();
        when(templateRepository.findById(1L)).thenReturn(Optional.of(systemTemplate));

        templateService.deleteTemplate(1L, 1L);

        verify(templateRepository).delete(systemTemplate);
        verify(adminAuditService).record(eq(1L), isNull(), eq("TEMPLATE_DELETED"), eq("TEMPLATE"), eq("1"), eq("System Template"));
    }

    @Test
    @DisplayName("deleteTemplate: User thường xóa template hệ thống isSystemStandard(true) -> ném ForbiddenException")
    void testDeleteSystemTemplate_asRegularUser_throwsForbidden() {
        UserEntity regularUser = UserEntity.builder()
            .id(2L)
            .username("regular.user")
            .systemRole(SystemRole.USER)
            .build();
        when(userRepository.findById(2L)).thenReturn(Optional.of(regularUser));

        PipelineTemplateEntity systemTemplate = PipelineTemplateEntity.builder()
            .id(1L)
            .name("System Template")
            .isSystemStandard(true)
            .visibility(TemplateVisibility.PUBLIC)
            .build();
        when(templateRepository.findById(1L)).thenReturn(Optional.of(systemTemplate));

        ForbiddenException ex = assertThrows(ForbiddenException.class, () -> templateService.deleteTemplate(1L, 2L));
        assertEquals("ACCESS_DENIED", ex.getErrorCode());
        verify(templateRepository, never()).delete(any());
        verify(adminAuditService, never()).record(any(), any(), any(), any(), any(), any());
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
        PipelineTemplateEntity saved = PipelineTemplateEntity.builder().id(100L).name("Admin Template").createdBy(adminId).visibility(TemplateVisibility.PUBLIC).build();
        when(templateRepository.save(any(PipelineTemplateEntity.class))).thenReturn(saved);

        templateService.createTemplate(req, adminId);

        ArgumentCaptor<PipelineTemplateEntity> captor = ArgumentCaptor.forClass(PipelineTemplateEntity.class);
        verify(templateRepository).save(captor.capture());
        assertEquals(adminId, captor.getValue().getCreatedBy());
        assertEquals(TemplateVisibility.PUBLIC, captor.getValue().getVisibility());
    }

    @Test
    @DisplayName("createTemplate: Admin tạo template thành công -> gọi adminAuditService.record với TEMPLATE_CREATED và TEMPLATE")
    void testCreateTemplateRecordsAuditLog() {
        Long adminId = 1L;
        when(userRepository.findById(adminId)).thenReturn(Optional.of(adminUser));

        CreateTemplateRequest req = new CreateTemplateRequest("New Pipeline Template", "Desc", "General", false, validGraphData);
        PipelineTemplateEntity saved = PipelineTemplateEntity.builder()
            .id(888L)
            .name("New Pipeline Template")
            .createdBy(adminId)
            .visibility(TemplateVisibility.PUBLIC)
            .build();
        when(templateRepository.save(any(PipelineTemplateEntity.class))).thenReturn(saved);

        templateService.createTemplate(req, adminId);

        verify(adminAuditService).record(eq(adminId), isNull(), eq("TEMPLATE_CREATED"), eq("TEMPLATE"), eq("888"), eq("New Pipeline Template"));
    }

    @Test
    @DisplayName("saveProjectAsTemplate: Lưu dự án 2 phase, 3 node, 2 cạnh thành template PRIVATE thành công")
    @SuppressWarnings("unchecked")
    void testSaveProjectAsTemplateSuccess() {
        Long projectId = 100L;
        Long currentUserId = 2L;

        WorkPhaseEntity p1 = WorkPhaseEntity.builder().id(10L).projectId(projectId).name("Phase 1").orderIndex(0).parentPhaseId(null).build();
        WorkPhaseEntity p2 = WorkPhaseEntity.builder().id(20L).projectId(projectId).name("Phase 2").orderIndex(1).parentPhaseId(10L).build();

        PhaseDependencyEntity pd = PhaseDependencyEntity.builder().id(1L).projectId(projectId).parentPhaseId(10L).childPhaseId(20L).build();

        NodeEntity n1 = NodeEntity.builder().id(101L).projectId(projectId).code("WPE-001").phaseId(10L).title("Node 1").description("Desc 1").status(NodeStatus.TODO).assignedUserId(5L).joinPolicy(JoinPolicy.ALL_COMPLETED).estimatedHours(4).build();
        NodeEntity n2 = NodeEntity.builder().id(102L).projectId(projectId).code("WPE-002").phaseId(20L).title("Node 2").description("Desc 2").status(NodeStatus.LOCKED).assignedUserId(6L).joinPolicy(JoinPolicy.ALL_COMPLETED).estimatedHours(6).build();
        NodeEntity n3 = NodeEntity.builder().id(103L).projectId(projectId).code("WPE-003").phaseId(20L).title("Node 3").description("Desc 3").status(NodeStatus.LOCKED).assignedUserId(null).joinPolicy(JoinPolicy.ALL_COMPLETED).estimatedHours(8).build();

        NodeDependencyEntity d1 = NodeDependencyEntity.builder().id(1L).projectId(projectId).parentNodeId(101L).childNodeId(102L).build();
        NodeDependencyEntity d2 = NodeDependencyEntity.builder().id(2L).projectId(projectId).parentNodeId(102L).childNodeId(103L).build();

        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(projectId)).thenReturn(List.of(p1, p2));
        when(phaseDependencyRepository.findByProjectId(projectId)).thenReturn(List.of(pd));
        when(nodeRepository.findByProjectId(projectId)).thenReturn(List.of(n1, n2, n3));
        when(nodeDependencyRepository.findByProjectId(projectId)).thenReturn(List.of(d1, d2));

        PipelineTemplateEntity savedEntity = PipelineTemplateEntity.builder()
            .id(777L)
            .name("My Exported Template")
            .category("General")
            .visibility(TemplateVisibility.PRIVATE)
            .sourceProjectId(projectId)
            .createdBy(currentUserId)
            .build();
        when(templateRepository.save(any(PipelineTemplateEntity.class))).thenReturn(savedEntity);

        SaveProjectAsTemplateRequest req = new SaveProjectAsTemplateRequest("My Exported Template", "Exported desc", "General");
        TemplateDetailResponse response = templateService.saveProjectAsTemplate(projectId, req, currentUserId);

        assertNotNull(response);
        assertEquals("777", response.id());
        verify(projectAuthorizationService).verifyProjectOwner(projectId, currentUserId);

        ArgumentCaptor<PipelineTemplateEntity> captor = ArgumentCaptor.forClass(PipelineTemplateEntity.class);
        verify(templateRepository).save(captor.capture());
        PipelineTemplateEntity entity = captor.getValue();

        assertEquals(TemplateVisibility.PRIVATE, entity.getVisibility());
        assertEquals(projectId, entity.getSourceProjectId());
        assertFalse(entity.getIsSystemStandard());
        assertEquals(currentUserId, entity.getCreatedBy());

        Map<String, Object> graphData = entity.getGraphData();
        assertNotNull(graphData);
        assertEquals(2, graphData.get("schemaVersion"));

        List<Map<String, Object>> phases = (List<Map<String, Object>>) graphData.get("phases");
        assertEquals(2, phases.size());

        List<Map<String, Object>> phaseEdges = (List<Map<String, Object>>) graphData.get("phaseEdges");
        assertEquals(1, phaseEdges.size(), "PhaseEdges phải được bỏ trùng giữa parentPhaseId và phase_dependency");
        assertEquals("ph-10", phaseEdges.get(0).get("parentPhaseId"));
        assertEquals("ph-20", phaseEdges.get(0).get("childPhaseId"));

        List<Map<String, Object>> nodes = (List<Map<String, Object>>) graphData.get("nodes");
        assertEquals(3, nodes.size());
        for (Map<String, Object> nodeMap : nodes) {
            assertFalse(nodeMap.containsKey("status"), "Không được chép status");
            assertFalse(nodeMap.containsKey("assignedUserId"), "Không được chép assignedUserId");
            assertFalse(nodeMap.containsKey("dueDate"), "Không được chép dueDate");
            assertFalse(nodeMap.containsKey("startedAt"), "Không được chép startedAt");
        }

        List<Map<String, Object>> edges = (List<Map<String, Object>>) graphData.get("edges");
        assertEquals(2, edges.size());
    }

    @Test
    @DisplayName("saveProjectAsTemplate: Người không phải owner -> ném ForbiddenException, không save")
    void testSaveProjectAsTemplateNotOwnerThrowsForbidden() {
        Long projectId = 100L;
        Long userId = 9L;
        doThrow(new ForbiddenException("ACCESS_DENIED", "Chỉ Chủ dự án mới có quyền"))
            .when(projectAuthorizationService).verifyProjectOwner(projectId, userId);

        SaveProjectAsTemplateRequest req = new SaveProjectAsTemplateRequest("My Template", "Desc", "General");

        assertThrows(ForbiddenException.class, () ->
            templateService.saveProjectAsTemplate(projectId, req, userId)
        );
        verify(templateRepository, never()).save(any());
    }

    @Test
    @DisplayName("getTemplates: Lọc visibility PUBLIC chỉ trả template PUBLIC, null trả cả PUBLIC và PRIVATE của caller")
    void testGetTemplatesFilterVisibility() {
        Long meoUserId = 5L;

        PipelineTemplateEntity tPublic = PipelineTemplateEntity.builder()
            .id(1L)
            .name("Public SDLC")
            .visibility(TemplateVisibility.PUBLIC)
            .createdBy(1L)
            .graphData(validGraphData)
            .build();

        PipelineTemplateEntity tMeoPrivate = PipelineTemplateEntity.builder()
            .id(2L)
            .name("Meo Private Template")
            .visibility(TemplateVisibility.PRIVATE)
            .createdBy(meoUserId)
            .graphData(validGraphData)
            .build();

        when(templateRepository.findAll()).thenReturn(List.of(tPublic, tMeoPrivate));

        // Lọc PUBLIC: chỉ có tPublic
        List<TemplateSummaryResponse> publicOnly = templateService.getTemplates(null, null, null, meoUserId, "PUBLIC");
        assertEquals(1, publicOnly.size());
        assertEquals("Public SDLC", publicOnly.get(0).name());

        // visibility = null: có cả hai (hành vi cũ)
        List<TemplateSummaryResponse> both = templateService.getTemplates(null, null, null, meoUserId, null);
        assertEquals(2, both.size());
        List<String> names = both.stream().map(TemplateSummaryResponse::name).toList();
        assertTrue(names.contains("Public SDLC"));
        assertTrue(names.contains("Meo Private Template"));
    }

    @Test
    @DisplayName("getTemplates: visibility không hợp lệ ('abc') -> ném IllegalArgumentException")
    void testGetTemplatesInvalidVisibilityThrowsException() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
            templateService.getTemplates(null, null, null, 5L, "abc")
        );
        assertEquals("visibility chỉ nhận PUBLIC hoặc PRIVATE", ex.getMessage());
        verify(templateRepository, never()).findAll();
    }

    @Test
    @DisplayName("updateTemplateBySlugOrId: Admin cập nhật bằng slug 'tpl-sdlc' thành công, user thường bị 403 Forbidden")
    void testUpdateTemplateBySlugOrIdAdminAndUser() {
        Long adminId = 1L;
        Long regularUserId = 2L;

        UserEntity admin = UserEntity.builder().id(adminId).username("admin").systemRole(SystemRole.ADMIN).build();
        UserEntity regularUser = UserEntity.builder().id(regularUserId).username("meo").systemRole(SystemRole.USER).build();

        when(userRepository.findById(adminId)).thenReturn(Optional.of(admin));
        when(userRepository.findById(regularUserId)).thenReturn(Optional.of(regularUser));

        PipelineTemplateEntity original = PipelineTemplateEntity.builder()
            .id(10L)
            .slug("tpl-sdlc")
            .name("Old SDLC Name")
            .category("Software Engineering")
            .visibility(TemplateVisibility.PUBLIC)
            .isSystemStandard(true)
            .graphData(validGraphData)
            .build();

        when(templateRepository.findBySlug("tpl-sdlc")).thenReturn(Optional.of(original));
        when(templateRepository.findById(10L)).thenReturn(Optional.of(original));

        CreateTemplateRequest validReq = new CreateTemplateRequest(
            "New SDLC Name",
            "Updated Description",
            "Software Engineering",
            true,
            validGraphData
        );

        PipelineTemplateEntity savedEntity = PipelineTemplateEntity.builder()
            .id(10L)
            .slug("tpl-sdlc")
            .name("New SDLC Name")
            .category("Software Engineering")
            .visibility(TemplateVisibility.PUBLIC)
            .isSystemStandard(true)
            .graphData(validGraphData)
            .build();
        when(templateRepository.save(any(PipelineTemplateEntity.class))).thenReturn(savedEntity);

        // 1. Admin gọi thành công, trả về tên mới
        TemplateDetailResponse response = templateService.updateTemplateBySlugOrId("tpl-sdlc", validReq, adminId);
        assertNotNull(response);
        assertEquals("New SDLC Name", response.name());
        verify(templateRepository).save(any(PipelineTemplateEntity.class));

        // 2. User thường gọi -> ForbiddenException
        ForbiddenException ex = assertThrows(ForbiddenException.class, () ->
            templateService.updateTemplateBySlugOrId("tpl-sdlc", validReq, regularUserId)
        );
        assertEquals("ACCESS_DENIED", ex.getErrorCode());
    }
}

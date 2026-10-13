package com.pipeline.wpe.mapper;

import com.pipeline.wpe.dto.response.node.KanbanTaskResponse;
import com.pipeline.wpe.entity.NodeEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface NodeMapper {

    @Mapping(target = "id", expression = "java(String.valueOf(entity.getId()))")
    @Mapping(target = "phaseId", expression = "java(entity.getPhaseId() != null ? String.valueOf(entity.getPhaseId()) : null)")
    @Mapping(target = "assignedUserId", expression = "java(entity.getAssignedUserId() != null ? String.valueOf(entity.getAssignedUserId()) : null)")
    @Mapping(target = "status", expression = "java(entity.getStatus().name())")
    @Mapping(target = "joinPolicy", expression = "java(entity.getJoinPolicy().name())")
    KanbanTaskResponse toKanbanTaskResponse(NodeEntity entity);
}

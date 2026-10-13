package com.pipeline.wpe.mapper;

import com.pipeline.wpe.dto.response.auth.AuthResponse;
import com.pipeline.wpe.entity.UserEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface UserMapper {

    @Mapping(target = "id", expression = "java(String.valueOf(entity.getId()))")
    @Mapping(target = "name", source = "fullName")
    @Mapping(target = "role", expression = "java(entity.getSystemRole().name())")
    @Mapping(target = "avatarUrl", ignore = true)
    AuthResponse.UserSummary toUserSummary(UserEntity entity);
}

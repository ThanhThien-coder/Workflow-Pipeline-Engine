package com.pipeline.wpe.dto.response.admin;

public record AdminWorkspaceOwnerResponse(
    String ownerId,
    String ownerName,
    String ownerMaskedEmail
) {
}

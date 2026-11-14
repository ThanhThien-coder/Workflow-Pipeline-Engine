package com.pipeline.wpe.repository;

import com.pipeline.wpe.entity.AdminAuditLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLogEntity, Long>, JpaSpecificationExecutor<AdminAuditLogEntity> {
}

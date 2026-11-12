package com.pipeline.wpe.service.event;

import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Transaction manager rỗng cho unit test: không có DB, nhưng chạy đúng quy trình commit/rollback thật của Spring
 * (gọi beforeCommit, afterCommit, afterCompletion của các TransactionSynchronization theo đúng thứ tự và đúng
 * cách Spring lấy danh sách). Tự gọi afterCommit() bằng tay thì không bắt được lỗi thứ tự này.
 */
public class NoOpTransactionManager extends AbstractPlatformTransactionManager {

    /** TransactionTemplate dùng transaction manager rỗng. Chạy code trong execute() = chạy trong @Transactional. */
    public static TransactionTemplate template() {
        return new TransactionTemplate(new NoOpTransactionManager());
    }

    @Override
    protected Object doGetTransaction() {
        return new Object();
    }

    @Override
    protected void doBegin(Object transaction, TransactionDefinition definition) {
        // Không có tài nguyên thật để mở.
    }

    @Override
    protected void doCommit(DefaultTransactionStatus status) {
        // Không có tài nguyên thật để commit.
    }

    @Override
    protected void doRollback(DefaultTransactionStatus status) {
        // Không có tài nguyên thật để rollback.
    }
}

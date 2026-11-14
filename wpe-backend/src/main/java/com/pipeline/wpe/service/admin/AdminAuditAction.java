package com.pipeline.wpe.service.admin;

import java.util.List;

public final class AdminAuditAction {

    private AdminAuditAction() {
    }

    public static final String LOGIN_SUCCESS = "LOGIN_SUCCESS";
    public static final String LOGIN_FAILED = "LOGIN_FAILED";
    public static final String LOGOUT = "LOGOUT";
    public static final String REGISTER = "REGISTER";
    public static final String ACCOUNT_LOCKED_LOGIN = "ACCOUNT_LOCKED_LOGIN";

    public static final String USER_SUSPENDED = "USER_SUSPENDED";
    public static final String USER_UNBANNED = "USER_UNBANNED";
    public static final String ADMIN_ACCESS_DENIED = "ADMIN_ACCESS_DENIED";
    public static final String USER_ROLE_CHANGED = "USER_ROLE_CHANGED";
    public static final String USER_DELETED = "USER_DELETED";
    public static final String PROJECT_OWNER_TRANSFERRED = "PROJECT_OWNER_TRANSFERRED";
    public static final String WORKSPACE_ARCHIVED = "WORKSPACE_ARCHIVED";

    public static final String TEMPLATE_CREATED = "TEMPLATE_CREATED";
    public static final String TEMPLATE_UPDATED = "TEMPLATE_UPDATED";
    public static final String TEMPLATE_DELETED = "TEMPLATE_DELETED";
    public static final String TEMPLATE_HIDDEN = "TEMPLATE_HIDDEN";
    public static final String TEMPLATE_SHOWN = "TEMPLATE_SHOWN";

    public static final List<String> LOGIN_ACTIONS = List.of(
        LOGIN_SUCCESS,
        LOGIN_FAILED,
        LOGOUT,
        REGISTER,
        ACCOUNT_LOCKED_LOGIN
    );

    public static final List<String> ADMIN_ACTIONS = List.of(
        USER_SUSPENDED,
        USER_UNBANNED,
        ADMIN_ACCESS_DENIED,
        USER_ROLE_CHANGED,
        USER_DELETED,
        PROJECT_OWNER_TRANSFERRED,
        WORKSPACE_ARCHIVED
    );

    public static final List<String> TEMPLATE_ACTIONS = List.of(
        TEMPLATE_CREATED,
        TEMPLATE_UPDATED,
        TEMPLATE_DELETED,
        TEMPLATE_HIDDEN,
        TEMPLATE_SHOWN
    );

    public static List<String> actionsOfGroup(String group) {
        if (group == null || group.isBlank()) {
            throw new IllegalArgumentException("Nhóm audit không hợp lệ: " + group);
        }
        String normalized = group.trim().toUpperCase();
        return switch (normalized) {
            case "LOGIN" -> LOGIN_ACTIONS;
            case "ADMIN" -> ADMIN_ACTIONS;
            case "TEMPLATE" -> TEMPLATE_ACTIONS;
            default -> throw new IllegalArgumentException("Nhóm audit không hợp lệ: " + group);
        };
    }
}

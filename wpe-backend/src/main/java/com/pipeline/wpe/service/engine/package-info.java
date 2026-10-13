/**
 * Động Cơ Điều Phối Workflow & Thuật Toán Đồ Thị (Workflow Engine Subsystem):
 * - DagEngineService: Cài đặt thuật toán Kahn kiểm tra chu trình đồ thị (Cycle Detection).
 * - StateMachineService: Quản lý FSM 5 trạng thái và cơ chế tự mở khóa downstream tasks (AND/OR join).
 */
package com.pipeline.wpe.service.engine;

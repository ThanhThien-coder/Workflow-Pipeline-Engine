/**
 * A2 — Một chỗ duy nhất đọc VITE_USE_MOCK.
 * Mặc định là mock: chỉ khi đặt đúng VITE_USE_MOCK=false mới gọi backend thật.
 * container.ts, App.tsx và DevToolbar.tsx đều dùng biến này, không tự đọc import.meta.env nữa.
 */
export const isMockMode: boolean = import.meta.env.VITE_USE_MOCK !== 'false'

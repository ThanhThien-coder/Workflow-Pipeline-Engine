import uvicorn
from app.config import settings

if __name__ == "__main__":
    print(f"🚀 Đang khởi động WPE AI Microservice tại http://{settings.HOST}:{settings.PORT}")
    print(f"🔑 Trạng thái Google Gemini API Key: {'ĐÃ CẤU HÌNH' if settings.has_gemini_key else 'CHƯA CẤU HÌNH (Đang dùng Heuristic fallback)'}")
    print(f"🔒 Khóa nội bộ (X-Internal-Key): {'ĐANG BẬT' if settings.AI_INTERNAL_KEY else 'CHƯA BẬT (Dev mode)'}")
    print(f"🔄 Auto-reload: {'BẬT' if settings.APP_RELOAD else 'TẮT'}")
    print(f"📖 Tài liệu API Swagger UI: http://localhost:{settings.PORT}/docs")
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.APP_RELOAD)

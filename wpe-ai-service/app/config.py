import os
from pathlib import Path
from dotenv import load_dotenv

# Tự động nạp file .env nếu có (không ghi đè biến môi trường đã đặt sẵn ở shell)
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path, override=False)


def _parse_bool(value: str, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


class Settings:
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8081"))
    APP_RELOAD: bool = _parse_bool(os.getenv("APP_RELOAD", "false"), default=False)

    # Khóa nội bộ xác thực request từ Backend Java (để trống = không bật kiểm tra ở dev)
    AI_INTERNAL_KEY: str = os.getenv("AI_INTERNAL_KEY", "").strip()

    # Google Gemini API
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "").strip()
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()
    # Timeout gọi Gemini tính theo ms (mặc định 15s, thấp hơn mức read-timeout 30s của backend Java)
    GEMINI_TIMEOUT_MS: int = int(os.getenv("GEMINI_TIMEOUT_MS", "15000"))
    # Giới hạn thinking tokens cho dòng Gemini 2.5 để tránh cắt JSON output
    GEMINI_THINKING_BUDGET: int = int(os.getenv("GEMINI_THINKING_BUDGET", "256"))

    # Giới hạn kích thước request body (mặc định 1 MB)
    MAX_REQUEST_BODY_BYTES: int = int(os.getenv("MAX_REQUEST_BODY_BYTES", str(1024 * 1024)))

    # Cấu hình tính toán mặc định
    DEFAULT_NODE_HOURS: int = 8
    STALL_MULTIPLIER: float = 2.5

    @property
    def has_gemini_key(self) -> bool:
        return bool(self.GEMINI_API_KEY and self.GEMINI_API_KEY != "your_gemini_api_key_here")


settings = Settings()

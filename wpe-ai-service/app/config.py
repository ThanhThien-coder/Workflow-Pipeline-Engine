import os
from pathlib import Path
from typing import List

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
    # Model chính (gemini-2.5-flash không còn mở cho key mới, Google trả 404)
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip()
    # Model dự phòng, cách nhau dấu phẩy: gọi lần lượt khi model trước lỗi (503 quá tải, 504, 429, 404,
    # quá giờ, JSON hỏng). Để trống = chỉ dùng model chính. Hết model mới chuyển sang luật dự phòng.
    GEMINI_FALLBACK_MODEL: str = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-3.1-flash-lite").strip()
    # Thời gian tối đa cho mỗi model đứng trước model cuối (ms). Model cuối được dùng hết thời gian còn lại.
    GEMINI_TIMEOUT_MS: int = int(os.getenv("GEMINI_TIMEOUT_MS", "12000"))
    # Tổng thời gian cho cả chuỗi model (ms), phải thấp hơn read-timeout 30 giây của backend Java
    GEMINI_TOTAL_TIMEOUT_MS: int = int(os.getenv("GEMINI_TOTAL_TIMEOUT_MS", "25000"))
    # Dòng Gemini 2.5: giới hạn số token thinking để tránh cắt JSON output
    GEMINI_THINKING_BUDGET: int = int(os.getenv("GEMINI_THINKING_BUDGET", "256"))
    # Dòng Gemini 3 trở đi: mức thinking (MINIMAL | LOW | MEDIUM | HIGH). Khi model quá tải,
    # thinking_level báo lỗi 503 ngay (~2 giây) còn thinking_budget treo tới hết giờ.
    GEMINI_THINKING_LEVEL: str = os.getenv("GEMINI_THINKING_LEVEL", "LOW").strip().upper()

    # Giới hạn kích thước request body (mặc định 1 MB)
    MAX_REQUEST_BODY_BYTES: int = int(os.getenv("MAX_REQUEST_BODY_BYTES", str(1024 * 1024)))

    # Cấu hình tính toán mặc định
    DEFAULT_NODE_HOURS: int = 8
    STALL_MULTIPLIER: float = 2.5

    @property
    def has_gemini_key(self) -> bool:
        return bool(self.GEMINI_API_KEY and self.GEMINI_API_KEY != "your_gemini_api_key_here")

    @property
    def gemini_models(self) -> List[str]:
        """Chuỗi model theo thứ tự gọi: model chính rồi các model dự phòng (bỏ trùng, bỏ rỗng)."""
        models: List[str] = []
        for name in [self.GEMINI_MODEL] + self.GEMINI_FALLBACK_MODEL.split(","):
            cleaned = name.strip()
            if cleaned and cleaned not in models:
                models.append(cleaned)
        return models


settings = Settings()

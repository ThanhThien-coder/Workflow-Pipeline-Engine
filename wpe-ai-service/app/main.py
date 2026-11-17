import hmac
import logging
from typing import Optional

import uvicorn
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import settings
from app.schemas.request import AiDiagnosisRequest
from app.schemas.response import AiDiagnosisResponse
from app.schemas.scaffold import ScaffoldRequest, ScaffoldResponse
from app.services.diagnosis_service import diagnosis_service
from app.services.scaffold_service import scaffold_service

# Thiết lập logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("wpe_ai")

app = FastAPI(
    title="Workflow Pipeline Engine — AI Microservice",
    description="Dịch vụ AI nội bộ: Tính toán CPM, Phân tích Pháp y Dự án & Cố vấn Kỹ thuật",
    version="1.1.0",
)


class MaxBodySizeMiddleware:
    """Pure ASGI middleware giới hạn kích thước HTTP body (mặc định 1 MB) không làm nghẽn stream (P13)."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        max_bytes = settings.MAX_REQUEST_BODY_BYTES
        for key, value in scope.get("headers", []):
            if key.lower() == b"content-length":
                try:
                    if int(value.decode("latin-1")) > max_bytes:
                        response = JSONResponse(status_code=413, content={"detail": "Request payload too large"})
                        await response(scope, receive, send)
                        return
                except ValueError:
                    response = JSONResponse(status_code=400, content={"detail": "Invalid Content-Length header"})
                    await response(scope, receive, send)
                    return

        received_bytes = 0
        too_large = False

        async def limited_receive() -> Message:
            nonlocal received_bytes, too_large
            message = await receive()
            if message["type"] == "http.request":
                received_bytes += len(message.get("body", b""))
                if received_bytes > max_bytes:
                    too_large = True
                    raise _PayloadTooLargeError()
            return message

        try:
            await self.app(scope, limited_receive, send)
        except _PayloadTooLargeError:
            if too_large:
                response = JSONResponse(status_code=413, content={"detail": "Request payload too large"})
                await response(scope, receive, send)


class _PayloadTooLargeError(Exception):
    pass


app.add_middleware(MaxBodySizeMiddleware)


def verify_internal_key(
    x_internal_key: Optional[str] = Header(default=None, alias="X-Internal-Key"),
) -> None:
    """
    Xác thực khóa nội bộ X-Internal-Key từ Spring Boot Backend (P13 & Contract mục 8).
    - Nếu AI_INTERNAL_KEY được cấu hình: từ chối (401) mọi request thiếu hoặc sai khóa.
    - Nếu AI_INTERNAL_KEY để trống (môi trường dev cục bộ): cho phép gọi không cần header.
    """
    expected_key = settings.AI_INTERNAL_KEY
    if not expected_key:
        return
    if not x_internal_key or not hmac.compare_digest(x_internal_key.strip(), expected_key):
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/")
def index():
    return {
        "service": "Workflow Pipeline Engine — AI Intelligence Service",
        "version": "1.1.0",
        "status": "RUNNING",
        "geminiConfigured": settings.has_gemini_key,
        "internalKeyEnabled": bool(settings.AI_INTERNAL_KEY),
        "contractDocs": "/docs",
    }


@app.get("/health")
def health_check():
    return {
        "status": "UP",
        "geminiConfigured": settings.has_gemini_key,
        "model": settings.GEMINI_MODEL,
    }


@app.get("/ready")
def readiness_check():
    return {
        "status": "READY",
        "geminiConfigured": settings.has_gemini_key,
        "internalKeyEnabled": bool(settings.AI_INTERNAL_KEY),
        "model": settings.GEMINI_MODEL,
    }


@app.post(
    "/api/ai/diagnose",
    response_model=AiDiagnosisResponse,
    dependencies=[Depends(verify_internal_key)],
)
def trigger_ai_diagnostics(request: AiDiagnosisRequest):
    """
    ENDPOINT CỐT LÕI (SSOT Contract):
    Nhận dữ liệu dự án từ Spring Boot Backend (Java), thực hiện:
    - TẦNG 1: Tính toán đường găng CPM, bắt Stalled/Overdue nodes, đo Velocity & Drift Score (< 10ms, 0 Token).
    - TẦNG 2: Google Gemini AI (Structured Output JSON) phân tích ngữ nghĩa 3 bài toán & lọc kiểm đầu ra.
    - Phản hồi đúng hợp đồng JSON cho Spring Boot lưu vào cột JSONB latest_ai_analysis.
    """
    try:
        logger.info(
            "Nhận yêu cầu chẩn đoán dự án ID: %s, tên: '%s' với %d nodes",
            request.projectId,
            request.projectName,
            len(request.nodes),
        )
        return diagnosis_service.process_diagnosis(request)
    except HTTPException:
        raise
    except Exception as ex:
        logger.error("Lỗi trong quá trình chẩn đoán AI: %s", ex, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal AI service error")


@app.post(
    "/api/ai/scaffold-dag",
    response_model=ScaffoldResponse,
    dependencies=[Depends(verify_internal_key)],
)
def scaffold_dag(request: ScaffoldRequest):
    """
    TÍNH NĂNG 1: Prompt-to-DAG (Khởi tạo đồ thị quy trình từ yêu cầu dự án).
    Chuyển đổi văn bản tự do thành cấu trúc Phases, Nodes, Dependencies chuẩn DAG (phi chu trình).
    """
    try:
        logger.info("Yêu cầu sinh đồ thị DAG cho prompt dài %d ký tự", len(request.prompt))
        return scaffold_service.generate_scaffold(request)
    except HTTPException:
        raise
    except Exception as ex:
        logger.error("Lỗi khi sinh đồ thị DAG: %s", ex, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal AI service error")


if __name__ == "__main__":
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.APP_RELOAD)

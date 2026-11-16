import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.config import settings
from app.schemas.request import AiDiagnosisRequest
from app.schemas.response import AiDiagnosisResponse
from app.schemas.scaffold import ScaffoldRequest, ScaffoldResponse
from app.services.diagnosis_service import diagnosis_service
from app.services.scaffold_service import scaffold_service

# Thiết lập logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("wpe_ai")

app = FastAPI(
    title="Workflow Pipeline Engine — AI Microservice",
    description="Dịch vụ AI thông minh: Tính toán CPM, Phân tích Pháp y Dự án & Cố vấn Kỹ thuật",
    version="1.0.0"
)

# Cho phép CORS linh hoạt
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def index():
    return {
        "service": "Workflow Pipeline Engine — AI Intelligence Service",
        "version": "1.0.0",
        "status": "RUNNING",
        "geminiConfigured": settings.has_gemini_key,
        "contractDocs": "/docs"
    }

@app.get("/health")
def health_check():
    return {
        "status": "UP",
        "geminiConfigured": settings.has_gemini_key,
        "model": settings.GEMINI_MODEL
    }

@app.post("/api/ai/diagnose", response_model=AiDiagnosisResponse)
def trigger_ai_diagnostics(request: AiDiagnosisRequest):
    """
    ENDPOINT CỐT LÕI (SSOT Contract):
    Nhận dữ liệu dự án từ Spring Boot Backend (Java), thực hiện:
    - TẦNG 1: Tính toán đường găng CPM, bắt Stalled/Overdue nodes, đo Drift Score (< 10ms, 0 Token).
    - TẦNG 2: Google Gemini AI phân tích ngữ nghĩa 3 bài toán (Task bẫy, Root-cause, Song song hóa).
    - Phản hồi đúng hợp đồng JSON cho Spring Boot lưu vào cột JSONB latest_ai_analysis.
    """
    try:
        logger.info("Nhận yêu cầu chẩn đoán dự án ID: %s, tên: '%s' với %d nodes",
                    request.projectId, request.projectName, len(request.nodes))
        response = diagnosis_service.process_diagnosis(request)
        return response
    except Exception as ex:
        logger.error("Lỗi trong quá trình chẩn đoán AI: %s", ex, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Lỗi phân tích AI: {str(ex)}")

@app.post("/api/ai/scaffold-dag", response_model=ScaffoldResponse)
def scaffold_dag(request: ScaffoldRequest):
    """
    TÍNH NĂNG 1: Prompt-to-DAG (Khởi tạo đồ thị quy trình từ yêu cầu dự án).
    Chuyển đổi văn bản tự do thành cấu trúc Phases, Nodes, Dependencies chuẩn xác.
    """
    try:
        logger.info("Yêu cầu sinh đồ thị DAG cho prompt: '%s'", request.prompt[:60])
        response = scaffold_service.generate_scaffold(request)
        return response
    except Exception as ex:
        logger.error("Lỗi khi sinh đồ thị DAG: %s", ex, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Lỗi sinh đồ thị: {str(ex)}")

if __name__ == "__main__":
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)

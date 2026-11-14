"""Stub AI microservice dùng để thử ghép với backend Java (KHÔNG phải bản AI thật).

Chạy:   pip install -r requirements.txt && uvicorn main:app --port 8081
Backend: AI_MODE=http AI_SERVICE_URL=http://localhost:8081 ./mvnw spring-boot:run

Trả về đúng hợp đồng docs/specs/ai-service-contract.md. Cờ môi trường để thử lỗi:
  STUB_MODE=ok (mặc định) | bad_schema (thiếu khóa) | error500 | slow (ngủ 35s > read-timeout)
"""
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import FastAPI, HTTPException

app = FastAPI(title="WPE AI Stub", version="0.1.0")


@app.post("/api/ai/diagnose")
def diagnose(payload: Dict[str, Any]):
    mode = os.getenv("STUB_MODE", "ok")
    if mode == "error500":
        raise HTTPException(status_code=500, detail="stub forced error")
    if mode == "slow":
        time.sleep(35)

    nodes = payload.get("nodes", [])
    codes = [n["code"] for n in nodes if n.get("code")]
    stalled = [n for n in nodes if n.get("status") == "IN_PROGRESS" and n.get("isOverdue")]

    body = {
        "analyzedAt": datetime.now(timezone.utc).isoformat(),
        "source": "AI_SERVICE",
        "criticalPath": codes,
        "bottlenecks": [
            {
                "nodeCode": n["code"],
                "title": n.get("title", ""),
                "reason": "Tác vụ quá hạn và đang ở IN_PROGRESS.",
                "severity": "HIGH",
            }
            for n in stalled
        ],
        "taskTraps": [],
        "actionableAdvice": [
            {
                "action": "SPLIT_NODE" if stalled else "CONTINUE_PIPELINE",
                "targetNodeCode": stalled[0]["code"] if stalled else "GENERAL",
                "instruction": "Tách nhỏ tác vụ để giải phóng nhánh phụ thuộc." if stalled
                else "Duy trì nhịp độ hiện tại.",
                "priority": "HIGH" if stalled else "LOW",
            }
        ],
        "metrics": {
            "targetVelocity": 2.0,
            "actualVelocity": 1.2 if stalled else 1.9,
            "driftScore": 42.5 if stalled else 5.0,
            "status": "RED_ALERT" if stalled else "STABLE_GREEN",
        },
    }
    if mode == "bad_schema":
        del body["bottlenecks"]
    return body

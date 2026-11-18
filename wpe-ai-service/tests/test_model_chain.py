"""
Chuỗi model Gemini: model chính lỗi (503 quá tải, 504, 429, JSON hỏng...) thì gọi model dự phòng,
hết model mới dùng luật dự phòng. Lỗi key (401/403) thì dừng ngay. Không gọi Gemini thật.
"""
import json
import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

os.environ["GEMINI_API_KEY"] = ""
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from google.genai import errors

from app.config import settings
from app.main import scaffold_dag, trigger_ai_diagnostics
from app.schemas.request import AiDiagnosisRequest, DependencyDto, NodeDto
from app.schemas.scaffold import ScaffoldRequest
from app.services import gemini_client as gemini_module
from app.services.gemini_client import _thinking_config_for, gemini_client

PRIMARY = "gemini-3.8-flash"
FALLBACK = "gemini-3.1-flash-lite"

VALID_DIAGNOSIS = json.dumps(
    {
        "taskTraps": [
            {"nodeCode": "WPE-002", "title": "Payment", "trapType": "SCOPE_CREEP", "suggestion": "Split it into two tasks."}
        ],
        "actionableAdvice": [
            {"action": "SPLIT_NODE", "targetNodeCode": "WPE-002", "instruction": "Split WPE-002.", "priority": "HIGH"}
        ],
        "rootCauseNotes": "WPE-002 is too large.",
    }
)

VALID_SCAFFOLD = json.dumps(
    {
        "domain": "Bookstore",
        "targetAudience": "Readers",
        "techStack": ["React"],
        "phases": [{"tempId": "p1", "name": "Build", "orderIndex": 1}],
        "nodes": [
            {"tempId": "n1", "phaseTempId": "p1", "title": "Catalog", "estimatedHours": 8},
            {"tempId": "n2", "phaseTempId": "p1", "title": "Checkout", "estimatedHours": 12},
        ],
        "dependencies": [{"parentTempId": "n1", "childTempId": "n2"}],
    }
)


def _reply(text):
    return SimpleNamespace(
        text=text,
        usage_metadata=SimpleNamespace(
            prompt_token_count=100, candidates_token_count=50, thoughts_token_count=20, total_token_count=170
        ),
    )


def _overloaded():
    return errors.ServerError(503, {"error": {"code": 503, "message": "high demand", "status": "UNAVAILABLE"}})


def _rate_limited():
    return errors.ClientError(429, {"error": {"code": 429, "message": "quota", "status": "RESOURCE_EXHAUSTED"}})


def _bad_key():
    return errors.ClientError(403, {"error": {"code": 403, "message": "permission denied", "status": "PERMISSION_DENIED"}})


def _request():
    return AiDiagnosisRequest(
        projectId=1,
        projectName="Shop",
        requestedAt="2026-11-17T10:00:00Z",
        nodes=[
            NodeDto(id=1, code="WPE-001", title="DB", status="DONE", completedAt="2026-11-16T00:00:00Z",
                    dueDate="2026-11-30T00:00:00Z"),
            NodeDto(id=2, code="WPE-002", title="Payment", status="TODO", estimatedHours=8,
                    dueDate="2026-11-30T00:00:00Z"),
        ],
        dependencies=[DependencyDto(parentNodeId=1, childNodeId=2)],
    )


def _models_called(mock_client):
    return [c.kwargs["model"] for c in mock_client.models.generate_content.call_args_list]


class TestGeminiModelChain(unittest.TestCase):
    def setUp(self):
        self._orig_client = gemini_client._client
        self._patches = [
            patch.object(settings, "GEMINI_MODEL", PRIMARY),
            patch.object(settings, "GEMINI_FALLBACK_MODEL", FALLBACK),
            patch.object(settings, "GEMINI_TIMEOUT_MS", 12000),
            patch.object(settings, "GEMINI_TOTAL_TIMEOUT_MS", 25000),
            patch.object(settings, "GEMINI_THINKING_LEVEL", "LOW"),
        ]
        for p in self._patches:
            p.start()

    def tearDown(self):
        for p in self._patches:
            p.stop()
        gemini_client._client = self._orig_client

    def _client(self, *outcomes):
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = list(outcomes)
        gemini_client._client = mock_client
        return mock_client

    def test_primary_ok_calls_only_primary(self):
        mock_client = self._client(_reply(VALID_DIAGNOSIS))
        res = trigger_ai_diagnostics(_request())
        self.assertEqual(_models_called(mock_client), [PRIMARY])
        self.assertEqual(res.source, "AI_SERVICE")
        self.assertEqual(res.tokenUsage.model, PRIMARY)

    def test_primary_overloaded_falls_back_to_lite_model(self):
        mock_client = self._client(_overloaded(), _reply(VALID_DIAGNOSIS))
        res = trigger_ai_diagnostics(_request())
        self.assertEqual(_models_called(mock_client), [PRIMARY, FALLBACK])
        self.assertEqual(res.source, "AI_SERVICE")
        self.assertIsNone(res.warning)
        self.assertEqual(res.tokenUsage.source, "GEMINI_API")
        self.assertEqual(res.tokenUsage.model, FALLBACK)
        self.assertEqual([t.nodeCode for t in res.taskTraps], ["WPE-002"])

    def test_primary_truncated_json_falls_back(self):
        mock_client = self._client(_reply('{"taskTraps": [{"nodeCode": "WPE-0'), _reply(VALID_DIAGNOSIS))
        res = trigger_ai_diagnostics(_request())
        self.assertEqual(_models_called(mock_client), [PRIMARY, FALLBACK])
        self.assertEqual(res.source, "AI_SERVICE")
        self.assertEqual(res.tokenUsage.model, FALLBACK)

    def test_all_models_rate_limited_returns_rate_limit_warning(self):
        mock_client = self._client(_rate_limited(), _rate_limited())
        res = trigger_ai_diagnostics(_request())
        self.assertEqual(_models_called(mock_client), [PRIMARY, FALLBACK])
        self.assertEqual(res.source, "HEURISTIC_FALLBACK")
        self.assertIn("rate limit", res.warning.lower())
        self.assertEqual(res.tokenUsage.source, "HEURISTIC_FALLBACK")
        self.assertIsNone(res.tokenUsage.model)

    def test_all_models_overloaded_uses_rule_based_fallback(self):
        mock_client = self._client(_overloaded(), _overloaded())
        res = trigger_ai_diagnostics(_request())
        self.assertEqual(_models_called(mock_client), [PRIMARY, FALLBACK])
        self.assertEqual(res.source, "HEURISTIC_FALLBACK")
        self.assertEqual(res.warning, "AI is unavailable, showing rule-based analysis.")

    def test_bad_key_stops_without_trying_fallback(self):
        mock_client = self._client(_bad_key(), _reply(VALID_DIAGNOSIS))
        res = trigger_ai_diagnostics(_request())
        self.assertEqual(_models_called(mock_client), [PRIMARY])
        self.assertEqual(res.source, "HEURISTIC_FALLBACK")

    def test_timeouts_primary_capped_last_model_gets_remaining_budget(self):
        mock_client = self._client(_overloaded(), _reply(VALID_DIAGNOSIS))
        trigger_ai_diagnostics(_request())
        calls = mock_client.models.generate_content.call_args_list
        self.assertEqual(calls[0].kwargs["config"].http_options.timeout, 12000)
        last_timeout = calls[1].kwargs["config"].http_options.timeout
        self.assertGreater(last_timeout, 12000)
        self.assertLessEqual(last_timeout, 25000)

    def test_total_budget_exhausted_skips_remaining_models(self):
        clock = {"now": 0.0}

        def slow_primary(*args, **kwargs):
            clock["now"] += 24.0  # model chính treo gần hết 25 giây
            raise _overloaded()

        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = slow_primary
        gemini_client._client = mock_client
        with patch.object(gemini_module.time, "monotonic", side_effect=lambda: clock["now"]):
            res = trigger_ai_diagnostics(_request())
        self.assertEqual(_models_called(mock_client), [PRIMARY])
        self.assertEqual(res.source, "HEURISTIC_FALLBACK")

    def test_no_fallback_configured_primary_gets_full_budget(self):
        with patch.object(settings, "GEMINI_FALLBACK_MODEL", ""):
            mock_client = self._client(_overloaded())
            res = trigger_ai_diagnostics(_request())
        self.assertEqual(_models_called(mock_client), [PRIMARY])
        self.assertGreater(mock_client.models.generate_content.call_args.kwargs["config"].http_options.timeout, 12000)
        self.assertEqual(res.source, "HEURISTIC_FALLBACK")

    def test_scaffold_uses_model_chain(self):
        mock_client = self._client(_overloaded(), _reply(VALID_SCAFFOLD))
        res = scaffold_dag(ScaffoldRequest(prompt="An online bookstore", maxNodes=10))
        self.assertEqual(_models_called(mock_client), [PRIMARY, FALLBACK])
        self.assertEqual(res.source, "GEMINI_API")
        self.assertEqual(res.tokenUsage["model"], FALLBACK)

    def test_thinking_config_per_model_family(self):
        cfg3 = _thinking_config_for("gemini-3.8-flash")
        self.assertEqual(str(cfg3.thinking_level.value if hasattr(cfg3.thinking_level, "value") else cfg3.thinking_level), "LOW")
        self.assertIsNone(cfg3.thinking_budget)
        cfg25 = _thinking_config_for("gemini-2.5-flash")
        self.assertEqual(cfg25.thinking_budget, settings.GEMINI_THINKING_BUDGET)
        self.assertIsNone(cfg25.thinking_level)
        self.assertIsNone(_thinking_config_for("gemini-flash-latest"))
        with patch.object(settings, "GEMINI_THINKING_LEVEL", "SUPER"):
            cfg_bad = _thinking_config_for("gemini-3.1-flash-lite")
        self.assertEqual(str(cfg_bad.thinking_level.value if hasattr(cfg_bad.thinking_level, "value") else cfg_bad.thinking_level), "LOW")

    def test_model_list_dedupes_and_accepts_comma_list(self):
        with patch.object(settings, "GEMINI_FALLBACK_MODEL", f" {FALLBACK} , {PRIMARY}, gemini-3.5-flash ,"):
            self.assertEqual(settings.gemini_models, [PRIMARY, FALLBACK, "gemini-3.5-flash"])


if __name__ == "__main__":
    unittest.main()

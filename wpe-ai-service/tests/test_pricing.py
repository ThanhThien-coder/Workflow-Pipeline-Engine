"""Giá ước tính theo từng model (bảng giá gói trả phí của Google). Không gọi Gemini thật."""
import os
import sys
import unittest
from datetime import date
from pathlib import Path
from types import SimpleNamespace

os.environ["GEMINI_API_KEY"] = ""
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.gemini_client import GeminiClient, _price_for


def _usage(prompt=1_000_000, candidates=200_000, thoughts=100_000):
    return SimpleNamespace(
        prompt_token_count=prompt,
        candidates_token_count=candidates,
        thoughts_token_count=thoughts,
        total_token_count=prompt + candidates + thoughts,
    )


class TestPricing(unittest.TestCase):
    def test_price_per_model(self):
        self.assertEqual(_price_for("gemini-3.1-flash-lite"), (0.25, 1.50))
        self.assertEqual(_price_for("gemini-2.5-flash"), (0.30, 2.50))
        self.assertEqual(_price_for("models/gemini-3.1-flash-lite"), (0.25, 1.50))

    def test_gemini_38_flash_price_changes_in_2027(self):
        self.assertEqual(_price_for("gemini-3.8-flash", date(2026, 12, 31)), (0.75, 3.75))
        self.assertEqual(_price_for("gemini-3.8-flash", date(2027, 1, 1)), (1.50, 7.50))

    def test_unknown_model_has_no_price(self):
        self.assertIsNone(_price_for("gemini-flash-latest"))
        self.assertIsNone(_price_for(None))

    def test_cost_counts_thinking_tokens_as_output(self):
        usage = GeminiClient._build_token_usage(_usage(), model="gemini-3.1-flash-lite")
        # 1M input * 0.25 + (200k + 100k) output * 1.50 = 0.25 + 0.45
        self.assertAlmostEqual(usage["estimatedCostUsd"], 0.70, places=6)
        self.assertEqual(usage["model"], "gemini-3.1-flash-lite")

    def test_unknown_model_cost_is_zero(self):
        usage = GeminiClient._build_token_usage(_usage(), model="gemini-flash-latest")
        self.assertEqual(usage["estimatedCostUsd"], 0.0)


if __name__ == "__main__":
    unittest.main()

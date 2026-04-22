"""
Regression tests for the security-hardening pass.

Covers:
- _split_csv_env: strips whitespace, drops empties.
- SecurityConfig env parsing for API_KEYS / ALLOWED_ORIGINS /
  TRUSTED_PROXIES / REDACTION_PATTERNS.
- Ephemeral-mode guarantee: generated report files must not persist on
  disk when ephemeral_mode=True, even when the request fails after the
  reports have been written.
"""

import importlib
import os
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from backend.security_config import _split_csv_env


# ---------------------------------------------------------------------------
# _split_csv_env
# ---------------------------------------------------------------------------

class TestSplitCsvEnv:
    def test_basic_split(self):
        assert _split_csv_env("a,b,c") == ["a", "b", "c"]

    def test_strips_whitespace_around_entries(self):
        # Operator typo `'key1, key2'` must not yield `" key2"`
        assert _split_csv_env("key1, key2, key3") == ["key1", "key2", "key3"]

    def test_drops_empty_entries(self):
        assert _split_csv_env("a,,b,  ,c") == ["a", "b", "c"]

    def test_empty_string_returns_empty_list(self):
        assert _split_csv_env("") == []

    def test_whitespace_only_returns_empty_list(self):
        assert _split_csv_env("   ,  ,  ") == []

    def test_single_entry_with_surrounding_whitespace(self):
        assert _split_csv_env("  only-key  ") == ["only-key"]


# ---------------------------------------------------------------------------
# SecurityConfig env parsing (integration)
# ---------------------------------------------------------------------------

class TestSecurityConfigEnvParsing:
    def _reload_config(self):
        import backend.security_config as sc
        return importlib.reload(sc)

    def test_api_keys_are_stripped(self):
        with patch.dict(os.environ, {"API_KEYS": "primary, secondary ,tertiary"}):
            sc = self._reload_config()
            assert sc.SecurityConfig.API_KEYS == ["primary", "secondary", "tertiary"]

    def test_allowed_origins_are_stripped(self):
        with patch.dict(os.environ, {
            "ALLOWED_ORIGINS": "https://a.com, https://b.com , https://c.com"
        }):
            sc = self._reload_config()
            assert sc.SecurityConfig.ALLOWED_ORIGINS == [
                "https://a.com", "https://b.com", "https://c.com"
            ]

    def test_trusted_proxies_are_stripped(self):
        with patch.dict(os.environ, {"TRUSTED_PROXIES": "10.0.0.1, 10.0.0.2"}):
            sc = self._reload_config()
            assert sc.SecurityConfig.TRUSTED_PROXIES == ["10.0.0.1", "10.0.0.2"]

    def test_empty_trusted_proxies_yields_empty_list(self):
        with patch.dict(os.environ, {"TRUSTED_PROXIES": ""}):
            sc = self._reload_config()
            assert sc.SecurityConfig.TRUSTED_PROXIES == []

    def test_empty_api_keys_yields_empty_list(self):
        env = {k: v for k, v in os.environ.items() if k != "API_KEYS"}
        with patch.dict(os.environ, env, clear=True):
            os.environ["TESTING"] = "true"
            sc = self._reload_config()
            assert sc.SecurityConfig.API_KEYS == []


# ---------------------------------------------------------------------------
# Ephemeral-mode cleanup on exception
# ---------------------------------------------------------------------------

class TestEphemeralCleanupOnException:
    """
    Asserts SEC-1: generated report files MUST not persist on disk when
    ephemeral_mode=True, even when the request fails after the files have
    already been written.
    """

    @pytest.fixture(autouse=True)
    def _testing_env(self, monkeypatch):
        monkeypatch.setenv("TESTING", "true")
        monkeypatch.setenv("ENVIRONMENT", "development")
        yield

    def _build_client(self):
        from backend import main
        importlib.reload(main)
        return TestClient(main.app), main

    def test_job_dir_removed_when_response_building_fails(self, monkeypatch):
        client, _ = self._build_client()
        from backend.api import endpoints

        captured_job_dir: dict = {}
        original = endpoints.ProcessingPipeline

        class FailingAfterReports(original):  # type: ignore[misc]
            """Generate reports normally, then corrupt report_data so the
            response flattening raises. Reproduces the privacy leak."""

            def process_and_generate_reports(self, *args, **kwargs):
                report_data, files = super().process_and_generate_reports(*args, **kwargs)
                captured_job_dir["path"] = kwargs["output_dir"]
                report_data.candidates = [object()]  # type: ignore[list-item]
                return report_data, files

        monkeypatch.setattr(endpoints, "ProcessingPipeline", FailingAfterReports)

        csv_content = b"Date,Description,Amount\n15/01/2024,WOOLWORTHS,-50.00\n"
        response = client.post(
            "/api/upload",
            files={"file": ("test.csv", csv_content, "text/csv")},
            data={"ephemeral_mode": "true", "confidence_threshold": "0.6"},
        )

        assert response.status_code == 500
        assert "path" in captured_job_dir, "pipeline was never invoked"
        job_dir = Path(captured_job_dir["path"])
        assert not job_dir.exists(), (
            f"Ephemeral cleanup failed: {job_dir} should have been removed "
            "after the exception"
        )

    def test_job_dir_removed_on_success_path(self):
        client, _ = self._build_client()

        csv_content = b"Date,Description,Amount\n15/01/2024,WOOLWORTHS,-50.00\n"
        response = client.post(
            "/api/upload",
            files={"file": ("test.csv", csv_content, "text/csv")},
            data={"ephemeral_mode": "true", "confidence_threshold": "0.6"},
        )

        assert response.status_code == 200
        job_id = response.json()["job_id"]

        from backend.api import endpoints
        job_dir = endpoints.REPORTS_DIR / job_id
        assert not job_dir.exists(), (
            "Ephemeral cleanup failed on success path"
        )

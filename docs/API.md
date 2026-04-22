# API Reference

All endpoints are under `/api` except `/health`. No authentication required by default; add `REQUIRE_API_KEY=true` + `API_KEYS=...` in the backend env to gate access.

## `POST /api/upload`

Upload a bank statement for analysis. In **ephemeral mode** (default) the response includes the full `report_data` inline; no polling or download is needed.

**Request** — `multipart/form-data`

| Field | Type | Default | Description |
|---|---|---|---|
| `file` | File | required | CSV or PDF bank statement, max 10 MB |
| `income_year` | string | auto-detected | e.g. `"2025-2026"` — detected from transaction dates if omitted |
| `ephemeral_mode` | bool | `true` | Process in-memory only; all data discarded after response |
| `confidence_threshold` | float | `0.60` | Minimum confidence for the Likely Deductible bucket |
| `use_rag` | bool | `true` | Enable RAG pipeline for fitness transactions (requires API key) |

**Response `200`:**

```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "message": "Processing complete",
  "report_data": {
    "income_year": "2025-2026",
    "generated_at": "2026-03-28T14:23:01Z",
    "rag_enabled": true,
    "summary": {
      "total_deductible": "1249.85",
      "total_needs_review": "312.40",
      "total_excluded": "6850.00",
      "category_totals": {
        "work_software": "549.00",
        "professional_memberships": "549.00",
        "training_education": "151.85"
      },
      "confidence_distribution": {
        "high": 8,
        "medium": 3,
        "low": 1
      }
    },
    "candidates": [ /* ClassifiedTransaction[] — Likely Deductible */ ],
    "needs_review": [ /* ClassifiedTransaction[] — Needs Review */ ],
    "excluded": [ /* ExcludedTransaction[] */ ]
  }
}
```

### `ClassifiedTransaction` shape

```json
{
  "id": "txn-uuid",
  "date": "2025-01-15",
  "description": "Adobe Creative Cloud Annual",
  "merchant": "Adobe",
  "amount": "89.99",
  "category": "work_software",
  "confidence": 0.95,
  "confidence_pct": 95,
  "reason": "keyword_match: adobe | rule: R001",
  "evidence": ["receipt"],
  "flags": [],
  "matched_rule_id": "R001",
  "rag_analysed": false,
  "ato_citation": null,
  "disclaimer": null
}
```

### `ExcludedTransaction` shape

```json
{
  "id": "txn-uuid",
  "date": "2025-01-01",
  "description": "OSKO TRANSFER TO SAVINGS",
  "merchant": "Internal Transfer",
  "amount": "500.00",
  "exclusion_reason": "transfer_between_accounts",
  "explanation": "OSKO/PayID transfer between accounts — not a deductible expense"
}
```

## `GET /api/jobs/{job_id}`

Poll job status. Primarily used when processing is deferred (ephemeral mode returns completion in the upload response itself).

```json
{ "job_id": "550e8400-...", "status": "completed", "progress": 100 }
```

`status` values: `queued` · `processing` · `completed` · `failed`

The `job_id` path segment is validated as a UUID; any other format returns 400 (`invalid_job_id`). This prevents path traversal against the reports directory.

## `GET /api/jobs/{job_id}/download/{format}`

Download a generated report. `format`: `pdf` · `csv` · `json`.

In ephemeral mode the job directory is deleted as soon as the upload response has been assembled — download URLs are only usable when the job was uploaded with `ephemeral_mode=false`.

## `GET /health`

Liveness probe for load balancers / orchestrators.

```json
{ "status": "ok" }
```

No authentication required.

## Error format

All errors follow this shape:

```json
{
  "error": "file_too_large",
  "message": "File exceeds 10 MB limit",
  "details": {}
}
```

| HTTP | Code | When |
|---|---|---|
| 400 | `invalid_file_type` | Not CSV or PDF |
| 400 | `file_too_large` | Exceeds `MAX_UPLOAD_SIZE_MB` |
| 400 | `invalid_job_id` | Path segment isn't a UUID |
| 400 | `invalid_income_year` | Not `YYYY-YYYY` or years aren't consecutive |
| 400 | `invalid_confidence_threshold` | Outside `[0.0, 1.0]` |
| 400 | `pdf_parsing_failed` | PDF couldn't be parsed |
| 401 | `missing_api_key` | `REQUIRE_API_KEY=true` and no `X-API-Key` header |
| 403 | `invalid_api_key` | API key didn't match |
| 404 | `job_not_found` | Unknown `job_id` (or already cleaned up in ephemeral mode) |
| 404 | `report_not_found` | Job exists but the requested format wasn't generated |
| 429 | `rate_limit_exceeded` | Too many requests — see `Retry-After` header |
| 429 | `upload_limit_exceeded` | Hourly MB upload quota exceeded |
| 500 | `processing_failed` | Internal pipeline error |

Verbose error details (e.g. full exception messages) are suppressed in production (`ENVIRONMENT=production`) and included in dev.

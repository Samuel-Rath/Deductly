"""
Tax Deduction Analyzer - FastAPI Backend
Main application entry point with comprehensive security, logging, and monitoring.
"""

import os
import hmac
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from backend.api.endpoints import router as api_router
from backend.security_config import SecurityConfig
from backend.middleware.security import setup_security_middleware
from backend.logging_config import logger, log_event, log_error, log_security_event
from backend.monitoring import get_metrics, get_health, RequestTimer


# ============================================================================
# Application Lifespan
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown."""
    # --- startup ---
    SecurityConfig.validate_config()
    config_summary = SecurityConfig.get_safe_config_summary()
    log_event(
        'application_startup',
        version='1.0.0',
        environment=config_summary['environment'],
        ephemeral_mode=config_summary['ephemeral_mode_default'],
        redaction_enabled=config_summary['redaction_enabled'],
        rate_limiting=SecurityConfig.RATE_LIMIT_ENABLED,
    )
    logger.info("Tax Deduction Analyzer API starting")
    logger.info("Environment: %s", config_summary['environment'])
    logger.info("Ephemeral mode: %s", config_summary['ephemeral_mode_default'])

    yield

    # --- shutdown ---
    log_event('application_shutdown')
    logger.info("Tax Deduction Analyzer API stopped")


# ============================================================================
# App Initialisation
# ============================================================================

app = FastAPI(
    title="Tax Deduction Analyzer",
    description="Australian tax deduction candidate analysis system",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if SecurityConfig.ENABLE_SWAGGER_UI else None,
    redoc_url="/redoc" if SecurityConfig.ENABLE_SWAGGER_UI else None,
    openapi_url="/openapi.json" if SecurityConfig.ENABLE_SWAGGER_UI else None,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=SecurityConfig.ALLOWED_ORIGINS,
    allow_credentials=SecurityConfig.CORS_ALLOW_CREDENTIALS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", SecurityConfig.API_KEY_HEADER],
    max_age=SecurityConfig.CORS_MAX_AGE,
)

# Security middleware (rate limiting, headers, input validation, API key)
setup_security_middleware(app)


# ============================================================================
# Request Timing Middleware
# ============================================================================

@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    """Record per-request timing metrics."""
    with RequestTimer(request.url.path) as timer:
        try:
            response = await call_next(request)
            timer.set_status(response.status_code)
            return response
        except Exception:
            timer.set_status(500)
            raise


# ============================================================================
# Global Exception Handlers
# ============================================================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors with environment-aware detail."""
    log_security_event(
        'validation_error',
        'low',
        endpoint=str(request.url.path),
        errors=exc.errors() if not SecurityConfig.is_production() else [],
    )
    detail = {} if SecurityConfig.is_production() else {"errors": exc.errors()}
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"error": "validation_error", "message": "Request validation failed", "details": detail},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected errors without leaking internals in production."""
    log_error('unhandled_exception', exc, endpoint=str(request.url.path), method=request.method)
    detail = {} if SecurityConfig.is_production() else {"error": str(exc)}
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "internal_server_error", "message": "An unexpected error occurred", "details": detail},
    )


# ============================================================================
# Health and Monitoring Endpoints
# ============================================================================

@app.get("/")
async def root():
    """API information."""
    return {
        "message": "Tax Deduction Analyzer API",
        "version": "1.0.0",
        "status": "operational",
        "environment": "production" if SecurityConfig.is_production() else "development",
    }


@app.get("/health")
async def health_check():
    """Health check for load balancers and uptime monitors."""
    return get_health()


@app.get("/metrics")
async def metrics(request: Request):
    """
    Application metrics — only available when ENABLE_METRICS=true.
    Protected by API key (if REQUIRE_API_KEY=true) or trusted-proxy allowlist.
    """
    if not SecurityConfig.ENABLE_METRICS:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": "not_found", "message": "Metrics endpoint is disabled"},
        )

    # Require either a valid API key or that the request originates from a
    # trusted proxy/internal network.  This prevents unauthenticated callers
    # from fingerprinting throughput or security-event rates (VULN-003).
    client_ip = request.client.host if request.client else ""
    api_key   = request.headers.get(SecurityConfig.API_KEY_HEADER, "")

    key_ok    = bool(SecurityConfig.API_KEYS) and any(
        hmac.compare_digest(api_key, k) for k in SecurityConfig.API_KEYS
    )
    ip_ok     = bool(SecurityConfig.TRUSTED_PROXIES) and client_ip in SecurityConfig.TRUSTED_PROXIES

    if not key_ok and not ip_ok:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "forbidden", "message": "Metrics access requires a valid API key or trusted source IP."},
        )

    return get_metrics()


@app.get("/config")
async def get_config():
    """Safe configuration summary — development only."""
    if SecurityConfig.is_production():
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": "not_found", "message": "Config endpoint is not available in production"},
        )
    return SecurityConfig.get_safe_config_summary()


# ============================================================================
# API Routes
# ============================================================================

app.include_router(api_router)

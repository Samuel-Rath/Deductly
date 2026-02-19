"""
Tax Deduction Analyzer - FastAPI Backend
Main application entry point with comprehensive security, logging, and monitoring
"""
import os
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from backend.api.endpoints import router as api_router
from backend.security_config import SecurityConfig
from backend.middleware.security import setup_security_middleware
from backend.logging_config import logger, log_event, log_error, log_security_event
from backend.monitoring import get_metrics, get_health, RequestTimer

# Initialize FastAPI app
app = FastAPI(
    title="Tax Deduction Analyzer",
    description="Australian tax deduction candidate analysis system",
    version="1.0.0",
    docs_url="/docs" if SecurityConfig.ENABLE_SWAGGER_UI else None,
    redoc_url="/redoc" if SecurityConfig.ENABLE_SWAGGER_UI else None,
    openapi_url="/openapi.json" if SecurityConfig.ENABLE_SWAGGER_UI else None
)

# Configure CORS with security settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=SecurityConfig.ALLOWED_ORIGINS,
    allow_credentials=SecurityConfig.CORS_ALLOW_CREDENTIALS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", SecurityConfig.API_KEY_HEADER],
    max_age=SecurityConfig.CORS_MAX_AGE
)

# Setup security middleware (rate limiting, headers, validation, API key)
setup_security_middleware(app)


# ============================================================================
# Request Timing Middleware
# ============================================================================

@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    """Time all requests and record metrics"""
    with RequestTimer(request.url.path) as timer:
        try:
            response = await call_next(request)
            timer.set_status(response.status_code)
            return response
        except Exception as e:
            timer.set_status(500)
            raise


# ============================================================================
# Startup and Shutdown Events
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Initialize application on startup"""
    # Validate security configuration
    SecurityConfig.validate_config()
    
    # Log startup (without sensitive data)
    config_summary = SecurityConfig.get_safe_config_summary()
    log_event(
        'application_startup',
        version='1.0.0',
        environment=config_summary['environment'],
        ephemeral_mode=config_summary['ephemeral_mode_default'],
        redaction_enabled=config_summary['redaction_enabled'],
        rate_limiting=SecurityConfig.RATE_LIMIT_ENABLED
    )
    
    logger.info(f"Starting Tax Deduction Analyzer API")
    logger.info(f"Environment: {config_summary['environment']}")
    logger.info(f"Ephemeral mode: {config_summary['ephemeral_mode_default']}")
    logger.info(f"Redaction enabled: {config_summary['redaction_enabled']}")
    logger.info(f"Rate limiting: {SecurityConfig.RATE_LIMIT_ENABLED}")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    log_event('application_shutdown')
    logger.info("Shutting down Tax Deduction Analyzer API")


# ============================================================================
# Global Exception Handlers
# ============================================================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors."""
    # Log validation error
    log_security_event(
        'validation_error',
        'low',
        endpoint=str(request.url.path),
        errors=exc.errors() if not SecurityConfig.is_production() else []
    )
    
    # Sanitize error messages in production
    if SecurityConfig.is_production():
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": "validation_error",
                "message": "Request validation failed",
                "details": {}
            }
        )
    
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error": "validation_error",
            "message": "Request validation failed",
            "details": {"errors": exc.errors()}
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected errors."""
    # Log error with context
    log_error(
        'unhandled_exception',
        exc,
        endpoint=str(request.url.path),
        method=request.method
    )
    
    # Sanitize error messages in production
    if SecurityConfig.is_production():
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "internal_server_error",
                "message": "An unexpected error occurred",
                "details": {}
            }
        )
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "internal_server_error",
            "message": "An unexpected error occurred",
            "details": {"error": str(exc)}
        }
    )


# ============================================================================
# Health and Info Endpoints
# ============================================================================

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Tax Deduction Analyzer API",
        "version": "1.0.0",
        "status": "operational",
        "environment": "production" if SecurityConfig.is_production() else "development"
    }


@app.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring with detailed status checks
    Returns overall health status and individual component checks
    """
    return get_health()


@app.get("/metrics")
async def metrics():
    """
    Metrics endpoint for monitoring
    Returns application metrics (requests, uploads, jobs, security events)
    """
    return get_metrics()


@app.get("/config")
async def get_config():
    """Get safe configuration summary (no secrets)"""
    return SecurityConfig.get_safe_config_summary()


# ============================================================================
# API Routes
# ============================================================================

# Include API routes
app.include_router(api_router)


"""
Security Configuration for Tax Deduction Analyzer Backend
Implements comprehensive security measures for production deployment
"""

import os
from typing import List, Dict
from datetime import timedelta

class SecurityConfig:
    """Centralized security configuration"""
    
    # Secret key for session management and CSRF protection
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production-min-32-chars")
    
    # CORS Configuration
    ALLOWED_ORIGINS: List[str] = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:3000"
    ).split(",")
    
    CORS_ALLOW_CREDENTIALS: bool = os.getenv("CORS_ALLOW_CREDENTIALS", "false").lower() == "true"
    CORS_MAX_AGE: int = int(os.getenv("CORS_MAX_AGE", "600"))  # 10 minutes
    
    # File Upload Security
    MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "10"))
    MAX_UPLOAD_SIZE_BYTES: int = MAX_UPLOAD_SIZE_MB * 1024 * 1024

    # Single source of truth for allowed upload types (CSV + PDF)
    ALLOWED_FILE_TYPES: List[str] = [
        "text/csv",
        "application/csv",
        "text/plain",
        "application/vnd.ms-excel",   # Some browsers send this for .csv
        "application/pdf",
    ]
    ALLOWED_FILE_EXTENSIONS: List[str] = [".csv", ".pdf"]
    
    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "30"))  # Increased for status polling
    RATE_LIMIT_PER_HOUR: int = int(os.getenv("RATE_LIMIT_PER_HOUR", "500"))  # Increased proportionally
    
    # Disable rate limiting in test environment
    if os.getenv("TESTING", "false").lower() == "true":
        RATE_LIMIT_ENABLED = False
    
    # Upload rate limiting (total MB per hour per IP)
    UPLOAD_RATE_LIMIT_MB_PER_HOUR: int = int(os.getenv("UPLOAD_RATE_LIMIT_MB_PER_HOUR", "100"))
    
    # Session & Token Security
    SESSION_TIMEOUT_MINUTES: int = int(os.getenv("SESSION_TIMEOUT_MINUTES", "30"))
    JOB_ID_ENTROPY_BYTES: int = 16  # 128-bit job IDs
    
    # Data Retention
    EPHEMERAL_MODE_DEFAULT: bool = os.getenv("EPHEMERAL_MODE", "true").lower() == "true"
    MAX_RETENTION_DAYS: int = int(os.getenv("MAX_RETENTION_DAYS", "30"))
    AUTO_CLEANUP_ENABLED: bool = os.getenv("AUTO_CLEANUP_ENABLED", "true").lower() == "true"
    
    # Redaction
    ENABLE_REDACTION: bool = os.getenv("ENABLE_REDACTION", "true").lower() == "true"
    REDACTION_TEXT: str = os.getenv("REDACTION_TEXT", "[REDACTED]")
    
    # Default redaction patterns (account numbers, BSB codes)
    DEFAULT_REDACTION_PATTERNS: List[str] = [
        r'\b\d{6}-\d{6,10}\b',  # Account numbers (6 digits - 6-10 digits)
        r'\b\d{3}-\d{3}\b',      # BSB codes (XXX-XXX)
        r'\bBSB:\s*\d{3}-\d{3}\b',  # BSB with label
        r'\bACC:\s*\d{6,10}\b',     # Account with label
    ]
    
    CUSTOM_REDACTION_PATTERNS: List[str] = os.getenv("REDACTION_PATTERNS", "").split(",") if os.getenv("REDACTION_PATTERNS") else []
    
    @classmethod
    def get_all_redaction_patterns(cls) -> List[str]:
        """Get combined list of default and custom redaction patterns"""
        return cls.DEFAULT_REDACTION_PATTERNS + [p for p in cls.CUSTOM_REDACTION_PATTERNS if p]
    
    # Security Headers
    SECURITY_HEADERS: Dict[str, str] = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=()",
        "Content-Security-Policy": (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
    }
    
    # Input Validation
    MAX_DESCRIPTION_LENGTH: int = 500
    MAX_MERCHANT_LENGTH: int = 200
    MAX_CATEGORY_LENGTH: int = 100
    
    # CSV Parsing Limits
    MAX_CSV_ROWS: int = int(os.getenv("MAX_CSV_ROWS", "50000"))
    MAX_CSV_COLUMNS: int = 50
    
    # Database Security
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./deductions.db")
    DATABASE_ECHO: bool = os.getenv("DATABASE_ECHO", "false").lower() == "true"
    
    # Logging & Monitoring
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_SENSITIVE_DATA: bool = False  # Never log sensitive data
    
    # API Security
    API_KEY_HEADER: str = "X-API-Key"
    REQUIRE_API_KEY: bool = os.getenv("REQUIRE_API_KEY", "false").lower() == "true"
    API_KEYS: List[str] = os.getenv("API_KEYS", "").split(",") if os.getenv("API_KEYS") else []
    
    # Trusted Proxies (for rate limiting behind reverse proxy)
    TRUSTED_PROXIES: List[str] = os.getenv("TRUSTED_PROXIES", "").split(",") if os.getenv("TRUSTED_PROXIES") else []
    
    # Feature Flags
    ENABLE_SWAGGER_UI: bool = os.getenv("ENABLE_SWAGGER_UI", "false").lower() == "true"
    ENABLE_METRICS: bool = os.getenv("ENABLE_METRICS", "false").lower() == "true"
    
    @classmethod
    def validate_config(cls) -> None:
        """Validate security configuration on startup"""
        errors = []
        
        # Only enforce SECRET_KEY in production
        if cls.is_production() and (not cls.SECRET_KEY or len(cls.SECRET_KEY) < 32):
            errors.append("SECRET_KEY must be at least 32 characters in production")
        
        if not cls.ALLOWED_ORIGINS:
            errors.append("ALLOWED_ORIGINS must be configured")
        
        if cls.MAX_UPLOAD_SIZE_MB > 100:
            errors.append("MAX_UPLOAD_SIZE_MB should not exceed 100MB")
        
        if cls.RATE_LIMIT_PER_MINUTE < 1:
            errors.append("RATE_LIMIT_PER_MINUTE must be at least 1")
        
        if errors:
            raise ValueError(f"Security configuration errors: {', '.join(errors)}")
    
    @classmethod
    def is_production(cls) -> bool:
        """Check if running in production environment"""
        return os.getenv("ENVIRONMENT", "development").lower() == "production"
    
    @classmethod
    def get_safe_config_summary(cls) -> Dict[str, any]:
        """Get configuration summary without sensitive values"""
        return {
            "max_upload_size_mb": cls.MAX_UPLOAD_SIZE_MB,
            "rate_limit_per_minute": cls.RATE_LIMIT_PER_MINUTE,
            "ephemeral_mode_default": cls.EPHEMERAL_MODE_DEFAULT,
            "redaction_enabled": cls.ENABLE_REDACTION,
            "max_csv_rows": cls.MAX_CSV_ROWS,
            "cors_origins_count": len(cls.ALLOWED_ORIGINS),
            "environment": "production" if cls.is_production() else "development"
        }


# Validate configuration on import
SecurityConfig.validate_config()

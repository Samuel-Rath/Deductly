"""
Structured Logging Configuration
Implements secure, structured logging with PII protection
"""

import os
import sys
import logging
from typing import Any, Dict
from datetime import datetime, timezone
import json

from backend.security_config import SecurityConfig


class SecureJSONFormatter(logging.Formatter):
    """JSON formatter that never logs sensitive data"""
    
    SENSITIVE_KEYS = {
        'password', 'secret', 'token', 'api_key', 'authorization',
        'credit_card', 'ssn', 'account_number', 'bsb', 'pin'
    }
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON with sensitive data redacted"""
        log_data = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
        }
        
        # Add extra fields if present
        if hasattr(record, 'extra'):
            extra = self._sanitize_dict(record.extra)
            log_data.update(extra)
        
        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = {
                'type': record.exc_info[0].__name__ if record.exc_info[0] else None,
                'message': str(record.exc_info[1]) if record.exc_info[1] else None,
            }
            # Don't include full stack trace in production
            if not SecurityConfig.is_production():
                log_data['exception']['traceback'] = self.formatException(record.exc_info)
        
        # Add environment
        log_data['environment'] = 'production' if SecurityConfig.is_production() else 'development'
        
        return json.dumps(log_data)
    
    def _sanitize_dict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Remove sensitive keys from dictionary"""
        sanitized = {}
        for key, value in data.items():
            if any(sensitive in key.lower() for sensitive in self.SENSITIVE_KEYS):
                sanitized[key] = '[REDACTED]'
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_dict(value)
            elif isinstance(value, list):
                sanitized[key] = [self._sanitize_dict(item) if isinstance(item, dict) else item for item in value]
            else:
                sanitized[key] = value
        return sanitized


def setup_logging():
    """Configure application logging"""
    
    # Get log level from config
    log_level = getattr(logging, SecurityConfig.LOG_LEVEL.upper(), logging.INFO)
    
    # Create logger
    logger = logging.getLogger('tax_analyzer')
    logger.setLevel(log_level)
    
    # Remove existing handlers
    logger.handlers = []
    
    # Console handler with JSON formatting
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    console_handler.setFormatter(SecureJSONFormatter())
    logger.addHandler(console_handler)
    
    # File handler for errors (persistent mode only)
    if not SecurityConfig.EPHEMERAL_MODE_DEFAULT:
        os.makedirs('logs', exist_ok=True)
        error_handler = logging.FileHandler('logs/errors.log')
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(SecureJSONFormatter())
        logger.addHandler(error_handler)
    
    return logger


# Create global logger instance
logger = setup_logging()


def log_event(event_type: str, **kwargs):
    """
    Log a structured event with automatic sanitization
    
    Args:
        event_type: Type of event (upload_started, processing_complete, etc.)
        **kwargs: Additional event data (will be sanitized)
    """
    logger.info(event_type, extra=kwargs)


def log_error(error_type: str, error: Exception, **kwargs):
    """
    Log an error with context
    
    Args:
        error_type: Type of error (validation_error, processing_error, etc.)
        error: The exception that occurred
        **kwargs: Additional context (will be sanitized)
    """
    logger.error(
        error_type,
        exc_info=True,
        extra={
            'error_message': str(error),
            'error_type': type(error).__name__,
            **kwargs
        }
    )


def log_security_event(event_type: str, severity: str, **kwargs):
    """
    Log a security-related event
    
    Args:
        event_type: Type of security event (rate_limit_exceeded, invalid_file, etc.)
        severity: Severity level (low, medium, high, critical)
        **kwargs: Additional context (will be sanitized)
    """
    logger.warning(
        f"SECURITY: {event_type}",
        extra={
            'security_event': True,
            'severity': severity,
            **kwargs
        }
    )


def log_audit(action: str, job_id: str, **kwargs):
    """
    Log an audit trail event.

    Args:
        action: Action performed (upload, download, delete, etc.)
        job_id: Job identifier
        **kwargs: Additional audit data (will be sanitized)
    """
    logger.info(
        f"AUDIT: {action}",
        extra={
            'audit': True,
            'action': action,
            'job_id': job_id,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            **kwargs
        }
    )

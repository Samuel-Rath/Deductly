"""
Security Middleware for FastAPI
Implements rate limiting, security headers, and request validation
"""

import time
import hashlib
from typing import Dict, Optional, Callable
from collections import defaultdict
from datetime import datetime, timedelta
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from backend.security_config import SecurityConfig


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware to prevent abuse"""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.requests: Dict[str, list] = defaultdict(list)
        self.upload_sizes: Dict[str, list] = defaultdict(list)
        self.cleanup_interval = 300  # Clean up old entries every 5 minutes
        self.last_cleanup = time.time()
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address, considering trusted proxies"""
        # Check X-Forwarded-For header if behind proxy
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for and SecurityConfig.TRUSTED_PROXIES:
            # Take the first IP (client IP)
            client_ip = forwarded_for.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"
        
        return client_ip
    
    def _cleanup_old_entries(self):
        """Remove old rate limit entries"""
        current_time = time.time()
        
        if current_time - self.last_cleanup < self.cleanup_interval:
            return
        
        cutoff_time = current_time - 3600  # 1 hour ago
        
        # Clean up request timestamps
        for ip in list(self.requests.keys()):
            self.requests[ip] = [ts for ts in self.requests[ip] if ts > cutoff_time]
            if not self.requests[ip]:
                del self.requests[ip]
        
        # Clean up upload sizes
        for ip in list(self.upload_sizes.keys()):
            self.upload_sizes[ip] = [(ts, size) for ts, size in self.upload_sizes[ip] if ts > cutoff_time]
            if not self.upload_sizes[ip]:
                del self.upload_sizes[ip]
        
        self.last_cleanup = current_time
    
    async def dispatch(self, request: Request, call_next: Callable):
        """Process request with rate limiting"""
        if not SecurityConfig.RATE_LIMIT_ENABLED:
            return await call_next(request)
        
        client_ip = self._get_client_ip(request)
        current_time = time.time()
        
        # Cleanup old entries periodically
        self._cleanup_old_entries()
        
        # Check per-minute rate limit
        minute_ago = current_time - 60
        recent_requests = [ts for ts in self.requests[client_ip] if ts > minute_ago]
        
        if len(recent_requests) >= SecurityConfig.RATE_LIMIT_PER_MINUTE:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": "rate_limit_exceeded",
                    "message": f"Rate limit exceeded. Maximum {SecurityConfig.RATE_LIMIT_PER_MINUTE} requests per minute.",
                    "retry_after": 60
                }
            )
        
        # Check per-hour rate limit
        hour_ago = current_time - 3600
        hourly_requests = [ts for ts in self.requests[client_ip] if ts > hour_ago]
        
        if len(hourly_requests) >= SecurityConfig.RATE_LIMIT_PER_HOUR:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": "rate_limit_exceeded",
                    "message": f"Rate limit exceeded. Maximum {SecurityConfig.RATE_LIMIT_PER_HOUR} requests per hour.",
                    "retry_after": 3600
                }
            )
        
        # Check upload size rate limit for upload endpoints
        if request.url.path.startswith("/api/upload"):
            content_length = request.headers.get("content-length")
            if content_length:
                size_mb = int(content_length) / (1024 * 1024)
                
                # Check hourly upload limit
                hourly_uploads = [(ts, size) for ts, size in self.upload_sizes[client_ip] if ts > hour_ago]
                total_uploaded_mb = sum(size for _, size in hourly_uploads)
                
                if total_uploaded_mb + size_mb > SecurityConfig.UPLOAD_RATE_LIMIT_MB_PER_HOUR:
                    return JSONResponse(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        content={
                            "error": "upload_limit_exceeded",
                            "message": f"Upload limit exceeded. Maximum {SecurityConfig.UPLOAD_RATE_LIMIT_MB_PER_HOUR}MB per hour.",
                            "retry_after": 3600
                        }
                    )
                
                # Record upload size
                self.upload_sizes[client_ip].append((current_time, size_mb))
        
        # Record request
        self.requests[client_ip].append(current_time)
        
        # Process request
        response = await call_next(request)
        
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""
    
    async def dispatch(self, request: Request, call_next: Callable):
        response = await call_next(request)
        
        # Add security headers
        for header, value in SecurityConfig.SECURITY_HEADERS.items():
            response.headers[header] = value
        
        return response


class InputValidationMiddleware(BaseHTTPMiddleware):
    """Validate and sanitize incoming requests"""
    
    SUSPICIOUS_PATTERNS = [
        "../",  # Path traversal
        "..\\",  # Path traversal (Windows)
        "<script",  # XSS attempt
        "javascript:",  # XSS attempt
        "onerror=",  # XSS attempt
        "onload=",  # XSS attempt
        "eval(",  # Code injection
        "exec(",  # Code injection
        "DROP TABLE",  # SQL injection
        "'; DROP",  # SQL injection
        "UNION SELECT",  # SQL injection
    ]
    
    async def dispatch(self, request: Request, call_next: Callable):
        """Validate request for suspicious patterns"""
        
        # Check URL path
        path = request.url.path.lower()
        for pattern in self.SUSPICIOUS_PATTERNS:
            if pattern.lower() in path:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={
                        "error": "invalid_request",
                        "message": "Request contains invalid characters"
                    }
                )
        
        # Check query parameters
        for key, value in request.query_params.items():
            value_str = str(value).lower()
            for pattern in self.SUSPICIOUS_PATTERNS:
                if pattern.lower() in value_str:
                    return JSONResponse(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        content={
                            "error": "invalid_request",
                            "message": "Request contains invalid characters"
                        }
                    )
        
        # Check headers for suspicious content
        for header, value in request.headers.items():
            if header.lower() in ["user-agent", "referer", "origin"]:
                continue  # Skip common headers
            
            value_str = str(value).lower()
            for pattern in self.SUSPICIOUS_PATTERNS:
                if pattern.lower() in value_str:
                    return JSONResponse(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        content={
                            "error": "invalid_request",
                            "message": "Request contains invalid characters"
                        }
                    )
        
        response = await call_next(request)
        return response


class APIKeyMiddleware(BaseHTTPMiddleware):
    """Validate API key if required"""
    
    EXEMPT_PATHS = ["/docs", "/redoc", "/openapi.json", "/health"]
    
    async def dispatch(self, request: Request, call_next: Callable):
        """Check API key if required"""
        
        if not SecurityConfig.REQUIRE_API_KEY:
            return await call_next(request)
        
        # Check if path is exempt
        if any(request.url.path.startswith(path) for path in self.EXEMPT_PATHS):
            return await call_next(request)
        
        # Get API key from header
        api_key = request.headers.get(SecurityConfig.API_KEY_HEADER)
        
        if not api_key:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={
                    "error": "missing_api_key",
                    "message": f"API key required in {SecurityConfig.API_KEY_HEADER} header"
                }
            )
        
        # Validate API key
        if api_key not in SecurityConfig.API_KEYS:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "error": "invalid_api_key",
                    "message": "Invalid API key"
                }
            )
        
        response = await call_next(request)
        return response


def setup_security_middleware(app):
    """Setup all security middleware"""
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(InputValidationMiddleware)
    app.add_middleware(APIKeyMiddleware)

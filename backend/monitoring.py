"""
Monitoring and Metrics Collection
Implements application metrics and health checks
"""

import time
from typing import Dict, Any
from datetime import datetime, timezone
from collections import defaultdict
from dataclasses import dataclass, field

from backend.security_config import SecurityConfig


@dataclass
class Metrics:
    """Application metrics"""
    # Request metrics
    total_requests: int = 0
    failed_requests: int = 0
    
    # Upload metrics
    total_uploads: int = 0
    failed_uploads: int = 0
    total_bytes_uploaded: int = 0
    
    # Processing metrics
    total_jobs_processed: int = 0
    failed_jobs: int = 0
    average_processing_time: float = 0.0
    
    # Security metrics
    rate_limit_violations: int = 0
    invalid_file_attempts: int = 0
    suspicious_requests: int = 0
    
    # Performance metrics
    response_times: list = field(default_factory=list)
    
    # Timestamp
    last_reset: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class MetricsCollector:
    """Collect and aggregate application metrics"""
    
    def __init__(self):
        self.metrics = Metrics()
        self.request_times: Dict[str, list] = defaultdict(list)
        self.error_counts: Dict[str, int] = defaultdict(int)
    
    def record_request(self, endpoint: str, duration: float, status_code: int):
        """Record a request"""
        self.metrics.total_requests += 1
        self.metrics.response_times.append(duration)
        self.request_times[endpoint].append(duration)
        
        if status_code >= 400:
            self.metrics.failed_requests += 1
            self.error_counts[f"{endpoint}_{status_code}"] += 1
    
    def record_upload(self, success: bool, file_size: int):
        """Record an upload attempt"""
        self.metrics.total_uploads += 1
        if success:
            self.metrics.total_bytes_uploaded += file_size
        else:
            self.metrics.failed_uploads += 1
    
    def record_job(self, success: bool, processing_time: float):
        """Record a job completion"""
        self.metrics.total_jobs_processed += 1
        if not success:
            self.metrics.failed_jobs += 1
        
        # Update average processing time
        total_time = self.metrics.average_processing_time * (self.metrics.total_jobs_processed - 1)
        self.metrics.average_processing_time = (total_time + processing_time) / self.metrics.total_jobs_processed
    
    def record_security_event(self, event_type: str):
        """Record a security event"""
        if event_type == 'rate_limit':
            self.metrics.rate_limit_violations += 1
        elif event_type == 'invalid_file':
            self.metrics.invalid_file_attempts += 1
        elif event_type == 'suspicious':
            self.metrics.suspicious_requests += 1
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics"""
        return {
            'requests': {
                'total': self.metrics.total_requests,
                'failed': self.metrics.failed_requests,
                'error_rate': self.metrics.failed_requests / max(self.metrics.total_requests, 1),
            },
            'uploads': {
                'total': self.metrics.total_uploads,
                'failed': self.metrics.failed_uploads,
                'total_mb': self.metrics.total_bytes_uploaded / (1024 * 1024),
            },
            'jobs': {
                'total': self.metrics.total_jobs_processed,
                'failed': self.metrics.failed_jobs,
                'average_processing_time': self.metrics.average_processing_time,
            },
            'security': {
                'rate_limit_violations': self.metrics.rate_limit_violations,
                'invalid_file_attempts': self.metrics.invalid_file_attempts,
                'suspicious_requests': self.metrics.suspicious_requests,
            },
            'performance': {
                'average_response_time': sum(self.metrics.response_times) / max(len(self.metrics.response_times), 1),
                'p95_response_time': self._percentile(self.metrics.response_times, 95),
                'p99_response_time': self._percentile(self.metrics.response_times, 99),
            },
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'uptime_seconds': (datetime.now(timezone.utc) - self.metrics.last_reset).total_seconds(),
        }
    
    def get_health_status(self) -> Dict[str, Any]:
        """Get health status with checks"""
        metrics = self.get_metrics()
        
        # Health checks
        checks = {
            'error_rate': {
                'status': 'healthy' if metrics['requests']['error_rate'] < 0.05 else 'unhealthy',
                'value': metrics['requests']['error_rate'],
                'threshold': 0.05,
            },
            'average_response_time': {
                'status': 'healthy' if metrics['performance']['average_response_time'] < 2.0 else 'degraded',
                'value': metrics['performance']['average_response_time'],
                'threshold': 2.0,
            },
            'security_events': {
                'status': 'healthy' if metrics['security']['rate_limit_violations'] < 100 else 'warning',
                'value': metrics['security']['rate_limit_violations'],
                'threshold': 100,
            },
        }
        
        # Overall status
        statuses = [check['status'] for check in checks.values()]
        if 'unhealthy' in statuses:
            overall_status = 'unhealthy'
        elif 'degraded' in statuses or 'warning' in statuses:
            overall_status = 'degraded'
        else:
            overall_status = 'healthy'
        
        return {
            'status': overall_status,
            'checks': checks,
            'metrics': metrics,
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }
    
    def reset_metrics(self):
        """Reset metrics (for periodic reporting)"""
        self.metrics = Metrics()
        self.request_times.clear()
        self.error_counts.clear()
    
    @staticmethod
    def _percentile(data: list, percentile: int) -> float:
        """Calculate percentile"""
        if not data:
            return 0.0
        sorted_data = sorted(data)
        index = int(len(sorted_data) * percentile / 100)
        return sorted_data[min(index, len(sorted_data) - 1)]


# Global metrics collector
metrics_collector = MetricsCollector()


def get_metrics() -> Dict[str, Any]:
    """Get current metrics"""
    return metrics_collector.get_metrics()


def get_health() -> Dict[str, Any]:
    """Get health status"""
    return metrics_collector.get_health_status()


# Context manager for timing requests
class RequestTimer:
    """Context manager for timing requests"""
    
    def __init__(self, endpoint: str):
        self.endpoint = endpoint
        self.start_time = None
        self.status_code = 200
    
    def __enter__(self):
        self.start_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = time.time() - self.start_time
        if exc_type is not None:
            self.status_code = 500
        metrics_collector.record_request(self.endpoint, duration, self.status_code)
    
    def set_status(self, status_code: int):
        """Set response status code"""
        self.status_code = status_code


# Example usage:
"""
from backend.monitoring import metrics_collector, RequestTimer, get_health

# Time a request
with RequestTimer('/api/upload') as timer:
    # Process request
    result = process_upload()
    timer.set_status(200)

# Record metrics
metrics_collector.record_upload(success=True, file_size=1024000)
metrics_collector.record_job(success=True, processing_time=5.2)
metrics_collector.record_security_event('rate_limit')

# Get health status
health = get_health()
if health['status'] != 'healthy':
    send_alert(health)
"""

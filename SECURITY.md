# Security Documentation

## 🔒 Security Overview

The Tax Deduction Analyzer is built with security and privacy as core principles. This document outlines the security measures implemented and best practices for maintaining a secure deployment.

## 🛡️ Security Architecture

### Defense in Depth

The application implements multiple layers of security:

1. **Network Layer**
   - HTTPS only (TLS 1.2+)
   - HSTS headers
   - CORS restrictions

2. **Application Layer**
   - Input validation
   - Output encoding
   - Rate limiting
   - Authentication (optional)

3. **Data Layer**
   - Ephemeral mode by default
   - Automatic redaction
   - Minimal data retention
   - Encrypted storage (if persistent)

## 🔐 Security Features

### 1. Privacy by Default

**Ephemeral Mode**
- Raw CSV data never written to disk
- All processing in memory
- Automatic cleanup after report generation
- No persistent transaction data

**Data Redaction**
- Automatic detection and redaction of:
  - Account numbers (pattern: `\d{6}-\d{6,10}`)
  - BSB codes (pattern: `\d{3}-\d{3}`)
  - Custom patterns (configurable)
- Applied to all report outputs (PDF, CSV, JSON)

### 2. Input Validation

**File Upload Security**
- File type validation (CSV only)
- File size limits (default: 10MB)
- Content validation
- Malicious pattern detection

**Request Validation**
- SQL injection prevention
- XSS prevention
- Path traversal prevention
- Command injection prevention

### 3. Rate Limiting

**Per-IP Limits**
- 10 requests per minute
- 100 requests per hour
- 100MB uploads per hour
- Configurable thresholds

**Protection Against**
- Brute force attacks
- DoS attacks
- Resource exhaustion
- Abuse

### 4. Security Headers

**Implemented Headers**
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### 5. CORS Protection

**Strict Origin Policy**
- Whitelist-based origins
- No wildcard origins in production
- Credentials disabled by default
- Short cache duration (10 minutes)

### 6. Authentication & Authorization

**Optional API Key Authentication**
- Header-based API keys
- Multiple key support
- Key rotation capability
- Exempt paths for health checks

### 7. Secure Session Management

**Job ID Security**
- Cryptographically secure random IDs (128-bit)
- No predictable patterns
- Short-lived sessions (30 minutes default)
- Automatic cleanup

## 🔍 Security Testing

### Automated Tests

**Property-Based Tests**
- 23 property tests covering security-critical functions
- Fuzzing for edge cases
- Input validation testing

**Unit Tests**
- 216 backend tests
- 118 frontend tests
- 97% code coverage

### Manual Security Testing

**Recommended Tools**
- OWASP ZAP
- Burp Suite
- SQLMap
- Nikto

**Test Areas**
- Authentication bypass
- Authorization flaws
- Input validation
- Session management
- CSRF protection
- XSS vulnerabilities
- SQL injection
- File upload vulnerabilities

## 🚨 Vulnerability Management

### Dependency Scanning

**Backend (Python)**
```bash
# Check for known vulnerabilities
pip-audit

# Update dependencies
pip install --upgrade -r requirements.txt
```

**Frontend (Node.js)**
```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Update dependencies
npm update
```

### Regular Updates

- Weekly: Review security advisories
- Monthly: Update dependencies
- Quarterly: Full security audit
- Annually: Penetration testing

## 🔒 Data Protection

### Data Classification

**Sensitive Data (Never Stored)**
- Account numbers
- BSB codes
- Full transaction descriptions
- Personal identifying information

**Derived Data (Optionally Stored)**
- Merchant names (extracted)
- Categories (classified)
- Confidence scores
- Flags

**Metadata (Stored)**
- Job IDs
- Timestamps
- Status
- Income year

### Data Retention

**Ephemeral Mode (Default)**
- 0 days retention
- Immediate cleanup
- Memory-only processing

**Persistent Mode (Optional)**
- 30 days default retention
- Configurable per deployment
- Automatic cleanup
- User-controlled per upload

### Data Encryption

**In Transit**
- TLS 1.2+ required
- Strong cipher suites
- HSTS enforcement

**At Rest (If Persistent Mode)**
- Database encryption recommended
- File system encryption recommended
- Encrypted backups

## 🛠️ Security Configuration

### Environment Variables

**Critical Security Variables**
```env
# REQUIRED - Strong secret key
SECRET_KEY=<32+ character random string>

# REQUIRED - Specific origins only
ALLOWED_ORIGINS=https://yourdomain.com

# RECOMMENDED - Enable all security features
RATE_LIMIT_ENABLED=true
ENABLE_REDACTION=true
EPHEMERAL_MODE=true

# OPTIONAL - Additional security
REQUIRE_API_KEY=false
API_KEYS=<comma-separated keys>
```

### Security Hardening Checklist

**Backend**
- [ ] Strong SECRET_KEY set (32+ characters)
- [ ] ALLOWED_ORIGINS configured (no wildcards)
- [ ] Rate limiting enabled
- [ ] Redaction enabled
- [ ] Ephemeral mode enabled
- [ ] HTTPS enforced
- [ ] Debug mode disabled
- [ ] Swagger UI disabled in production
- [ ] Error messages sanitized
- [ ] Logging configured (no sensitive data)

**Frontend**
- [ ] HTTPS enforced
- [ ] Security headers configured
- [ ] CSP policy strict
- [ ] Analytics disabled (privacy)
- [ ] Error reporting configured
- [ ] API URL uses HTTPS
- [ ] No secrets in environment variables
- [ ] Source maps disabled in production

**Infrastructure**
- [ ] Firewall configured
- [ ] DDoS protection enabled
- [ ] Monitoring active
- [ ] Backups configured (if persistent)
- [ ] Logs centralized
- [ ] Alerts configured
- [ ] Incident response plan documented

## 🔐 Secure Development Practices

### Code Review

**Security Focus Areas**
- Input validation
- Output encoding
- Authentication/authorization
- Session management
- Cryptography usage
- Error handling
- Logging (no sensitive data)

### Secure Coding Guidelines

**Input Validation**
```python
# ✅ Good - Validate and sanitize
def process_amount(amount_str: str) -> Decimal:
    if not amount_str or len(amount_str) > 20:
        raise ValueError("Invalid amount")
    return Decimal(amount_str)

# ❌ Bad - No validation
def process_amount(amount_str: str) -> Decimal:
    return Decimal(amount_str)
```

**SQL Injection Prevention**
```python
# ✅ Good - Parameterized queries
cursor.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,))

# ❌ Bad - String concatenation
cursor.execute(f"SELECT * FROM jobs WHERE job_id = '{job_id}'")
```

**XSS Prevention**
```python
# ✅ Good - Escape output
from html import escape
safe_description = escape(transaction.description)

# ❌ Bad - Raw output
unsafe_description = transaction.description
```

## 📊 Security Monitoring

### Key Security Metrics

**Monitor For**
- Failed authentication attempts
- Rate limit violations
- Unusual upload patterns
- Large file uploads
- Suspicious request patterns
- Error rate spikes
- Slow response times

### Alerting Thresholds

**Critical Alerts**
- 10+ failed auth attempts in 1 minute
- 100+ rate limit violations in 1 hour
- Error rate > 5%
- Response time > 5 seconds

**Warning Alerts**
- 5+ failed auth attempts in 1 minute
- 50+ rate limit violations in 1 hour
- Error rate > 2%
- Response time > 2 seconds

### Log Analysis

**What to Log**
- Request timestamps
- IP addresses
- Endpoints accessed
- Response codes
- Error messages (sanitized)
- Rate limit violations

**What NOT to Log**
- Passwords or secrets
- API keys
- Session tokens
- Transaction details
- Account numbers
- Personal information

## 🚨 Incident Response

### Security Incident Types

1. **Data Breach**
   - Unauthorized access to data
   - Data exfiltration
   - Database compromise

2. **Service Disruption**
   - DoS/DDoS attack
   - Resource exhaustion
   - System compromise

3. **Authentication Bypass**
   - Unauthorized access
   - Privilege escalation
   - Session hijacking

### Response Procedures

**Immediate Actions (0-1 hour)**
1. Identify and contain the incident
2. Disable affected services if necessary
3. Preserve evidence (logs, snapshots)
4. Notify security team

**Short-term Actions (1-24 hours)**
1. Investigate root cause
2. Assess impact and data exposure
3. Implement temporary fixes
4. Rotate compromised credentials
5. Document timeline

**Long-term Actions (1-7 days)**
1. Implement permanent fixes
2. Update security configurations
3. Conduct post-mortem
4. Update documentation
5. Notify affected users (if required)

### Communication Plan

**Internal**
- Security team
- Development team
- Management
- Legal (if required)

**External**
- Affected users
- Regulatory bodies (if required)
- Public disclosure (if required)

## 📋 Compliance

### Data Protection

**GDPR Considerations**
- Right to erasure (ephemeral mode supports this)
- Data minimization (only derived fields stored)
- Purpose limitation (tax analysis only)
- Transparency (privacy page explains handling)

**Australian Privacy Principles**
- Collection limitation
- Data quality
- Purpose specification
- Use limitation
- Security safeguards
- Openness
- Individual participation
- Accountability

### Record Keeping

**ATO Requirements**
- 5-year retention guidance provided
- Evidence checklists generated
- Audit trail maintained
- Substantiation notes included

## 🔄 Security Updates

### Update Schedule

**Critical Security Updates**
- Apply immediately (within 24 hours)
- Test in staging first
- Deploy to production
- Monitor for issues

**Regular Updates**
- Weekly: Review security advisories
- Monthly: Update dependencies
- Quarterly: Security audit
- Annually: Penetration test

### Change Management

**Security Changes**
1. Document change
2. Review security impact
3. Test in staging
4. Deploy to production
5. Monitor and verify
6. Update documentation

## 📞 Security Contacts

### Reporting Security Issues

**Email**: security@yourdomain.com

**PGP Key**: [Your PGP Key]

**Response Time**: Within 24 hours

### Responsible Disclosure

We appreciate responsible disclosure of security vulnerabilities:

1. Report via security@yourdomain.com
2. Allow 90 days for fix before public disclosure
3. Provide detailed reproduction steps
4. Receive acknowledgment and updates

### Bug Bounty

[If applicable, describe bug bounty program]

## 📚 Security Resources

### Standards & Frameworks
- OWASP Top 10
- NIST Cybersecurity Framework
- CIS Controls
- ISO 27001

### Tools & Services
- OWASP ZAP
- Burp Suite
- Snyk
- Dependabot
- Security Headers
- SSL Labs

### Training
- OWASP WebGoat
- HackTheBox
- TryHackMe
- PortSwigger Web Security Academy

## ✅ Security Audit Checklist

### Pre-Deployment Audit
- [ ] All security configurations reviewed
- [ ] Secrets properly managed
- [ ] HTTPS enforced
- [ ] Security headers configured
- [ ] Rate limiting tested
- [ ] Input validation tested
- [ ] Authentication tested (if enabled)
- [ ] CORS policy verified
- [ ] Error handling reviewed
- [ ] Logging configured properly

### Post-Deployment Audit
- [ ] Security headers verified (securityheaders.com)
- [ ] SSL configuration tested (ssllabs.com)
- [ ] CORS policy tested
- [ ] Rate limiting verified
- [ ] File upload security tested
- [ ] Error messages sanitized
- [ ] Monitoring active
- [ ] Alerts configured
- [ ] Backup tested (if persistent)
- [ ] Incident response plan documented

### Ongoing Audits
- [ ] Weekly log review
- [ ] Monthly dependency updates
- [ ] Quarterly security scan
- [ ] Annual penetration test
- [ ] Continuous monitoring
- [ ] Regular training
- [ ] Documentation updates
- [ ] Compliance reviews

---

**Last Updated**: 2024
**Version**: 1.0.0
**Maintained By**: [Your Team]

# Deployment Checklist - Tax Deduction Analyzer

Use this checklist to ensure a secure and successful deployment to Netlify and your chosen backend platform.

## 📋 Pre-Deployment Checklist

### Security Configuration

#### Backend Security
- [ ] Generate strong SECRET_KEY (32+ characters)
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  ```
- [ ] Configure ALLOWED_ORIGINS with your Netlify domain
- [ ] Set ENVIRONMENT=production
- [ ] Enable RATE_LIMIT_ENABLED=true
- [ ] Enable ENABLE_REDACTION=true
- [ ] Set EPHEMERAL_MODE=true (recommended)
- [ ] Disable ENABLE_SWAGGER_UI=false
- [ ] Review all environment variables in `.env.example`

#### Frontend Security
- [ ] Set VITE_API_BASE_URL to your backend API (HTTPS only)
- [ ] Set VITE_ENABLE_ANALYTICS=false (privacy)
- [ ] Set VITE_ENVIRONMENT=production
- [ ] Verify VITE_MAX_FILE_SIZE_MB matches backend

#### Infrastructure
- [ ] HTTPS enabled on both frontend and backend
- [ ] Firewall rules configured
- [ ] DDoS protection enabled (if available)
- [ ] Monitoring tools set up
- [ ] Backup strategy defined (if using persistent mode)

### Code Quality
- [ ] All tests passing (backend: 216 tests, frontend: 118 tests)
- [ ] No console.log statements in production code
- [ ] No commented-out code
- [ ] No TODO comments for critical features
- [ ] Code reviewed for security issues
- [ ] Dependencies updated to latest secure versions

### Documentation
- [ ] README.md reviewed and updated
- [ ] DEPLOYMENT.md reviewed
- [ ] SECURITY.md reviewed
- [ ] API documentation complete
- [ ] Environment variables documented

## 🚀 Netlify Frontend Deployment

### Step 1: Prepare Repository
- [ ] Code pushed to GitHub/GitLab
- [ ] `.gitignore` includes `.env` files
- [ ] `netlify.toml` configured
- [ ] Build tested locally (`npm run build`)

### Step 2: Create Netlify Site
- [ ] Log in to Netlify
- [ ] Click "New site from Git"
- [ ] Connect repository
- [ ] Configure build settings:
  - Build command: `npm run build`
  - Publish directory: `dist`
  - Base directory: `frontend`

### Step 3: Configure Environment Variables
Navigate to Site Settings → Environment Variables and add:

```
VITE_API_BASE_URL=https://your-backend-api.com
VITE_MAX_FILE_SIZE_MB=10
VITE_ENABLE_ANALYTICS=false
VITE_ENVIRONMENT=production
VITE_APP_VERSION=1.0.0
```

- [ ] All environment variables added
- [ ] Values verified (no typos)
- [ ] API URL uses HTTPS

### Step 4: Deploy
- [ ] Trigger deployment
- [ ] Monitor build logs for errors
- [ ] Verify deployment successful
- [ ] Test site accessibility

### Step 5: Configure Custom Domain (Optional)
- [ ] Add custom domain in Netlify
- [ ] Configure DNS records
- [ ] Wait for DNS propagation
- [ ] Verify HTTPS certificate issued
- [ ] Test custom domain access

### Step 6: Verify Security Headers
Test your deployment:
- [ ] Visit https://securityheaders.com/?q=your-site.netlify.app
- [ ] Verify A+ rating or address issues
- [ ] Check all security headers present:
  - [ ] Strict-Transport-Security
  - [ ] Content-Security-Policy
  - [ ] X-Content-Type-Options
  - [ ] X-Frame-Options
  - [ ] X-XSS-Protection
  - [ ] Referrer-Policy
  - [ ] Permissions-Policy

## 🖥️ Backend Deployment

### Option A: Railway

#### Step 1: Prepare
- [ ] Install Railway CLI: `npm install -g @railway/cli`
- [ ] Login: `railway login`
- [ ] Initialize project: `railway init`

#### Step 2: Configure Environment Variables
```bash
railway variables set SECRET_KEY="your-secret-key-here"
railway variables set ALLOWED_ORIGINS="https://your-site.netlify.app"
railway variables set ENVIRONMENT="production"
railway variables set RATE_LIMIT_ENABLED="true"
railway variables set EPHEMERAL_MODE="true"
railway variables set ENABLE_REDACTION="true"
railway variables set ENABLE_SWAGGER_UI="false"
railway variables set MAX_UPLOAD_SIZE_MB="10"
railway variables set RATE_LIMIT_PER_MINUTE="10"
railway variables set RATE_LIMIT_PER_HOUR="100"
```

- [ ] All variables set
- [ ] Values verified

#### Step 3: Deploy
- [ ] Run: `railway up`
- [ ] Monitor deployment logs
- [ ] Get backend URL: `railway domain`
- [ ] Test health endpoint: `curl https://your-backend.railway.app/health`

### Option B: Render

#### Step 1: Create Web Service
- [ ] Go to Render Dashboard
- [ ] Click "New +" → "Web Service"
- [ ] Connect repository
- [ ] Configure:
  - Name: tax-deduction-analyzer-api
  - Environment: Python 3
  - Build Command: `pip install -r requirements.txt`
  - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
  - Root Directory: `backend`

#### Step 2: Add Environment Variables
- [ ] Add all variables from `.env.example`
- [ ] Verify values

#### Step 3: Deploy
- [ ] Trigger deployment
- [ ] Monitor logs
- [ ] Test health endpoint

### Option C: Docker (Any Platform)

#### Step 1: Build Image
```bash
cd backend
docker build -t tax-deduction-analyzer-backend .
```

- [ ] Build successful
- [ ] Test locally: `docker run -p 8000:8000 --env-file .env tax-deduction-analyzer-backend`

#### Step 2: Push to Registry
- [ ] Tag image for your registry
- [ ] Push to registry
- [ ] Verify image available

#### Step 3: Deploy to Platform
- [ ] Deploy container to your chosen platform
- [ ] Configure environment variables
- [ ] Test deployment

## 🔗 Connect Frontend to Backend

### Update Frontend Environment
- [ ] Update VITE_API_BASE_URL in Netlify with backend URL
- [ ] Trigger frontend redeploy
- [ ] Verify connection working

### Update Backend CORS
- [ ] Update ALLOWED_ORIGINS with Netlify URL
- [ ] Redeploy backend
- [ ] Test CORS working

## ✅ Post-Deployment Verification

### Functional Testing
- [ ] Frontend loads successfully
- [ ] Upload page accessible
- [ ] File upload works
- [ ] CSV processing completes
- [ ] Reports generate successfully
- [ ] PDF download works
- [ ] CSV download works
- [ ] JSON download works
- [ ] All pages accessible
- [ ] Navigation works

### Security Testing

#### HTTPS
- [ ] Frontend uses HTTPS
- [ ] Backend uses HTTPS
- [ ] HTTP redirects to HTTPS
- [ ] No mixed content warnings

#### Headers
- [ ] Security headers present (use securityheaders.com)
- [ ] CSP policy working (no console errors)
- [ ] HSTS header present
- [ ] X-Frame-Options prevents embedding

#### CORS
- [ ] Frontend can access backend API
- [ ] Other origins blocked
- [ ] Preflight requests working

#### Rate Limiting
- [ ] Rate limits enforced
- [ ] 429 status returned when exceeded
- [ ] Retry-After header present

#### Input Validation
- [ ] File type validation works
- [ ] File size validation works
- [ ] Invalid CSV rejected
- [ ] XSS attempts blocked
- [ ] SQL injection attempts blocked

#### Data Protection
- [ ] Ephemeral mode working (no data persisted)
- [ ] Redaction working (account numbers hidden)
- [ ] Reports don't contain sensitive data
- [ ] Job IDs are random and unpredictable

### Performance Testing
- [ ] Page load time < 3 seconds
- [ ] API response time < 500ms
- [ ] Upload processing time reasonable
- [ ] Report generation time reasonable
- [ ] No memory leaks
- [ ] No resource exhaustion

### Monitoring Setup
- [ ] Uptime monitoring configured
- [ ] Error tracking configured
- [ ] Log aggregation configured
- [ ] Alerts configured for:
  - [ ] Service downtime
  - [ ] High error rate
  - [ ] Rate limit violations
  - [ ] Slow response times

## 📊 Post-Launch Monitoring

### First 24 Hours
- [ ] Monitor error rates
- [ ] Check response times
- [ ] Review logs for issues
- [ ] Verify rate limiting working
- [ ] Check resource usage

### First Week
- [ ] Daily log reviews
- [ ] Performance monitoring
- [ ] User feedback collection
- [ ] Security incident monitoring
- [ ] Backup verification (if persistent mode)

### Ongoing
- [ ] Weekly log reviews
- [ ] Monthly security audits
- [ ] Quarterly penetration testing
- [ ] Regular dependency updates
- [ ] Performance optimization

## 🚨 Rollback Plan

### If Issues Detected
1. [ ] Document the issue
2. [ ] Assess severity
3. [ ] Decide: fix forward or rollback

### Rollback Procedure
#### Frontend (Netlify)
- [ ] Go to Deploys tab
- [ ] Find last working deployment
- [ ] Click "Publish deploy"

#### Backend
- [ ] Revert to previous version
- [ ] Redeploy
- [ ] Verify working

## 📝 Documentation Updates

### Post-Deployment
- [ ] Update README with live URLs
- [ ] Document any deployment-specific configurations
- [ ] Update API documentation with live endpoint
- [ ] Create runbook for common operations
- [ ] Document monitoring dashboards

## 🎉 Launch Announcement

### Before Announcing
- [ ] All tests passing
- [ ] Security verified
- [ ] Performance acceptable
- [ ] Monitoring active
- [ ] Support channels ready

### Announcement Checklist
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] Support email configured
- [ ] Documentation accessible
- [ ] Feedback mechanism in place

## 📞 Support Contacts

### Technical Issues
- Email: support@yourdomain.com
- Response Time: 24 hours

### Security Issues
- Email: security@yourdomain.com
- Response Time: Immediate

### Emergency Contacts
- On-call engineer: [Phone]
- Backup contact: [Phone]

---

## ✅ Final Sign-Off

Deployment completed by: _______________
Date: _______________
Verified by: _______________
Date: _______________

All checklist items completed: [ ]
Ready for production traffic: [ ]
Monitoring confirmed active: [ ]
Rollback plan tested: [ ]

**Deployment Status**: [ ] Success [ ] Issues [ ] Rolled Back

**Notes**:
_____________________________________________
_____________________________________________
_____________________________________________

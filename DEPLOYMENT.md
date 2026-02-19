# Deployment Guide - Tax Deduction Analyzer

This guide covers secure deployment of the Tax Deduction Analyzer to Netlify (frontend) and various backend hosting options.

## 🔒 Security Checklist

Before deploying, ensure you have:

- [ ] Generated a strong SECRET_KEY (32+ characters)
- [ ] Configured ALLOWED_ORIGINS with your domain
- [ ] Enabled HTTPS on both frontend and backend
- [ ] Set up rate limiting
- [ ] Enabled data redaction
- [ ] Configured security headers
- [ ] Disabled debug/development features
- [ ] Set up monitoring and logging
- [ ] Reviewed and tested all security configurations
- [ ] Created backup strategy (if using persistent mode)

## 📦 Frontend Deployment (Netlify)

### Prerequisites
- Netlify account
- GitHub/GitLab repository (optional but recommended)
- Domain name (optional)

### Step 1: Prepare Frontend

```bash
cd frontend

# Install dependencies
npm install

# Create production environment file
cp .env.example .env

# Edit .env with your backend API URL
# VITE_API_BASE_URL=https://your-backend-api.com
```

### Step 2: Test Build Locally

```bash
# Build for production
npm run build

# Test the build
npm run preview
```

### Step 3: Deploy to Netlify

#### Option A: Deploy via Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize site
netlify init

# Deploy
netlify deploy --prod
```

#### Option B: Deploy via Git Integration

1. Push your code to GitHub/GitLab
2. Go to [Netlify](https://app.netlify.com)
3. Click "New site from Git"
4. Connect your repository
5. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Base directory**: `frontend`

### Step 4: Configure Environment Variables in Netlify

1. Go to Site Settings → Environment Variables
2. Add the following variables:

```
VITE_API_BASE_URL=https://your-backend-api.com
VITE_MAX_FILE_SIZE_MB=10
VITE_ENABLE_ANALYTICS=false
VITE_ENVIRONMENT=production
```

### Step 5: Configure Custom Domain (Optional)

1. Go to Domain Settings
2. Add your custom domain
3. Configure DNS records as instructed
4. Enable HTTPS (automatic with Netlify)

### Step 6: Verify Security Headers

After deployment, verify security headers using:
- [Security Headers](https://securityheaders.com/)
- [Mozilla Observatory](https://observatory.mozilla.org/)

Expected headers:
- ✅ Strict-Transport-Security
- ✅ Content-Security-Policy
- ✅ X-Content-Type-Options
- ✅ X-Frame-Options
- ✅ X-XSS-Protection
- ✅ Referrer-Policy
- ✅ Permissions-Policy

## 🖥️ Backend Deployment Options

### Option 1: Railway (Recommended for Simplicity)

Railway provides easy Python deployment with automatic HTTPS.

#### Step 1: Prepare Backend

```bash
cd backend

# Create production environment file
cp .env.example .env

# Generate SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Edit .env with production values
```

#### Step 2: Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add environment variables
railway variables set SECRET_KEY="your-secret-key"
railway variables set ALLOWED_ORIGINS="https://your-netlify-site.netlify.app"
railway variables set ENVIRONMENT="production"
railway variables set RATE_LIMIT_ENABLED="true"
railway variables set EPHEMERAL_MODE="true"
railway variables set ENABLE_REDACTION="true"

# Deploy
railway up
```

#### Step 3: Get Backend URL

```bash
railway domain
```

Use this URL as `VITE_API_BASE_URL` in your Netlify environment variables.

### Option 2: Render

#### Step 1: Create Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your repository
4. Configure:
   - **Name**: tax-deduction-analyzer-api
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Root Directory**: `backend`

#### Step 2: Add Environment Variables

Add all variables from `.env.example` with production values.

#### Step 3: Deploy

Render will automatically deploy on git push.

### Option 3: Docker Deployment (Any Platform)

#### Step 1: Build Docker Image

```bash
cd backend

# Build image
docker build -t tax-deduction-analyzer-backend .

# Test locally
docker run -p 8000:8000 --env-file .env tax-deduction-analyzer-backend
```

#### Step 2: Push to Container Registry

```bash
# Tag for your registry
docker tag tax-deduction-analyzer-backend your-registry/tax-deduction-analyzer-backend:latest

# Push
docker push your-registry/tax-deduction-analyzer-backend:latest
```

#### Step 3: Deploy to Your Platform

Deploy the container to:
- AWS ECS/Fargate
- Google Cloud Run
- Azure Container Instances
- DigitalOcean App Platform
- Fly.io

### Option 4: AWS Lambda (Serverless)

#### Step 1: Install Mangum

```bash
pip install mangum
```

#### Step 2: Update main.py

```python
from mangum import Mangum

# ... existing FastAPI app code ...

# Add Lambda handler
handler = Mangum(app)
```

#### Step 3: Deploy with AWS SAM or Serverless Framework

See AWS Lambda documentation for detailed deployment steps.

## 🔐 Post-Deployment Security Configuration

### 1. Configure CORS

Update backend `.env`:
```env
ALLOWED_ORIGINS=https://your-site.netlify.app,https://www.yourdomain.com
```

### 2. Enable Rate Limiting

```env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PER_MINUTE=10
RATE_LIMIT_PER_HOUR=100
```

### 3. Configure Monitoring

Set up monitoring for:
- API response times
- Error rates
- Rate limit violations
- Upload volumes
- Storage usage (if using persistent mode)

### 4. Set Up Logging

Configure centralized logging:
- Papertrail
- Loggly
- CloudWatch (AWS)
- Stackdriver (GCP)

### 5. Configure Backups (If Using Persistent Mode)

Set up automated backups for:
- Database
- Configuration files
- Generated reports (if stored)

## 🧪 Testing Deployment

### Frontend Tests

```bash
# Test from browser
https://your-site.netlify.app

# Check security headers
curl -I https://your-site.netlify.app

# Test upload flow
# 1. Navigate to upload page
# 2. Upload sample CSV
# 3. Verify report generation
# 4. Download reports
```

### Backend Tests

```bash
# Health check
curl https://your-backend-api.com/health

# Test upload endpoint
curl -X POST https://your-backend-api.com/api/upload \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample.csv" \
  -F "income_year=2023-2024" \
  -F "ephemeral_mode=true"

# Check rate limiting
for i in {1..15}; do
  curl https://your-backend-api.com/health
done
```

### Security Tests

```bash
# Test HTTPS redirect
curl -I http://your-site.netlify.app

# Test security headers
curl -I https://your-site.netlify.app | grep -E "(Strict-Transport|Content-Security|X-Frame)"

# Test CORS
curl -H "Origin: https://malicious-site.com" \
  -I https://your-backend-api.com/api/upload

# Test rate limiting
# Should return 429 after limit exceeded
```

## 📊 Monitoring & Maintenance

### Key Metrics to Monitor

1. **Performance**
   - API response time (target: <500ms)
   - Upload processing time
   - Report generation time

2. **Security**
   - Failed authentication attempts
   - Rate limit violations
   - Suspicious request patterns
   - File upload anomalies

3. **Usage**
   - Daily active users
   - Upload volume
   - Report downloads
   - Error rates

### Regular Maintenance Tasks

- [ ] Weekly: Review logs for errors and security issues
- [ ] Weekly: Check disk usage (if using persistent mode)
- [ ] Monthly: Update dependencies
- [ ] Monthly: Review and rotate API keys
- [ ] Quarterly: Security audit
- [ ] Quarterly: Performance optimization review
- [ ] Annually: Rotate SECRET_KEY

## 🚨 Incident Response

### If Security Breach Suspected

1. **Immediate Actions**
   - Disable affected services
   - Rotate all secrets (SECRET_KEY, API keys)
   - Review logs for unauthorized access
   - Notify users if data compromised

2. **Investigation**
   - Identify breach vector
   - Assess data exposure
   - Document timeline

3. **Remediation**
   - Patch vulnerabilities
   - Update security configurations
   - Implement additional monitoring

4. **Post-Incident**
   - Conduct post-mortem
   - Update security procedures
   - Implement preventive measures

## 📞 Support & Resources

### Documentation
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [Netlify Security](https://docs.netlify.com/security/secure-access-to-sites/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

### Security Tools
- [Security Headers](https://securityheaders.com/)
- [SSL Labs](https://www.ssllabs.com/ssltest/)
- [Mozilla Observatory](https://observatory.mozilla.org/)

### Monitoring Services
- [UptimeRobot](https://uptimerobot.com/)
- [Pingdom](https://www.pingdom.com/)
- [Datadog](https://www.datadoghq.com/)

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Security configuration reviewed
- [ ] Environment variables configured
- [ ] HTTPS enabled
- [ ] Rate limiting configured
- [ ] Monitoring set up
- [ ] Backup strategy in place

### Post-Deployment
- [ ] Frontend accessible via HTTPS
- [ ] Backend API responding
- [ ] Upload flow working
- [ ] Report generation working
- [ ] Security headers verified
- [ ] Rate limiting tested
- [ ] Monitoring active
- [ ] Documentation updated

### Ongoing
- [ ] Regular security audits
- [ ] Dependency updates
- [ ] Log monitoring
- [ ] Performance optimization
- [ ] User feedback collection

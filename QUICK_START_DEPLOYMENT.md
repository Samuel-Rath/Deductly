# Quick Start: Deploy to Netlify in 15 Minutes

This guide will get your Tax Deduction Analyzer deployed to Netlify (frontend) and Railway (backend) in about 15 minutes.

## Prerequisites

- GitHub account
- Netlify account (free tier works)
- Railway account (free tier works)
- Your code pushed to GitHub

## Step 1: Deploy Backend to Railway (5 minutes)

### 1.1 Install Railway CLI
```bash
npm install -g @railway/cli
```

### 1.2 Login and Initialize
```bash
railway login
cd backend
railway init
```

### 1.3 Generate Secret Key
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```
Copy the output - you'll need it in the next step.

### 1.4 Set Environment Variables
```bash
# Replace YOUR_SECRET_KEY with the key from step 1.3
railway variables set SECRET_KEY="YOUR_SECRET_KEY"

# We'll update this after deploying frontend
railway variables set ALLOWED_ORIGINS="http://localhost:5173"

# Security settings
railway variables set ENVIRONMENT="production"
railway variables set RATE_LIMIT_ENABLED="true"
railway variables set EPHEMERAL_MODE="true"
railway variables set ENABLE_REDACTION="true"
railway variables set ENABLE_SWAGGER_UI="false"
railway variables set MAX_UPLOAD_SIZE_MB="10"
```

### 1.5 Deploy
```bash
railway up
```

### 1.6 Get Your Backend URL
```bash
railway domain
```
Copy this URL - you'll need it for the frontend.

Example: `https://your-app.railway.app`

## Step 2: Deploy Frontend to Netlify (5 minutes)

### 2.1 Connect Repository
1. Go to [Netlify](https://app.netlify.com)
2. Click "New site from Git"
3. Choose GitHub
4. Select your repository
5. Configure build settings:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`

### 2.2 Set Environment Variables
Before deploying, go to Site Settings → Environment Variables and add:

```
VITE_API_BASE_URL=https://your-app.railway.app
VITE_MAX_FILE_SIZE_MB=10
VITE_ENABLE_ANALYTICS=false
VITE_ENVIRONMENT=production
```

Replace `https://your-app.railway.app` with your Railway URL from Step 1.6.

### 2.3 Deploy
Click "Deploy site" - Netlify will build and deploy automatically.

### 2.4 Get Your Frontend URL
After deployment completes, copy your Netlify URL.

Example: `https://your-site.netlify.app`

## Step 3: Update Backend CORS (2 minutes)

Now that you have your Netlify URL, update the backend to allow requests from it:

```bash
cd backend
railway variables set ALLOWED_ORIGINS="https://your-site.netlify.app"
```

Railway will automatically redeploy with the new settings.

## Step 4: Verify Deployment (3 minutes)

### 4.1 Test Backend
```bash
curl https://your-app.railway.app/health
```

Should return: `{"status":"healthy","timestamp":"..."}`

### 4.2 Test Frontend
1. Visit your Netlify URL: `https://your-site.netlify.app`
2. You should see the landing page
3. Click "Get Started" or navigate to Upload
4. Try uploading a sample CSV file

### 4.3 Test Security Headers
Visit: `https://securityheaders.com/?q=your-site.netlify.app`

You should see an A or A+ rating.

## Step 5: Optional - Custom Domain

### 5.1 Add Domain to Netlify
1. Go to Domain Settings in Netlify
2. Click "Add custom domain"
3. Follow DNS configuration instructions
4. Wait for HTTPS certificate (automatic)

### 5.2 Update Backend CORS
```bash
railway variables set ALLOWED_ORIGINS="https://your-site.netlify.app,https://yourdomain.com"
```

## 🎉 You're Done!

Your Tax Deduction Analyzer is now live with:
- ✅ HTTPS enabled
- ✅ Security headers configured
- ✅ Rate limiting active
- ✅ Data redaction enabled
- ✅ Ephemeral mode (privacy-first)

## 🔐 Security Checklist

Verify these security features are working:

- [ ] Frontend loads over HTTPS
- [ ] Backend API uses HTTPS
- [ ] File upload works
- [ ] Reports generate successfully
- [ ] Security headers present (check securityheaders.com)
- [ ] Rate limiting works (try 15+ rapid requests)
- [ ] CORS blocks unauthorized origins

## 📊 Monitoring

Set up basic monitoring:

1. **Uptime Monitoring**
   - Use [UptimeRobot](https://uptimerobot.com/) (free)
   - Monitor both frontend and backend `/health` endpoint

2. **Error Tracking**
   - Check Railway logs: `railway logs`
   - Check Netlify deploy logs in dashboard

## 🚨 If Something Goes Wrong

### Backend Issues
```bash
# Check logs
railway logs

# Check environment variables
railway variables

# Restart service
railway restart
```

### Frontend Issues
1. Go to Netlify dashboard
2. Click on your site
3. Go to "Deploys" tab
4. Check build logs
5. If needed, trigger redeploy

### CORS Issues
Make sure `ALLOWED_ORIGINS` in Railway includes your Netlify URL:
```bash
railway variables set ALLOWED_ORIGINS="https://your-site.netlify.app"
```

## 📚 Next Steps

1. **Review Full Documentation**
   - Read `DEPLOYMENT.md` for detailed instructions
   - Review `SECURITY.md` for security features
   - Check `DEPLOYMENT_CHECKLIST.md` for comprehensive verification

2. **Set Up Monitoring**
   - Configure uptime monitoring
   - Set up error alerts
   - Monitor usage patterns

3. **Customize**
   - Add your branding
   - Customize rules in `backend/config/rules.json`
   - Update privacy policy
   - Add support contact information

4. **Test Thoroughly**
   - Upload various CSV formats
   - Test with different file sizes
   - Verify all report formats work
   - Test on different devices/browsers

## 💡 Tips

- **Free Tier Limits**: Both Railway and Netlify free tiers are generous for testing
- **Upgrade When Ready**: Consider paid plans for production use
- **Monitor Usage**: Keep an eye on bandwidth and compute usage
- **Regular Updates**: Update dependencies monthly for security
- **Backup Strategy**: If using persistent mode, set up backups

## 📞 Need Help?

- **Documentation**: Check `README.md`, `DEPLOYMENT.md`, `SECURITY.md`
- **Issues**: Review Railway and Netlify logs
- **Security**: Read `SECURITY.md` for security features
- **Checklist**: Use `DEPLOYMENT_CHECKLIST.md` for verification

---

**Deployment Time**: ~15 minutes
**Difficulty**: Easy
**Cost**: Free (with free tier limits)
**Security**: Production-ready

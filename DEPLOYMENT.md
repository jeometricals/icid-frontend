# ICID Co. Deployment Guide

This guide walks you through deploying the ICID Co. frontend to Vercel.

## Prerequisites

1. GitHub account with the repository
2. Vercel account (free tier works fine)
3. Supabase project (optional - app works in demo mode)

## Step 1: Prepare Your Repository

Ensure all code is committed and pushed to GitHub:

```bash
git add .
git commit -m "Initial frontend implementation"
git push origin main
```

## Step 2: Deploy to Vercel

### Option A: Using Vercel Dashboard (Recommended)

1. **Go to Vercel**: Visit https://vercel.com and sign in

2. **Import Project**:
   - Click "Add New..." → "Project"
   - Select "Import Git Repository"
   - Choose your GitHub repository

3. **Configure Project**:
   - **Framework Preset**: Vite (should be detected automatically)
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build` (should be pre-filled)
   - **Output Directory**: `dist` (should be pre-filled)

4. **Add Environment Variables** (Optional - for Supabase integration):
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_WEATHER_API_KEY=your_weather_api_key (optional)
   ```

   **Note**: If you don't add these variables, the app will run in demo mode.

5. **Deploy**:
   - Click "Deploy"
   - Wait for the build to complete (usually 1-2 minutes)
   - Your app will be live at `https://your-project.vercel.app`

### Option B: Using Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```

4. **Add Environment Variables**:
   ```bash
   vercel env add VITE_SUPABASE_URL
   vercel env add VITE_SUPABASE_ANON_KEY
   ```

5. **Deploy to Production**:
   ```bash
   vercel --prod
   ```

## Step 3: Verify Deployment

1. Open the deployment URL
2. Test login with demo mode
3. Navigate through the app
4. Test creating a report

## Step 4: Set Up Custom Domain (Optional)

1. Go to your project in Vercel dashboard
2. Navigate to "Settings" → "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

## Continuous Deployment

Vercel automatically deploys:
- **Production**: Pushes to `main` branch
- **Preview**: Pull requests and other branches

## Monitoring and Logs

### View Deployment Logs
1. Go to Vercel dashboard
2. Select your project
3. Click on a deployment
4. View build logs and runtime logs

### Analytics
Vercel provides built-in analytics:
- Page views
- Performance metrics
- User geography

## Troubleshooting

### Build Fails

**Check Node Version**:
- Vercel uses Node 18 by default (specified in `.nvmrc`)
- Ensure your local Node version matches

**Check Build Logs**:
- Look for specific error messages
- Common issues: missing dependencies, syntax errors

### Environment Variables Not Working

1. Verify variable names start with `VITE_`
2. Redeploy after adding/changing variables
3. Check that variables are set for the correct environment (Production/Preview)

### App Loads But Features Don't Work

1. **Check Browser Console**: Look for JavaScript errors
2. **Verify Supabase Connection**: If using Supabase, ensure credentials are correct
3. **Test Demo Mode**: Verify demo mode works (doesn't require Supabase)

### Routing Issues (404 on Refresh)

This should be handled by `vercel.json` rewrites. If issues persist:
1. Verify `vercel.json` exists
2. Check rewrites configuration
3. Redeploy

## Performance Optimization

### Enable Compression
Already configured in `vercel.json` headers.

### Optimize Images
Use Vercel Image Optimization:
```javascript
import Image from 'next/image' // If migrating to Next.js
```

### Caching
Vercel automatically caches static assets.

## Rollback

If deployment fails or has issues:

1. Go to Vercel dashboard
2. Select your project
3. Go to "Deployments"
4. Find a working deployment
5. Click "..." → "Promote to Production"

## Security

### Environment Variables
- Never commit `.env` files
- Use Vercel's environment variables feature
- Rotate Supabase keys if exposed

### HTTPS
- Automatically enabled by Vercel
- Free SSL certificates

## Maintenance

### Update Dependencies
```bash
npm update
npm audit fix
git commit -am "Update dependencies"
git push
```

Vercel will automatically deploy the update.

### Monitor Performance
- Use Vercel Analytics
- Monitor Supabase dashboard for database issues
- Set up error tracking (e.g., Sentry)

## Next Steps

1. **Set up Supabase** (if not already done)
2. **Configure custom domain**
3. **Add team members** in Vercel project settings
4. **Set up error monitoring**
5. **Configure backups** for Supabase

## Support

- **Vercel Docs**: https://vercel.com/docs
- **Vercel Support**: https://vercel.com/support
- **Supabase Docs**: https://supabase.com/docs

## Cost Estimation

### Vercel
- **Free Tier**: 
  - 100GB bandwidth/month
  - Unlimited deployments
  - Perfect for MVP

- **Pro Tier** ($20/month):
  - 1TB bandwidth
  - Advanced analytics
  - Better performance

### Supabase
- **Free Tier**:
  - 500MB database
  - 1GB file storage
  - Good for testing

- **Pro Tier** ($25/month):
  - 8GB database
  - 100GB storage
  - Daily backups

## Checklist

- [ ] Code pushed to GitHub
- [ ] Vercel project created
- [ ] App deployed successfully
- [ ] Demo mode tested
- [ ] Environment variables configured (if using Supabase)
- [ ] Custom domain configured (optional)
- [ ] Team members added
- [ ] Monitoring set up

---

**Deployment Date**: _______________
**Production URL**: _______________
**Deployed By**: _______________

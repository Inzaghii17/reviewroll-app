# ReviewRoll Deployment Checklist — Watch Now Feature

Complete this checklist to deploy ReviewRoll with the new "Watch Now" streaming feature to production.

---

## 📋 Pre-Deployment (Local Testing)

### Environment Setup
- [ ] Clone/pull latest code from repository
- [ ] Copy `.env.example` to `.env`
- [ ] Edit `.env` file:
  - [ ] Set `DB_HOST` (localhost for local)
  - [ ] Set `DB_USER` (usually root)
  - [ ] Set `DB_PASSWORD` (your password)
  - [ ] Set `DB_NAME` (reviewroll)
  - [ ] Get TMDB API Key from https://www.themoviedb.org/settings/api
  - [ ] Set `TMDB_API_KEY` in .env
  - [ ] Set `NODE_ENV=development`

### Database Setup
- [ ] MySQL server running
- [ ] Database created: `mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS reviewroll;"`
- [ ] Run base schema: `mysql -u root -p < db/schema.sql`
- [ ] Run streaming migration: `mysql -u root -p < db/migration_streaming_01.sql`
- [ ] Verify TMDB_ID column exists:
  ```sql
  DESCRIBE reviewroll.Movie;
  # Look for TMDB_ID field
  ```

### Installation
- [ ] Node modules installed: `npm install`
- [ ] No installation errors
- [ ] All dependencies resolve correctly

### Local Testing
- [ ] Start server: `npm start`
- [ ] Server starts without errors
- [ ] Visit `http://localhost:3000` in browser
- [ ] Log in as admin@reviewroll.com / admin123
- [ ] Navigate to any movie detail page
- [ ] Click "WATCH NOW" button
- [ ] Modal opens and displays embedded player
- [ ] Try switching providers using provider buttons
- [ ] Video plays successfully (or shows appropriate error)
- [ ] Press ESC key to close player
- [ ] Verify no console errors
- [ ] Test on mobile (DevTools device simulator at 375px width)
- [ ] Test modal is responsive at 768px and 1200px

### API Testing
- [ ] Health check: `curl http://localhost:3000/api/streaming/health`
- [ ] Get embed: `curl http://localhost:3000/api/streaming/embed/1`
- [ ] Check response has: movieId, tmdbId, title, primary, all array
- [ ] Test with invalid movie: `curl http://localhost:3000/api/streaming/embed/99999`
- [ ] Returns proper 404 error

### Code Review
- [ ] Review new files created (streaming.js, streamingPlayer.js, etc.)
- [ ] Check for any TODOs or FIXMEs in code
- [ ] No API keys or secrets in code
- [ ] All console.log statements appropriate
- [ ] Error messages are user-friendly

---

## 🔧 Pre-Deployment (Production Preparation)

### Repository
- [ ] All changes committed
- [ ] No uncommitted changes: `git status`
- [ ] Push to GitHub: `git push origin main`
- [ ] Verify GitHub shows latest commits

### Documentation
- [ ] Read `WATCH_NOW_QUICK_START.md` → Understand feature
- [ ] Read `STREAMING_DEPLOYMENT.md` → Full deployment guide
- [ ] Read `WATCH_NOW_IMPLEMENTATION.md` → Implementation details
- [ ] Create bookmark for troubleshooting section

### Security Review
- [ ] No API keys in committed files
- [ ] `.env` file is in `.gitignore`
- [ ] Environment variables documented
- [ ] TMDB API key restrictions set (optional)

### Terms of Service
- [ ] Add streaming disclaimers to ToS:
  ```
  ReviewRoll provides embedded streaming for convenience only.
  We do not host, distribute, or endorse any content.
  Content provided by third-party embed providers.
  Users access at their own risk.
  ```
- [ ] Update Privacy Policy if needed
- [ ] Legal review complete (if applicable)

---

## 🚀 Production Deployment (Render)

### Render Setup
- [ ] Render account created at https://render.com
- [ ] GitHub repository connected to Render
- [ ] Understood Render pricing and limits

### Render Configuration
- [ ] Create new Web Service
- [ ] Select Node environment
- [ ] Set build command: `npm install`
- [ ] Set start command: `npm start`
- [ ] Set region (closest to users)

### Environment Variables in Render
Set these in Render dashboard:
- [ ] `NODE_ENV` = `production`
- [ ] `DB_HOST` = your database host (or managed MySQL)
- [ ] `DB_USER` = database user
- [ ] `DB_PASSWORD` = database password (use Render secret)
- [ ] `DB_NAME` = `reviewroll`
- [ ] `TMDB_API_KEY` = your key (use Render secret)
- [ ] `PORT` = leave blank (Render sets automatically)

### Database Preparation
- [ ] Create production MySQL database
  - Option A: Use Render's managed databases (recommended)
  - Option B: Use external hosted MySQL
  - Option C: Keep local (not recommended for production)
- [ ] Run schema migration on production database:
  ```bash
  mysql -u user -p -h prod-db-host reviewroll < db/schema.sql
  mysql -u user -p -h prod-db-host reviewroll < db/migration_streaming_01.sql
  ```
- [ ] Verify TMDB_ID column exists on production
- [ ] Verify tables created successfully

### Deploy
- [ ] Trigger deployment in Render dashboard
- [ ] OR `git push origin main` (if auto-deploy configured)
- [ ] Wait for build to complete (5-10 minutes)
- [ ] Check Render logs for build errors
- [ ] Deployment shows "Your service is live"

### Post-Deploy Testing
- [ ] Visit production URL in browser
- [ ] Page loads successfully
- [ ] Navigation works
- [ ] Can log in
- [ ] Movie detail page loads
- [ ] "WATCH NOW" button appears
- [ ] Click button → modal opens
- [ ] Video player loads successfully
- [ ] Can switch providers
- [ ] No console errors
- [ ] Check Render logs for runtime errors

### API Verification
- [ ] `curl https://your-app.onrender.com/api/streaming/health`
- [ ] Returns healthy status
- [ ] `curl https://your-app.onrender.com/api/streaming/embed/1`
- [ ] Returns valid embed data

---

## 📱 Post-Deployment Verification

### Desktop Testing
- [ ] Chrome on Windows
- [ ] Edge on Windows
- [ ] Firefox on Windows
- [ ] Safari on Mac (if available)

### Mobile Testing
- [ ] iPhone Safari
- [ ] Galaxy Chrome
- [ ] iPhone Portrait mode
- [ ] iPhone Landscape mode
- [ ] Galaxy Portrait mode
- [ ] Galaxy Landscape mode

### Cross-Browser Features
- [ ] Full screen works
- [ ] Provider switching works
- [ ] ESC key closes modal
- [ ] Video controls display
- [ ] No layout issues
- [ ] Animations smooth

### Error Scenarios
- [ ] Close modal with X button
- [ ] Close modal with ESC key
- [ ] Close modal by clicking overlay
- [ ] Try invalid movie number
- [ ] Verify error messages clear
- [ ] Provider unavailable (test by changing URL manually)

### Performance
- [ ] Page loads in < 3 seconds
- [ ] Modal opens in < 1 second
- [ ] Video starts playing in < 5 seconds
- [ ] No lag when switching providers
- [ ] Smooth animations throughout

---

## 📊 Monitoring Setup

### Error Tracking (Optional but Recommended)
- [ ] Set up Sentry account (sentry.io)
- [ ] Create Sentry project for JavaScript
- [ ] Install Sentry in your app (optional)
- [ ] Get Sentry DSN
- [ ] Add `SENTRY_DSN` to environment variables
- [ ] Monitor first week for errors

### Logging
- [ ] Enable logging in production
- [ ] Review logs daily for first week
- [ ] Check for TMDB API errors
- [ ] Check for embed provider issues
- [ ] Monitor for uncaught exceptions

### Analytics (Optional)
- [ ] Set up Google Analytics
- [ ] Track "Watch Now" button clicks
- [ ] Track embed provider usage
- [ ] Monitor user flow
- [ ] Review weekly statistics

---

## 🔒 Security Checklist

### API Security
- [ ] API endpoints require authentication where needed (already handled)
- [ ] CORS properly configured
- [ ] No sensitive data in API responses
- [ ] Rate limiting considered (optional)
- [ ] SQL injection protection active (using parameterized queries)

### Frontend Security
- [ ] No API keys in client-side code ✓
- [ ] HTML properly escaped ✓
- [ ] No sensitive data in localStorage
- [ ] Content Security Policy considered
- [ ] HTTPS enforced (Render handles automatically)

### Database Security
- [ ] Database user has minimal privileges
- [ ] Database password is strong
- [ ] Database backups enabled (if on managed service)
- [ ] Connection uses SSL/TLS
- [ ] Regular backup schedule in place

### TMDB API
- [ ] API key restricted to your domain (if Render provides)
- [ ] API key never exposed in code
- [ ] API key in environment variables only
- [ ] Consider rate limits

---

## 📞 Support & Backup Plan

### Rollback Plan
- [ ] Save production database backup before deploy:
  ```bash
  mysqldump -u user -p -h prod-host reviewroll > backup.sql
  ```
- [ ] Have previous working code tagged in Git
- [ ] Know how to revert Render deployment
- [ ] Have rollback checklist ready

### Troubleshooting Resources
- [ ] [STREAMING_DEPLOYMENT.md](STREAMING_DEPLOYMENT.md) — Full troubleshooting guide
- [ ] [WATCH_NOW_IMPLEMENTATION.md](WATCH_NOW_IMPLEMENTATION.md) — Implementation details
- [ ] Render Documentation: https://render.com/docs
- [ ] Server logs available in Render dashboard

### Emergency Contact
- [ ] Have contact info for:
  - [ ] Database provider support
  - [ ] Render support chat
  - [ ] Your development team
  - [ ] Server administrator

---

## ✅ Launch Readiness

Before considering launch complete, verify:

### Functionality
- [ ] Watch Now button works on all movie detail pages
- [ ] Video player loads and plays
- [ ] Provider switching works
- [ ] Errors display gracefully
- [ ] Mobile responsive

### Performance
- [ ] Page load time acceptable
- [ ] No console errors
- [ ] API response times good
- [ ] Database queries optimized

### User Experience
- [ ] Feature is intuitive
- [ ] No confusing UI elements
- [ ] Legal options shown first
- [ ] Clear error messages

### Documentation
- [ ] Users can find feature
- [ ] Help documentation available
- [ ] Legal disclaimers displayed
- [ ] Support contact available

### Monitoring
- [ ] Error tracking enabled
- [ ] Logs being monitored
- [ ] Analytics tracking
- [ ] Backup plan ready

---

## 🎉 Launch!

- [ ] All checkboxes complete
- [ ] Team approval obtained
- [ ] Legal review complete
- [ ] Announce feature to users
- [ ] Monitor logs closely first 24 hours
- [ ] Be ready to respond to issues

---

## 📋 Post-Launch (First Week)

### Daily Tasks
- [ ] Review error logs
- [ ] Check API performance
- [ ] Monitor user feedback
- [ ] Verify no data issues

### Weekly Tasks
- [ ] Review analytics
- [ ] Check embed provider status
- [ ] Review TMDB API usage
- [ ] Plan any fixes/improvements

### Monthly Tasks
- [ ] Analyze usage patterns
- [ ] Update provider list if needed
- [ ] Security audit
- [ ] Backup verification
- [ ] Performance optimization review

---

## 📝 Notes

Use this space to add any custom notes for your deployment:

```
Production URL: _______________
Database Host: _______________
Support Contact: _______________
Launch Date: _______________
Notes:
_________________________________
_________________________________
_________________________________
```

---

## ✨ Congratulations! 

You've successfully deployed ReviewRoll with the Watch Now streaming feature! 🎉🎬

Your users can now:
- ✅ Watch movies directly in the app
- ✅ Switch between providers
- ✅ See legal streaming options first
- ✅ Enjoy a beautiful, responsive player

**Success metrics to track:**
- Engagement time on site
- Watch Now button click rate
- Provider provider usage statistics
- User feedback and ratings

---

**Made with ❤️ for movie lovers everywhere**

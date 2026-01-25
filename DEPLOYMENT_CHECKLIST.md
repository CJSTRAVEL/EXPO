# CJ's Executive Travel - Deployment Checklist

## Pre-Deployment Checklist

### 1. Environment Configuration
- [ ] Copy `.env.production.template` to `.env` in `/app/backend/`
- [ ] Copy `.env.production.template` to `.env` in `/app/frontend/`
- [ ] Generate new JWT_SECRET: `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`
- [ ] Update all API keys with production values
- [ ] Set `APP_URL` and `REACT_APP_BACKEND_URL` to your production domain
- [ ] Configure `CORS_ORIGINS` with your specific domains

### 2. Database
- [ ] Set up MongoDB with authentication enabled
- [ ] Create production database user with minimal required permissions
- [ ] Configure network access (IP whitelist or VPC)
- [ ] Set up automated backup schedule
- [ ] Test database connection from application server

### 3. Security
- [ ] SSL certificate installed and configured
- [ ] All traffic forced to HTTPS
- [ ] Firewall rules configured (allow only 80, 443)
- [ ] API keys restricted to production domains in respective consoles:
  - [ ] Google Cloud Console (Maps API)
  - [ ] Vonage Dashboard
  - [ ] Stripe Dashboard
  - [ ] GetAddress.io

### 4. DNS & Domain
- [ ] DNS A/CNAME records pointing to production server
- [ ] SSL certificate covers all required subdomains
- [ ] Domain verification for email (SPF, DKIM, DMARC)

### 5. Monitoring & Logging
- [ ] Error monitoring configured (Sentry, etc.)
- [ ] Log rotation configured
- [ ] Health check endpoint verified: `/api/health`
- [ ] Uptime monitoring configured
- [ ] Alert notifications set up

### 6. Testing
- [ ] All critical flows tested:
  - [ ] Admin login
  - [ ] Driver login (mobile app)
  - [ ] Create booking
  - [ ] Assign driver
  - [ ] SMS notifications
  - [ ] Email notifications
  - [ ] Invoice generation
  - [ ] Live tracking
- [ ] Load testing performed (expected concurrent users)
- [ ] Mobile app tested with production API

### 7. Driver App (Expo)
- [ ] Update `EXPO_PUBLIC_BACKEND_URL` to production domain
- [ ] Build production AAB: `eas build --platform android --profile production`
- [ ] Build production IPA: `eas build --platform ios --profile production`
- [ ] Submit to Google Play Console
- [ ] Submit to Apple App Store (if applicable)

### 8. Backup & Recovery
- [ ] Database backup tested and verified
- [ ] Rollback procedure documented
- [ ] Previous working version tagged in git

### 9. Go-Live
- [ ] Schedule deployment window
- [ ] Notify team and stakeholders
- [ ] Monitor error rates post-deployment
- [ ] Verify all integrations working
- [ ] Update DNS TTL back to normal after propagation

---

## Post-Deployment Verification

```bash
# Health check
curl https://cjsdispatch.co.uk/api/health

# Test booking creation
curl -X POST https://cjsdispatch.co.uk/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Verify database indexes
mongo your-connection-string --eval "db.bookings.getIndexes()"
```

## Emergency Rollback

1. Switch DNS to previous working server (if applicable)
2. Or deploy previous version from git tag
3. Restore database from backup if needed
4. Notify team of rollback

---

## Support Contacts

- **Technical Issues**: [your-email]
- **Vonage SMS**: https://dashboard.nexmo.com/
- **Stripe**: https://dashboard.stripe.com/
- **Google Cloud**: https://console.cloud.google.com/

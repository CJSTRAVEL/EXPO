# CJ's Driver - Play Store Submission Guide

## Current Status
✅ **App is Production-Ready** - All code, configurations, and assets are prepared.

⚠️ **Build Blocked** - Expo free-tier limit reached (resets Feb 1st, 2026)

---

## App Configuration Summary

| Setting | Value |
|---------|-------|
| App Name | CJ's Driver |
| Package ID | `uk.co.cjstravel.driver` |
| Version | 1.0.1 |
| Version Code | 4 |
| Build Type | AAB (Android App Bundle) |

---

## Option 1: Wait for Build Reset (8 days)

The free-tier build quota resets on **February 1st, 2026**.

After reset, run:
```bash
cd /app/driver-app
eas build --platform android --profile production --non-interactive
```

---

## Option 2: Upgrade Expo Account (Immediate)

1. Go to: https://expo.dev/accounts/cjsexecutivetravel/settings/billing
2. Upgrade to a paid plan
3. Run the production build immediately

---

## Option 3: Local Build (No Expo Limits)

Build locally on your computer with Android Studio installed.

### Prerequisites:
- Java JDK 17+
- Android Studio with SDK
- Node.js 18+

### Steps:
```bash
# Clone or copy the driver-app folder to your local machine

# Install dependencies
cd driver-app
yarn install

# Generate native Android project
npx expo prebuild --platform android

# Build AAB locally
cd android
./gradlew bundleRelease

# Output location:
# android/app/build/outputs/bundle/release/app-release.aab
```

---

## Play Store Submission Checklist

### 1. Google Play Console Setup
- [ ] Create Google Play Developer account ($25): https://play.google.com/console/signup
- [ ] Create new app in Play Console
- [ ] Set up app signing (App signing by Google Play recommended)

### 2. Store Listing (Use content from STORE_LISTINGS.md)
- [ ] App name: CJ's Driver
- [ ] Short description (80 chars)
- [ ] Full description
- [ ] App icon (512x512) - ✅ Available at `/assets/icon.png`
- [ ] Feature graphic (1024x500) - ✅ Available
- [ ] Screenshots (min 2)

### 3. Content Rating
- [ ] Complete IARC questionnaire
- [ ] Expected rating: Everyone

### 4. Privacy & Data Safety
- [ ] Privacy policy URL: https://cjstravel.uk/privacy
- [ ] Data safety declaration:
  - Location data collected (for dispatch tracking)
  - Personal info collected (driver account)
  - Secure data handling

### 5. Target Audience
- [ ] Apps NOT designed for children
- [ ] Target age: 18+

### 6. App Category
- Primary: Maps & Navigation
- Secondary: Business

---

## Automatic Submission with EAS

Once you have your AAB built and a Google Cloud service account:

1. Create service account in Google Cloud Console
2. Grant access in Play Console → API Access
3. Download JSON key to `./google-services.json`
4. Run: `eas submit --platform android --latest`

---

## Required Screenshots for Play Store

Generate screenshots showing:
1. **Login Screen** - Professional driver login
2. **Dashboard** - Online/offline toggle, earnings summary
3. **Jobs List** - Today's bookings with status badges
4. **Booking Detail** - Route info, customer details
5. **Navigation** - Map with directions
6. **Walkaround Check** - Vehicle inspection form

Recommended resolution: 1080x1920 (Portrait)

---

## Files Ready for Upload

| Asset | Path | Status |
|-------|------|--------|
| App Icon | `/assets/icon.png` | ✅ Ready |
| Adaptive Icon | `/assets/adaptive-icon.png` | ✅ Ready |
| Feature Graphic | See STORE_LISTINGS.md | ✅ Ready |
| Privacy Policy | `/store-assets/privacy-policy.html` | ✅ Ready |
| Terms of Service | `/store-assets/terms-of-service.html` | ✅ Ready |

---

## Contact

For CJ's Executive Travel support: dispatch@cjstravel.uk

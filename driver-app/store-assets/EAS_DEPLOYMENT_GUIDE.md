# EAS Build & App Store Deployment Guide

## Prerequisites

### 1. Expo Account
Create a free Expo account at https://expo.dev/signup

### 2. Apple Developer Account (for iOS)
- Cost: $99/year
- Sign up at: https://developer.apple.com/programs/enroll/

### 3. Google Play Developer Account (for Android)
- Cost: $25 one-time
- Sign up at: https://play.google.com/console/signup

---

## Step 1: Install EAS CLI

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Verify installation
eas --version
```

## Step 2: Login to Expo

```bash
# Login to your Expo account
eas login

# Verify login
eas whoami
```

## Step 3: Configure the Project

```bash
cd /app/driver-app

# Initialize EAS in the project
eas build:configure

# This will prompt you to:
# 1. Select platform (All, iOS, Android)
# 2. Create a project ID
```

## Step 4: Update app.json

After running `eas build:configure`, update the projectId in app.json:

```json
{
  "expo": {
    ...
    "extra": {
      "eas": {
        "projectId": "YOUR_PROJECT_ID_HERE"
      }
    }
  }
}
```

---

## Building for Android

### Development Build (APK for testing)
```bash
eas build --platform android --profile preview
```

### Production Build (AAB for Google Play)
```bash
eas build --platform android --profile production
```

### Download the build
After the build completes, download the APK/AAB from:
- Expo website: https://expo.dev/accounts/[your-username]/projects/cjs-driver/builds
- Or use: `eas build:list`

---

## Building for iOS

### Prerequisites for iOS
1. Apple Developer account
2. App Store Connect app created
3. Provisioning profiles (EAS can auto-generate these)

### Development Build (Simulator)
```bash
eas build --platform ios --profile development
```

### Production Build (App Store)
```bash
eas build --platform ios --profile production
```

During the build, EAS will prompt for:
- Apple ID
- App-specific password (create at appleid.apple.com)
- Team ID (found in Apple Developer account)

---

## Submitting to App Stores

### Submit to Google Play Store

1. **Create app in Google Play Console:**
   - Go to https://play.google.com/console
   - Create a new app
   - Fill in store listing details (use STORE_LISTINGS.md)
   - Upload screenshots

2. **Create a service account:**
   - Go to Google Cloud Console
   - Create a service account with Google Play permissions
   - Download the JSON key file
   - Save as `google-services.json` in the project root

3. **Submit using EAS:**
```bash
eas submit --platform android --latest
```

### Submit to Apple App Store

1. **Create app in App Store Connect:**
   - Go to https://appstoreconnect.apple.com
   - Create a new app
   - Fill in app information
   - Upload screenshots (use STORE_LISTINGS.md)

2. **Submit using EAS:**
```bash
eas submit --platform ios --latest
```

---

## Environment Configuration

### Update eas.json for your accounts

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@email.com",
        "ascAppId": "your-app-store-connect-app-id",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-services.json",
        "track": "production"
      }
    }
  }
}
```

---

## App Store Requirements Checklist

### Google Play Store
- [x] App icon (512x512 PNG)
- [x] Feature graphic (1024x500 PNG)
- [ ] Screenshots (min 2, max 8 per device type)
- [x] Short description (80 chars)
- [x] Full description (4000 chars)
- [x] Privacy policy URL
- [ ] Content rating questionnaire
- [ ] Target audience declaration

### Apple App Store
- [x] App icon (1024x1024 PNG)
- [ ] Screenshots (iPhone 6.5", iPhone 5.5", iPad)
- [x] Description
- [x] Keywords
- [x] Privacy policy URL
- [x] Support URL
- [ ] Age rating questionnaire
- [ ] Export compliance

---

## Updating the App

### Increment Version Numbers
In `app.json`, update:
```json
{
  "expo": {
    "version": "1.0.1",
    "ios": {
      "buildNumber": "2"
    },
    "android": {
      "versionCode": 2
    }
  }
}
```

### Build and Submit Updates
```bash
# Build new version
eas build --platform all --profile production

# Submit to stores
eas submit --platform all --latest
```

---

## Over-the-Air (OTA) Updates

For minor updates (JS/assets only), use EAS Update:

```bash
# Publish an update
eas update --branch production --message "Bug fixes"
```

This allows instant updates without going through app store review!

---

## Troubleshooting

### Build Fails
1. Check build logs on Expo website
2. Ensure all dependencies are compatible
3. Verify app.json configuration

### iOS Provisioning Issues
```bash
# Reset credentials
eas credentials --platform ios
```

### Android Signing Issues
```bash
# Reset credentials
eas credentials --platform android
```

---

## Support

- Expo Documentation: https://docs.expo.dev
- EAS Build: https://docs.expo.dev/build/introduction/
- EAS Submit: https://docs.expo.dev/submit/introduction/

For CJ's Executive Travel support: dispatch@cjstravel.uk

# CJ's Driver - Local Android Build Guide

## Quick Start

### Step 1: Download the Project
Download `driver-app-android.zip` from the Emergent platform files.

### Step 2: Extract and Install Dependencies
```bash
# Extract the zip
unzip driver-app-android.zip
cd driver-app

# Install Node dependencies
yarn install
```

### Step 3: Open in Android Studio
1. Open Android Studio
2. Click **"Open"** (not "New Project")
3. Navigate to `driver-app/android` folder
4. Click **OK** to open

### Step 4: Wait for Gradle Sync
Android Studio will automatically sync Gradle. This may take 5-10 minutes on first run.

### Step 5: Build the APK (for testing)
```bash
cd android

# Debug APK (unsigned, for testing)
./gradlew assembleDebug

# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

### Step 6: Build AAB (for Play Store)
```bash
cd android

# Release AAB (for Play Store submission)
./gradlew bundleRelease

# Output: android/app/build/outputs/bundle/release/app-release.aab
```

---

## Signing for Play Store

### Option A: Use Android Studio (Recommended)
1. In Android Studio: **Build → Generate Signed Bundle/APK**
2. Select **Android App Bundle**
3. Create new keystore or use existing
4. Fill in key details:
   - Keystore path: Choose location
   - Password: Create strong password
   - Alias: `cjs-driver-key`
   - Key password: Same or different
   - Validity: 25 years
   - Certificate info: Your company details

### Option B: Command Line Signing
1. Create keystore (one-time):
```bash
keytool -genkey -v -keystore cjs-driver.keystore \
  -alias cjs-driver-key \
  -keyalg RSA -keysize 2048 -validity 9125 \
  -storepass YOUR_STORE_PASSWORD \
  -keypass YOUR_KEY_PASSWORD \
  -dname "CN=CJ's Executive Travel, OU=Mobile, O=CJ's Executive Travel, L=Newcastle, ST=Tyne and Wear, C=UK"
```

2. Add to `android/gradle.properties`:
```properties
MYAPP_UPLOAD_STORE_FILE=../cjs-driver.keystore
MYAPP_UPLOAD_KEY_ALIAS=cjs-driver-key
MYAPP_UPLOAD_STORE_PASSWORD=YOUR_STORE_PASSWORD
MYAPP_UPLOAD_KEY_PASSWORD=YOUR_KEY_PASSWORD
```

3. Update `android/app/build.gradle` - add inside `android { }`:
```gradle
signingConfigs {
    release {
        if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
            storeFile file(MYAPP_UPLOAD_STORE_FILE)
            storePassword MYAPP_UPLOAD_STORE_PASSWORD
            keyAlias MYAPP_UPLOAD_KEY_ALIAS
            keyPassword MYAPP_UPLOAD_KEY_PASSWORD
        }
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
}
```

4. Build signed AAB:
```bash
./gradlew bundleRelease
```

---

## Troubleshooting

### Gradle Sync Failed
- Ensure Java JDK 17+ is installed
- Check JAVA_HOME environment variable
- Try: **File → Invalidate Caches / Restart**

### Build Failed - SDK Not Found
- Open SDK Manager in Android Studio
- Install Android SDK 34 (API 34)
- Install Build Tools 34.0.0

### Metro Bundler Issues
Run Metro separately before building:
```bash
# In driver-app folder (not android)
yarn start
```
Then build in another terminal.

### "Could not find node"
Add Node.js to your PATH or specify in `android/gradle.properties`:
```properties
node.executable=/path/to/node
```

---

## Build Output Locations

| Build Type | File | Location |
|------------|------|----------|
| Debug APK | `app-debug.apk` | `android/app/build/outputs/apk/debug/` |
| Release APK | `app-release.apk` | `android/app/build/outputs/apk/release/` |
| Release AAB | `app-release.aab` | `android/app/build/outputs/bundle/release/` |

---

## Play Store Upload

1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app or create new
3. Go to **Release → Production**
4. Click **Create new release**
5. Upload the `app-release.aab` file
6. Add release notes
7. Review and roll out

---

## Important: Keep Your Keystore Safe!

⚠️ **BACKUP YOUR KEYSTORE FILE** - If lost, you cannot update your app on Play Store!

Store securely:
- The `.keystore` file
- The passwords (store password & key password)
- The key alias name

---

## Need Help?

If you encounter issues:
1. Check Android Studio's Build output panel
2. Look at Gradle console for specific errors
3. Ensure all SDK components are installed

For app-specific support: dispatch@cjstravel.uk

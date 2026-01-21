# CJ's Executive Travel - Driver App

A React Native / Expo mobile application for CJ's Executive Travel drivers to manage their bookings, navigate to pickups, and communicate with dispatch.

## Features

### 📱 Authentication
- Secure email + password login
- Auto-login with stored credentials
- JWT token-based authentication

### 🚗 Booking Management
- View today's and upcoming bookings
- Accept/reject new booking assignments
- Update booking status (On Way → Arrived → In Progress → Completed)
- View booking details including passenger info, route, and fare

### 🗺️ Navigation
- One-tap navigation to pickup/dropoff locations
- In-app map view with route preview
- Opens Google Maps or Apple Maps for turn-by-turn directions
- Real-time ETA and distance display

### 📍 Live GPS Tracking
- Background location updates every 30 seconds
- Location shared with dispatch when online
- Automatic location permission handling

### 🔔 Push Notifications
- Instant notifications for new booking assignments
- Status update alerts
- Booking reminders

### 💬 Chat
- Real-time messaging with dispatch
- Message history per booking
- Auto-refresh for new messages

### 💰 Earnings
- Today's earnings summary
- Weekly earnings tracking
- All-time earnings and trip count

### 📋 History
- Complete booking history
- Pagination for large lists
- Trip details and earnings per booking

### ⚙️ Profile & Settings
- Online/Offline toggle
- Break mode
- Profile details
- Vehicle information

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI
- iOS Simulator (Mac) or Android Emulator

### Installation

```bash
cd driver-app
npm install
```

### Running the App

```bash
# Start Expo development server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android
```

### Test Account
- **Email:** john.driver@cjstravel.uk
- **Password:** driver123

## Building for App Stores

### Setup EAS Build

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo account
eas login

# Configure project
eas build:configure
```

### Build for Testing (Internal Distribution)

```bash
# Build APK for Android
eas build --platform android --profile preview

# Build for iOS Simulator
eas build --platform ios --profile development
```

### Build for Production

```bash
# Build for Google Play Store (AAB)
eas build --platform android --profile production

# Build for Apple App Store
eas build --platform ios --profile production
```

### Submit to App Stores

```bash
# Submit to Google Play Store
eas submit --platform android

# Submit to Apple App Store
eas submit --platform ios
```

## Configuration

### app.json
Main Expo configuration including:
- App name and slug
- Bundle identifiers (iOS/Android)
- Permissions for location and notifications
- Splash screen and icon settings

### eas.json
EAS Build configuration for:
- Development builds
- Preview builds (internal testing)
- Production builds (app stores)
- Submit configurations

### src/config.js
App configuration including:
- API URL
- Color theme
- Status labels
- Location update intervals

## API Endpoints

The app communicates with these backend endpoints:

### Authentication
- `POST /api/driver/login` - Driver login

### Profile
- `GET /api/driver/profile` - Get driver profile
- `PUT /api/driver/status` - Update online/break status
- `PUT /api/driver/location` - Update GPS location

### Bookings
- `GET /api/driver/bookings` - Get assigned bookings
- `GET /api/driver/bookings/pending` - Get pending assignments
- `PUT /api/driver/bookings/{id}/accept` - Accept booking
- `PUT /api/driver/bookings/{id}/reject` - Reject booking
- `PUT /api/driver/bookings/{id}/status` - Update status
- `POST /api/driver/bookings/{id}/notify-arrival` - Notify customer

### Earnings
- `GET /api/driver/earnings` - Get earnings summary
- `GET /api/driver/history` - Get booking history

### Chat
- `GET /api/driver/chat/{booking_id}` - Get messages
- `POST /api/driver/chat/send` - Send message

## Project Structure

```
driver-app/
├── App.js                 # Main app entry point
├── app.json               # Expo configuration
├── eas.json               # EAS Build configuration
├── src/
│   ├── config.js          # App configuration
│   ├── context/
│   │   └── AuthContext.js # Authentication state
│   ├── services/
│   │   ├── api.js         # API client
│   │   └── notifications.js # Push notifications
│   └── screens/
│       ├── LoginScreen.js
│       ├── DashboardScreen.js
│       ├── JobsScreen.js
│       ├── EarningsScreen.js
│       ├── HistoryScreen.js
│       ├── ProfileScreen.js
│       ├── ChatScreen.js
│       └── NavigationScreen.js
└── assets/
    ├── icon.png
    ├── splash-icon.png
    └── adaptive-icon.png
```

## Permissions

### iOS
- Location When In Use
- Location Always (for background tracking)
- Push Notifications
- Background Modes: location, fetch, remote-notification

### Android
- ACCESS_FINE_LOCATION
- ACCESS_COARSE_LOCATION
- ACCESS_BACKGROUND_LOCATION
- FOREGROUND_SERVICE
- POST_NOTIFICATIONS

## Support

For technical support or questions, contact CJ's Executive Travel dispatch.

## License

Proprietary - CJ's Executive Travel Limited

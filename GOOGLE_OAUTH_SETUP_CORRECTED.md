# Google OAuth Setup for Winfeed Flutter App

This guide will help you set up Google OAuth authentication for your Flutter app that can run on multiple platforms.

## 1. Google Cloud Console Setup

### Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: "Winfeed" (or your preferred name)
4. Click "Create"

### Enable Google+ API
1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google+ API"
3. Click on it and press "Enable"

### Configure OAuth Consent Screen
1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" user type
3. Fill in app information:
   - **App name**: Winfeed
   - **User support email**: Your email
   - **Developer contact**: Your email
4. Add scopes:
   - `../auth/userinfo.email`
   - `../auth/userinfo.profile`
   - `openid`
5. Add test users (for development)

## 2. Create OAuth Clients for Each Platform

### Web Client (for Flutter Web)
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. **Application type**: Web application
4. **Name**: Winfeed Web Client
5. **Authorized redirect URIs**:
   - `https://sfnvywrxvvvcwiitlzeg.supabase.co/auth/v1/callback`
   - `http://localhost:3000/auth/callback` (for local development)
6. **Copy the Client ID and Client Secret**

### iOS Client (for Flutter iOS)
1. Create another OAuth 2.0 Client ID
2. **Application type**: iOS
3. **Name**: Winfeed iOS Client
4. **Bundle ID**: `io.supabase.winfeed` (or your preferred bundle ID)
5. **Copy the Client ID** (no secret needed for iOS)

### Android Client (for Flutter Android)
1. Create another OAuth 2.0 Client ID
2. **Application type**: Android
3. **Name**: Winfeed Android Client
4. **Package name**: `io.supabase.winfeed` (or your preferred package name)
5. **SHA-1 certificate fingerprint**: Get this from your Android keystore
6. **Copy the Client ID** (no secret needed for Android)

## 3. Supabase Dashboard Setup

### Configure Google Provider
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to "Authentication" → "Providers"
4. Find "Google" and click "Enable"
5. Enter your **Web Client** credentials:
   - **Client ID**: From your Web Client
   - **Client Secret**: From your Web Client
6. Click "Save"

### Configure Site URL and Redirect URLs
1. Go to "Authentication" → "URL Configuration"
2. **Site URL**: `http://localhost:3000` (for development)
3. **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `https://your-domain.com/auth/callback` (for production)

## 4. Flutter App Configuration

### Update your .env file
```env
# Supabase Configuration
SUPABASE_URL=https://sfnvywrxvvvcwiitlzeg.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# Google OAuth (Web Client)
GOOGLE_WEB_CLIENT_ID=your-web-client-id
GOOGLE_WEB_CLIENT_SECRET=your-web-client-secret

# Google OAuth (Mobile Clients)
GOOGLE_IOS_CLIENT_ID=your-ios-client-id
GOOGLE_ANDROID_CLIENT_ID=your-android-client-id
```

### Platform-Specific OAuth Handling

#### For Web (what you're using now):
```dart
await Supabase.instance.client.auth.signInWithOAuth(
  OAuthProvider.google,
  redirectTo: 'https://sfnvywrxvvvcwiitlzeg.supabase.co/auth/v1/callback',
);
```

#### For Mobile (iOS/Android):
```dart
await Supabase.instance.client.auth.signInWithOAuth(
  OAuthProvider.google,
  redirectTo: 'io.supabase.winfeed://auth/callback',
);
```

## 5. Why Different Platforms Need Different Configurations

### **Web Applications:**
- Run in browsers
- Use HTTP redirects
- Need both Client ID and Client Secret
- Redirect to Supabase's web callback URL

### **Mobile Applications:**
- Run as native apps
- Use custom URL schemes (deep links)
- Only need Client ID (no secret)
- Redirect to custom app URL scheme

### **Security Considerations:**
- **Web**: Client Secret is kept secure on the server (Supabase)
- **Mobile**: No secret needed because the app is installed on the user's device
- **Deep Links**: Allow the OAuth flow to return to your app

## 6. Testing Your Setup

### Test Web Version:
1. Run `flutter run -d chrome`
2. Click "Continue with Google"
3. You should be redirected to Google's OAuth screen
4. After authorization, you'll be redirected back to your app

### Test Mobile Version:
1. Run `flutter run -d ios` or `flutter run -d android`
2. Click "Continue with Google"
3. You should be redirected to Google's OAuth screen
4. After authorization, you'll be redirected back to your app

## 7. Production Deployment

### Update Redirect URLs for Production:
1. **Google Cloud Console**: Add your production domain
2. **Supabase Dashboard**: Update Site URL and Redirect URLs
3. **Flutter App**: Update redirect URLs in your code

### Mobile App Store Requirements:
- **iOS**: Need to configure URL schemes in `Info.plist`
- **Android**: Need to configure intent filters in `AndroidManifest.xml`

## 8. Troubleshooting

### Common Issues:

1. **"redirect_uri_mismatch"**:
   - Check that your redirect URI matches exactly
   - Ensure you're using the correct client for the platform

2. **"invalid_client"**:
   - Verify you're using the correct Client ID for the platform
   - Check that the OAuth consent screen is properly configured

3. **Deep link not working (mobile)**:
   - Verify the URL scheme is configured correctly
   - Check that the app is installed and can handle the URL scheme

## Summary

- **Web**: Use Web Client with Supabase callback URL
- **Mobile**: Use Platform-specific clients with custom URL schemes
- **Security**: Web needs secret, mobile doesn't
- **Testing**: Test each platform separately

This approach gives you a single Flutter app that works on all platforms with proper OAuth authentication!

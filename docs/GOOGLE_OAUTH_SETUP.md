# Google OAuth Setup for Winfeed

This guide will help you set up Google OAuth authentication for the Winfeed app.

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

### Create OAuth 2.0 Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. If prompted, configure the OAuth consent screen first:
   - Choose "External" user type
   - Fill in app name: "Winfeed"
   - Add your email as the developer contact
   - Add authorized domains (for production)
4. For the OAuth client:
   - Application type: "Web application"
   - Name: "Winfeed Web Client"
   - Authorized redirect URIs:
     - `https://sfnvywrxvvvcwiitlzeg.supabase.co/auth/v1/callback`
     - `http://localhost:3000/auth/callback` (for local development)

### Get Your Credentials
1. After creating the OAuth client, you'll get:
   - **Client ID**: Copy this
   - **Client Secret**: Copy this

## 2. Supabase Dashboard Setup

### Configure Google Provider
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to "Authentication" → "Providers"
4. Find "Google" and click "Enable"
5. Enter your Google OAuth credentials:
   - **Client ID**: Paste from Google Cloud Console
   - **Client Secret**: Paste from Google Cloud Console
6. Click "Save"

### Configure Site URL
1. In Supabase Dashboard, go to "Authentication" → "URL Configuration"
2. Set **Site URL** to: `http://localhost:3000` (for development)
3. Add **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `https://your-domain.com/auth/callback` (for production)

## 3. Update Your .env File

Add your Google OAuth credentials to your `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://sfnvywrxvvvcwiitlzeg.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# Google OAuth (optional - for additional configuration)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## 4. Test the Integration

1. Run your Flutter app: `flutter run -d chrome`
2. Click "Continue with Google" on the sign-in page
3. You should be redirected to Google's OAuth consent screen
4. After authorizing, you'll be redirected back to your app

## 5. Production Deployment

### Update Redirect URLs
When deploying to production:

1. **Google Cloud Console**:
   - Add your production domain to authorized redirect URIs
   - Example: `https://your-domain.com/auth/callback`

2. **Supabase Dashboard**:
   - Update Site URL to your production domain
   - Add production redirect URL

### Mobile App Configuration
For mobile apps, you'll need to configure deep links:

1. **Android**: Update `android/app/src/main/AndroidManifest.xml`
2. **iOS**: Update `ios/Runner/Info.plist`

## Troubleshooting

### Common Issues

1. **"redirect_uri_mismatch"**: 
   - Check that your redirect URI in Google Cloud Console matches exactly
   - Ensure the URI is added to both Google Cloud Console and Supabase

2. **"invalid_client"**:
   - Verify your Client ID and Client Secret are correct
   - Check that the OAuth consent screen is properly configured

3. **"access_denied"**:
   - User denied permission or OAuth consent screen needs approval
   - Check OAuth consent screen configuration

### Testing Locally

For local development, you can use:
- `http://localhost:3000/auth/callback` as redirect URI
- Make sure your Flutter app is running on the correct port

## Security Notes

- Never commit your Client Secret to version control
- Use environment variables for sensitive credentials
- Regularly rotate your OAuth credentials
- Monitor OAuth usage in Google Cloud Console

## Next Steps

After setting up Google OAuth:
1. Test the authentication flow
2. Set up user profile creation
3. Configure user permissions and roles
4. Add additional OAuth providers if needed (GitHub, Apple, etc.)



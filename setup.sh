#!/bin/bash

echo "🚀 Setting up Winfeed..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if Flutter is installed
if ! command -v flutter &> /dev/null; then
    echo "❌ Flutter not found. Please install Flutter first:"
    echo "   https://flutter.dev/docs/get-started/install"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Navigate to app directory
cd app

# Install Flutter dependencies
echo "📦 Installing Flutter dependencies..."
flutter pub get

# Generate code
echo "🔧 Generating code..."
dart run build_runner build --delete-conflicting-outputs

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
EOF
    echo "⚠️  Please update .env with your Supabase credentials"
fi

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Create a Supabase project at https://supabase.com"
echo "2. Run the SQL files in the /supabase directory"
echo "3. Deploy the Edge Function: supabase functions deploy on_win_completed"
echo "4. Update .env with your Supabase credentials"
echo "5. Run the app: flutter run"

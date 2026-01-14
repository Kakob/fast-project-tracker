#!/bin/bash

# Helper script to find your local IP address for accessing the web app from your phone

echo "🔍 Finding your local IP address..."
echo ""

# Try different methods based on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
    if [ -z "$IP" ]; then
        IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    IP=$(hostname -I | awk '{print $1}')
else
    echo "Please run 'ipconfig' (Windows) or 'ifconfig' (Mac/Linux) to find your IP"
    exit 1
fi

if [ -z "$IP" ]; then
    echo "❌ Could not automatically detect IP address"
    echo "Please find it manually:"
    echo "  - Mac/Linux: ifconfig | grep 'inet '"
    echo "  - Windows: ipconfig"
else
    echo "✅ Your local IP address is: $IP"
    echo ""
    echo "📱 To access from your phone:"
    echo "   http://$IP:3000"
    echo ""
    echo "Make sure:"
    echo "  1. Your phone is on the same WiFi network"
    echo "  2. The dev server is running: npm run dev"
fi


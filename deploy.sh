#!/bin/bash
# 🚀 ZKTrader Vercel Deployment Quick Start

echo "======================================"
echo "ZKTrader Vercel Deployment Setup"
echo "======================================"
echo ""

# Verify we're in the right directory
if [ ! -f "vercel.json" ]; then
    echo "❌ Error: vercel.json not found. Please run this from the zktrader root directory."
    exit 1
fi

echo "✅ Found zktrader project"
echo ""

# Check if frontend builds
echo "🔨 Testing local build..."
cd frontend
if pnpm build > /dev/null 2>&1; then
    echo "✅ Frontend builds successfully"
    cd ..
else
    echo "❌ Frontend build failed. Please check for errors."
    cd ..
    exit 1
fi

echo ""
echo "======================================"
echo "📋 Deployment Configuration:"
echo "======================================"
echo ""
echo "Repository: https://github.com/yashbaing/zktrader"
echo "Branch: main"
echo "Framework: Next.js"
echo "Build Command: pnpm build (automatic)"
echo "Output Directory: .next (automatic)"
echo ""

echo "======================================"
echo "✅ READY FOR DEPLOYMENT!"
echo "======================================"
echo ""
echo "Next steps:"
echo ""
echo "1️⃣  Go to: https://vercel.com/new"
echo "2️⃣  Click 'Import Git Repository'"
echo "3️⃣  Select: yashbaing/zktrader"
echo "4️⃣  Click 'Import'"
echo "5️⃣  Vercel will auto-detect settings"
echo "6️⃣  Click 'Deploy' ✨"
echo ""
echo "Your site will be live in 2-3 minutes!"
echo ""

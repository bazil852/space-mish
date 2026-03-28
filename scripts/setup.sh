#!/usr/bin/env bash
set -euo pipefail

echo ""
echo "  ✦  Space Mish — Setup"
echo "  ━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "  ✗ Node.js not found. Please install Node.js 20+"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "  ✗ Node.js $NODE_VERSION detected. Version 20+ required."
  exit 1
fi
echo "  ✓ Node.js $(node -v)"

# Install dependencies
echo ""
echo "  Installing dependencies..."
npm install

# Build shared types
echo ""
echo "  Building shared types..."
npm run build:shared

# Copy env example if .env doesn't exist
if [ ! -f .env ]; then
  cp .env.example .env
  echo "  ✓ Created .env from .env.example"
else
  echo "  ✓ .env already exists"
fi

# Create data directory for SQLite
mkdir -p data
echo "  ✓ Data directory ready"

echo ""
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✦  Setup complete!"
echo ""
echo "  Start the hub + web app:"
echo "    npm run dev"
echo ""
echo "  Start an agent (on target device):"
echo "    npm run dev:agent:macos"
echo "    npm run dev:agent:windows"
echo ""
echo "  Then open http://localhost:3000 on your iPad"
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

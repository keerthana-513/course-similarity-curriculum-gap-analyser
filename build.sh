#!/usr/bin/env bash
# Build script for Render deployment
# Installs backend + frontend deps and builds the React frontend

set -e

echo "=== Installing backend dependencies ==="
cd backend
pip install -r requirements.txt
cd ..

echo "=== Installing frontend dependencies ==="
cd frontend
npm install
npm run build
cd ..

echo "=== Copying frontend build to backend/static ==="
mkdir -p backend/static
cp -r frontend/dist/* backend/static/

echo "=== Build complete ==="

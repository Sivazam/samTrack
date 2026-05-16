#!/bin/bash
# Custom dev script for sandbox environment
# This runs as part of the container startup process

cd /home/z/my-project

# Kill any existing server
pkill -f "next dev" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true
sleep 2

# Start the production server (lighter on memory)
echo "[DEV] Starting Next.js production server..."
bun run dev &
DEV_PID=$!

# Wait for server to be ready
echo "[DEV] Waiting for server to be ready..."
for i in $(seq 1 60); do
  if curl -s --connect-timeout 2 http://localhost:3000 > /dev/null 2>&1; then
    echo "[DEV] Server is ready!"
    break
  fi
  sleep 1
done

echo "[DEV] Server started with PID $DEV_PID"

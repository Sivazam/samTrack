#!/bin/bash
# Keep-alive script for the dev server
# Restarts the server if it dies

while true; do
  echo "[$(date)] Starting dev server..."
  cd /home/z/my-project
  npx next start -p 3000
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE, restarting in 3s..."
  sleep 3
done

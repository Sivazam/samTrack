#!/bin/bash
cd /home/z/my-project
while true; do
    NODE_OPTIONS="--max-old-space-size=64" npx next start -p 3000 > dev.log 2>&1
    echo "Server exited, restarting in 2s..." >> dev.log
    sleep 2
done

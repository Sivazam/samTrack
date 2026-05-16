#!/bin/bash
while true; do
  RESP=$(curl -s -m 3 http://localhost:3000/login -o /dev/null -w '%{http_code}' 2>/dev/null)
  if [ "$RESP" != "200" ]; then
    pkill -f 'next-server' 2>/dev/null
    pkill -f 'next start' 2>/dev/null
    pkill -f 'server-standalone' 2>/dev/null
    sleep 2
    cd /home/z/my-project && nohup node server-standalone.mjs > server.log 2>&1 &
    sleep 5
    echo "$(date): Server restarted" >> /home/z/my-project/watchdog.log
  fi
  sleep 30
done

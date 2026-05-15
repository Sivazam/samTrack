#!/bin/bash
while true; do
  cd /home/z/my-project
  npx next start -p 3000 2>/dev/null
  sleep 2
done

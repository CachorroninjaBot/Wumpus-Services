#!/bin/sh
set -eu
cd /workspace
if [ -f /workspace/.secrets/shardpay.key ]; then
  SHARDPAY_API_KEY=$(cat /workspace/.secrets/shardpay.key)
  export SHARDPAY_API_KEY
fi
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >/tmp/wumpus-dev.log 2>&1 &
i=1
while [ "$i" -le 40 ]; do
  if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
    exit 0
  fi
  i=$((i + 1))
  sleep 0.4
done
exit 0

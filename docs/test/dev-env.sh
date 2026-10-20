#!/usr/bin/env bash
# Lokal sinov muhiti: seed backend (:4100), HSTS'siz proksi (:4101), web panel taqlidi (:4200).
# Ishlatish: docs/test/dev-env.sh start | stop
set -u
HERE="$(cd "$(dirname "$0")/../.." && pwd)"; API="$HERE/../apteka360-backend/apps/api"; RUN=/tmp/apteka-dev-env; mkdir -p $RUN
case "${1:-start}" in
  start)
    (cd "$API" && PORT=4100 HOST=127.0.0.1 NODE_ENV=development CORS_ORIGINS='http://127.0.0.1:4200,http://tauri.localhost,tauri://localhost' \
      nohup ../../node_modules/.bin/tsx src/main.ts > $RUN/api.log 2>&1 & echo $! > $RUN/api.pid)
    nohup python3 -I "$HERE/docs/test/no-hsts-proxy.py" 4101 127.0.0.1:4100 > $RUN/proxy.log 2>&1 & echo $! > $RUN/proxy.pid
    nohup python3 -I "$HERE/docs/test/fake-panel.py" http://127.0.0.1:4101 > $RUN/panel.log 2>&1 & echo $! > $RUN/panel.pid
    for i in $(seq 1 40); do curl -s -o /dev/null -w '%{http_code}' 127.0.0.1:4101/healthz 2>/dev/null | grep -q 200 && { echo "dev-env tayyor"; exit 0; }; sleep 1; done
    echo "API ishga tushmadi: $RUN/api.log"; exit 1 ;;
  stop)
    for p in api proxy panel; do [ -f $RUN/$p.pid ] && kill "$(cat $RUN/$p.pid)" 2>/dev/null; rm -f $RUN/$p.pid; done; echo stopped ;;
esac

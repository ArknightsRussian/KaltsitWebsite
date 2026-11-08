#!/bin/sh
# Rebuild the translators' section lines from the EN scripts, the ArknightsRU
# dictionaries and arktr, wait for it, and print the summary. Re-runnable.
#
#   ./translators/import.sh [backend-url]
#
# The import runs in the backend's background (it outlasts the 30 s request
# limit); this script starts it and polls. The internal service key is read
# from the running backend container, so it is never written here.
set -eu
cd "$(dirname "$0")/.."
URL="${1:-http://localhost:3060}/api/translators/import"
KEY="$(docker compose exec -T backend printenv SERVICE_KEY)"
curl -sS --fail-with-body -X POST -H "x-service-key: $KEY" "$URL" >/dev/null
echo "Import started, waiting..." >&2
while :; do
    sleep 5
    STATUS="$(curl -sS --fail-with-body -H "x-service-key: $KEY" "$URL")"
    case "$STATUS" in
    *'"running":true'*) printf '.' >&2 ;;
    *) break ;;
    esac
done
echo >&2
echo "$STATUS"
case "$STATUS" in *'"error":null'*) ;; *) exit 1 ;; esac

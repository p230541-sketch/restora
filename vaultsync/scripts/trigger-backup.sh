#!/usr/bin/env bash
# Manually trigger an on-demand backup on the edge daemon
set -euo pipefail

PORT=${TRIGGER_HTTP_PORT:-9100}
HOST=${EDGE_NODE_HOST:-localhost}

echo "Triggering immediate backup on $HOST:$PORT ..."
curl -sf -X POST "http://$HOST:$PORT/trigger" \
  -H "Content-Type: application/json" \
  -d '{"source": "manual"}' | python3 -m json.tool || echo "(no JSON response)"
echo "Done."

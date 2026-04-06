#!/usr/bin/env bash
# Test get_contacts_by_tag via the live MCP StreamableHTTP endpoint.
# Usage: ./test-contacts-tag.sh [BASE_URL]
# Example: ./test-contacts-tag.sh https://gm-baptist-mcp-nytse.ondigitalocean.app

set -euo pipefail

BASE="${1:-https://gm-baptist-mcp-nytse.ondigitalocean.app}"
MCP="$BASE/mcp"

echo "==> Step 1: Initialize MCP session"
INIT_RESP=$(curl -s -D /tmp/mcp-headers -X POST "$MCP" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {},
      "clientInfo": { "name": "test-script", "version": "1.0.0" }
    }
  }')

echo "$INIT_RESP" | head -20

# Extract session ID from response headers
SESSION_ID=$(grep -i 'mcp-session-id' /tmp/mcp-headers | tr -d '\r' | awk '{print $2}')
echo "Session ID: $SESSION_ID"

if [ -z "$SESSION_ID" ]; then
  echo "ERROR: No session ID returned. Full headers:"
  cat /tmp/mcp-headers
  exit 1
fi

echo ""
echo "==> Step 2: Call get_contacts_by_tag (locationId=x7nLyDSHiewYRtwYlX0h, tags=[\"platinum\"], limit=10)"
TOOL_RESP=$(curl -s -X POST "$MCP" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "get_contacts_by_tag",
      "arguments": {
        "locationId": "x7nLyDSHiewYRtwYlX0h",
        "tags": ["platinum"],
        "limit": 10
      }
    }
  }')

echo "$TOOL_RESP" | python3 -m json.tool 2>/dev/null || echo "$TOOL_RESP"

echo ""
echo "==> Step 3: Cleanup — close session"
curl -s -X DELETE "$MCP" -H "mcp-session-id: $SESSION_ID" | python3 -m json.tool 2>/dev/null

echo ""
echo "Done."

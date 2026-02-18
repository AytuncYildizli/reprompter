#!/bin/bash
# push-dashboard-data.sh — Collect real system data and push to Neon DB
# Run manually or via cron to keep the dashboard up to date.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DASHBOARD_DIR="$HOME/clawd/projects/openclaw-dashboard"

# ── DB connection ──
DB_URL=""
if [[ -f "$DASHBOARD_DIR/.env.local" ]]; then
  DB_URL="$(grep '^DATABASE_URL_UNPOOLED=' "$DASHBOARD_DIR/.env.local" | cut -d= -f2- | tr -d '"')"
fi
if [[ -z "$DB_URL" ]]; then
  echo "ERROR: DATABASE_URL_UNPOOLED not found in $DASHBOARD_DIR/.env.local"
  exit 1
fi

# ── Helper: insert/update a key ──
upsert_key() {
  local key="$1"
  local json_data="$2"
  PGPASSWORD="npg_9ZYTnIP2Fejc" psql "$DB_URL" -q -c "
    INSERT INTO system_status (key, data, updated_at)
    VALUES ('$key', '$json_data'::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET data = '$json_data'::jsonb, updated_at = NOW();
  " 2>/dev/null
}

echo "📊 Collecting dashboard data..."

# ═══════════════════════════════════════════
# 1. AUTH DATA
# ═══════════════════════════════════════════
echo "  → Auth profiles..."
AUTH_JSON="{}"
if [[ -f "$SCRIPT_DIR/auth-dashboard-data.sh" ]]; then
  AUTH_JSON="$(bash "$SCRIPT_DIR/auth-dashboard-data.sh" 2>/dev/null)" || AUTH_JSON="{}"
fi

# ═══════════════════════════════════════════
# 2. AGENTS DATA
# ═══════════════════════════════════════════
echo "  → Agent data..."

AGENTS_DIR="$HOME/.openclaw/agents"
SESSIONS_JSON="$HOME/.openclaw/.openclaw/agents/main/sessions/sessions.json"

# Count active sessions
ACTIVE_SESSIONS=0
if [[ -f "$SESSIONS_JSON" ]]; then
  ACTIVE_SESSIONS="$(python3 -c "
import json, sys
with open('$SESSIONS_JSON') as f:
    data = json.load(f)
print(len(data))
" 2>/dev/null)" || ACTIVE_SESSIONS=0
fi

# List agents
AGENT_LIST="[]"
if [[ -d "$AGENTS_DIR" ]]; then
  AGENT_LIST="$(python3 -c "
import json, os, time

agents_dir = os.path.expanduser('$AGENTS_DIR')
agents = []

for name in sorted(os.listdir(agents_dir)):
    agent_path = os.path.join(agents_dir, name)
    if not os.path.isdir(agent_path) or name.startswith('.'):
        continue
    
    # Get last modified time as proxy for last activity
    stat = os.stat(agent_path)
    last_mod = stat.st_mtime
    
    # Try to read agent config for model info
    model = 'Claude Opus 4.6'
    provider = 'Anthropic'
    
    # Determine department based on name
    dept = 'Core'
    if name.startswith('katman-'):
        dept = 'Katman'
    elif name.startswith('seers-'):
        dept = 'Clawdspiracy'
    elif name in ('memory-curator', 'knowledge-graph', 'archivist'):
        dept = 'Memory'
    elif name in ('health-monitor', 'cron-manager', 'security-agent'):
        dept = 'DevOps'
    elif name in ('market-watch', 'tech-scout', 'competitor-intel'):
        dept = 'Research'
    elif name in ('calendar-agent', 'finance-agent', 'denizevi-agent'):
        dept = 'Personal'
    elif name == 'zero-g':
        dept = 'Special'
    elif name in ('main', 'ziggy', 'forge', 'scout', 'dev', 'research', 'codex'):
        dept = 'Core'
    
    agents.append({
        'id': name,
        'name': name,
        'department': dept,
        'model': model,
        'provider': provider,
        'lastActivity': int(last_mod * 1000),
        'lastActivityIso': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(last_mod)),
    })

print(json.dumps(agents))
" 2>/dev/null)" || AGENT_LIST="[]"
fi

AGENTS_JSON="{\"activeSessions\":$ACTIVE_SESSIONS,\"agents\":$AGENT_LIST,\"totalAgents\":$(echo "$AGENT_LIST" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' 2>/dev/null || echo 0),\"collectedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"

# ═══════════════════════════════════════════
# 3. SYSTEM STATUS DATA
# ═══════════════════════════════════════════
echo "  → System status..."

# Gateway
GW_PID=""
GW_UPTIME=""
GW_STATUS="offline"
GW_LINE="$(ps aux | grep 'openclaw-gateway' | grep -v grep | head -1)" || true
if [[ -n "$GW_LINE" ]]; then
  GW_PID="$(echo "$GW_LINE" | awk '{print $2}')"
  GW_UPTIME="$(ps -p "$GW_PID" -o etime= 2>/dev/null | xargs)" || GW_UPTIME="unknown"
  GW_STATUS="online"
fi

# OpenClaw version
OC_VERSION="$(openclaw --version 2>/dev/null || echo 'unknown')"

# Cron jobs
CRON_FILE="$HOME/.openclaw/.openclaw/cron/jobs.json"
CRON_ENABLED=0
CRON_TOTAL=0
if [[ -f "$CRON_FILE" ]]; then
  CRON_STATS="$(python3 -c "
import json
with open('$CRON_FILE') as f:
    data = json.load(f)
jobs = data.get('jobs', [])
enabled = sum(1 for j in jobs if j.get('enabled', False))
print(f'{enabled}/{len(jobs)}')
" 2>/dev/null)" || CRON_STATS="0/0"
  CRON_ENABLED="$(echo "$CRON_STATS" | cut -d/ -f1)"
  CRON_TOTAL="$(echo "$CRON_STATS" | cut -d/ -f2)"
fi

# Memory (ChromaDB) — via Mahmory dashboard endpoint
MEMORY_DOCS=0
MEMORY_DASHBOARD_JSON="{}"
MEMORY_API="$(curl -s --connect-timeout 3 http://localhost:8787/v1/dashboard 2>/dev/null)" || MEMORY_API=""
if [[ -n "$MEMORY_API" ]]; then
  MEMORY_DOCS="$(echo "$MEMORY_API" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("doc_count",0))' 2>/dev/null)" || MEMORY_DOCS=0
  MEMORY_DASHBOARD_JSON="$(echo "$MEMORY_API" | python3 -c "
import json, sys
d = json.load(sys.stdin)
out = {
    'status': 'online',
    'docs': d.get('doc_count', 0),
    'fts_indexed': d.get('fts', {}).get('indexed_docs', 0),
    'kg_entities': d.get('kg_entities', 0),
    'kg_relations': d.get('kg_relations', 0),
    'kg_facts': d.get('kg_total_facts', 0),
    'kg_types': d.get('kg_entity_types', {}),
    'uptime_seconds': d.get('uptime_seconds', 0),
    'collection': d.get('collection', ''),
    'latency': d.get('latency', {}),
    'analytics': d.get('analytics', {}),
    'security': d.get('security', {}),
    'cache': d.get('cache', {}),
}
print(json.dumps(out))
" 2>/dev/null)" || MEMORY_DASHBOARD_JSON="{\"status\":\"error\"}"
else
  MEMORY_DASHBOARD_JSON="{\"status\":\"offline\",\"docs\":0}"
fi

# Contradictions data from Mahmory
CONTRADICTIONS_JSON="{}"
CONTRADICTIONS_API="$(curl -sf --connect-timeout 3 "http://localhost:8787/v1/contradictions" -H "X-API-Key: ***REMOVED***" 2>/dev/null)" || CONTRADICTIONS_API=""
if [[ -n "$CONTRADICTIONS_API" ]]; then
  CONTRADICTIONS_JSON="$(echo "$CONTRADICTIONS_API" | python3 -c "
import json, sys
d = json.load(sys.stdin)
out = {
    'total': d.get('total', 0),
    'by_type': d.get('by_type', {}),
    'items': [
        {
            'id': c.get('id', ''),
            'type': c.get('type', ''),
            'entity': c.get('entity', ''),
            'severity': c.get('severity', ''),
            'suggestion': c.get('suggestion', ''),
        }
        for c in d.get('contradictions', [])
    ],
}
print(json.dumps(out))
" 2>/dev/null)" || CONTRADICTIONS_JSON="{}"
fi

# Feedback / adaptive weights from Mahmory
FEEDBACK_JSON="{}"
FEEDBACK_API="$(curl -sf --connect-timeout 3 "http://localhost:8787/v1/feedback/stats" -H "X-API-Key: ***REMOVED***" 2>/dev/null)" || FEEDBACK_API=""
if [[ -n "$FEEDBACK_API" ]]; then
  FEEDBACK_JSON="$(echo "$FEEDBACK_API" | python3 -c "
import json, sys
d = json.load(sys.stdin)
out = {
    'total_feedback': d.get('total_feedback', 0),
    'by_query_type': d.get('by_query_type', {}),
    'optimal_weights': d.get('optimal_weights', {}),
    'default_weights': d.get('default_weights', {}),
}
print(json.dumps(out))
" 2>/dev/null)" || FEEDBACK_JSON="{}"
fi

# Merge contradictions + feedback into MEMORY_DASHBOARD_JSON
MEMORY_DASHBOARD_JSON="$(python3 -c "
import json, sys, os
mem = json.loads(sys.argv[1])
contra = json.loads(sys.argv[2])
feedback = json.loads(sys.argv[3])
mem['contradictions'] = contra
mem['feedback'] = feedback
print(json.dumps(mem))
" "$MEMORY_DASHBOARD_JSON" "$CONTRADICTIONS_JSON" "$FEEDBACK_JSON" 2>/dev/null)" || true

# Channels
CH_WHATSAPP="offline"
CH_SLACK="offline"
CH_TELEGRAM="offline"
CH_EMAIL="offline"

# WhatsApp is online if gateway is running (it connects to WhatsApp)
if [[ "$GW_STATUS" == "online" ]]; then
  CH_WHATSAPP="online"
  CH_SLACK="online"
  CH_EMAIL="online"
fi

# Telegram — check if telegram bot process exists
if ps aux | grep -q "[t]elegram" 2>/dev/null; then
  CH_TELEGRAM="online"
else
  CH_TELEGRAM="idle"
fi

# Disk usage
DISK_INFO="$(df -h / | tail -1)"
DISK_USED="$(echo "$DISK_INFO" | awk '{print $3}')"
DISK_TOTAL="$(echo "$DISK_INFO" | awk '{print $2}')"
DISK_PCT="$(echo "$DISK_INFO" | awk '{print $5}' | tr -d '%')"

# RAM
RAM_BYTES="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"
RAM_GB="$(echo "scale=0; $RAM_BYTES / 1073741824" | bc 2>/dev/null || echo 0)"

# Host info
HOSTNAME="$(hostname -s 2>/dev/null || echo 'unknown')"

SYSTEM_JSON="$(python3 -c "
import json, time

data = {
    'gateway': {
        'status': '$GW_STATUS',
        'pid': '$GW_PID' if '$GW_PID' else None,
        'uptime': '$GW_UPTIME' if '$GW_UPTIME' else None,
        'version': '$OC_VERSION',
        'host': '$HOSTNAME',
    },
    'crons': {
        'enabled': $CRON_ENABLED,
        'total': $CRON_TOTAL,
    },
    'memory': {
        'docs': $MEMORY_DOCS,
    },
    'channels': {
        'whatsapp': '$CH_WHATSAPP',
        'slack': '$CH_SLACK',
        'telegram': '$CH_TELEGRAM',
        'email': '$CH_EMAIL',
    },
    'disk': {
        'used': '$DISK_USED',
        'total': '$DISK_TOTAL',
        'pct': $DISK_PCT,
    },
    'ram': {
        'totalGb': $RAM_GB,
    },
    'collectedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
}

print(json.dumps(data))
")"

# ═══════════════════════════════════════════
# 4. PUSH TO NEON DB
# ═══════════════════════════════════════════
echo "  → Pushing to Neon DB..."

# Escape single quotes in JSON for SQL
escape_json() {
  echo "$1" | sed "s/'/''/g"
}

upsert_key "auth_profiles" "$(escape_json "$AUTH_JSON")"
echo "    ✓ auth_profiles"

upsert_key "agents" "$(escape_json "$AGENTS_JSON")"
echo "    ✓ agents"

upsert_key "system" "$(escape_json "$SYSTEM_JSON")"
echo "    ✓ system"

upsert_key "memory_detail" "$(escape_json "$MEMORY_DASHBOARD_JSON")"
echo "    ✓ memory_detail"

echo ""
echo "✅ Dashboard data pushed to Neon DB at $(date)"

# Verify
echo ""
echo "📋 Verification:"
PGPASSWORD="npg_9ZYTnIP2Fejc" psql "$DB_URL" -q -c "SELECT key, updated_at, pg_column_size(data) as bytes FROM system_status ORDER BY key;" 2>/dev/null

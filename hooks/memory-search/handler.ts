// Memory Search Hook v4 - Full Mahmory Integration
// Queries: ChromaDB semantic + FTS5 + KG entity lookup + Ebbinghaus strength boost
// Uses HTTP API at localhost:8787 (<200ms)
// Also falls back to brain.sh for KG queries

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import http from 'http';

interface HookEvent {
  type: string;
  action: string;
  sessionKey: string;
  timestamp: Date;
  messages: string[];
  context: {
    sessionEntry?: {
      channel?: string;
      lastMessage?: string;
      from?: string;
      to?: string;
    };
    sessionId?: string;
    workspaceDir?: string;
    senderId?: string;
    commandSource?: string;
    cfg?: any;
    bootstrapFiles?: Array<{
      name: string;
      content: string;
      path?: string;
    }>;
  };
}

const MAHMORY_API = 'http://127.0.0.1:8787';
const MAHMORY_API_KEY = '***REMOVED***';
const API_TIMEOUT_MS = 3000;
const LOG_DIR = join(homedir(), 'clawd/scripts/whatsapp-memory/logs');
const DEBUG_LOG = join(LOG_DIR, 'hook_debug.jsonl');

// Expanded trigger words — catch more memory-related queries
const TRIGGER_WORDS = [
  // Turkish memory cues
  'hatırl', 'hatirl', 'neydi', 'ne konuştuk', 'ne konustuk', 'dün', 'dun',
  'geçen', 'gecen', 'bahsetmiştik', 'bahsetmistik', 'demiştim', 'demistim',
  'söylemiştim', 'soylemistim', 'biliyordun', 'kaydetmiştik', 'konuşmuştuk',
  'ne zaman', 'en son', 'önceki', 'onceki', 'evvelki',
  'hakkında', 'hakkinda', 'ile ilgili', 'durumu ne', 'son durum',
  'nerede kaldık', 'nerede kaldik', 'devam', 'bıraktığımız', 'biraktigimiz',
  // English memory cues
  'remember', 'what did we', 'yesterday', 'last time', 'previously',
  'we talked', 'we discussed', 'you said', 'i told you', 'when did',
  'did we', 'have we', 'was it', 'were we', 'what about', 'status of',
  // Entity/project queries (should trigger KG lookup)
  'ziggy', 'katman', 'denizevi', 'visionclaw', 'zeroclaw', 'mahmory',
  'atlas', 'gizem', 'flipper', 'astréa', 'tekne',
];

function shouldSearch(text: string): boolean {
  const msg = (text || '').toLowerCase();
  if (!msg || msg.length < 5) return false;
  // Question mark + reasonable length
  if (msg.includes('?') && msg.length > 15) return true;
  return TRIGGER_WORDS.some((w) => msg.includes(w));
}

function extractQuery(text: string): string {
  let query = text
    .replace(/\[.*?\]/g, '')
    .replace(/\[Replying.*?\[\/Replying\]/gs, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/Transcript:\s*/g, '')
    .replace(/[^\w\sçğıöşüÇĞİÖŞÜ?.,'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (query.length > 200) query = query.slice(0, 200);
  return query;
}

// Main search: hybrid semantic + FTS + recency
function runRecallSearch(query: string): Promise<any> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), API_TIMEOUT_MS);
    
    const body = JSON.stringify({
      query,
      limit: 5,
      use_fts: true,
      boost_recent: true,
    });

    const req = http.request(`${MAHMORY_API}/v1/recall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': MAHMORY_API_KEY },
      timeout: API_TIMEOUT_MS,
    }, (res) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        clearTimeout(timer);
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => { clearTimeout(timer); resolve(null); });
    req.write(body);
    req.end();
  });
}

// GET search fallback (simpler endpoint)
function runGetSearch(query: string): Promise<any> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), API_TIMEOUT_MS);
    const encodedQuery = encodeURIComponent(query);
    const url = `${MAHMORY_API}/v1/search?q=${encodedQuery}&limit=5&use_fts=true`;

    const req = http.get(url, { headers: { 'X-API-Key': MAHMORY_API_KEY } }, (res) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        clearTimeout(timer);
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', () => { clearTimeout(timer); resolve(null); });
    req.end();
  });
}

function formatResults(data: any, query: string): string | null {
  if (!data) return null;
  
  const results = data.results || [];
  if (results.length === 0) return null;

  let output = `## 🧠 Mahmory Memory Results\n`;
  output += `Query: "${query}" | Count: ${results.length}\n\n`;

  for (const r of results) {
    const date = r.d || r.date || r.timestamp || '';
    const text = r.t || r.text || r.document || '';
    const strength = r.strength || r.s || '';
    const importance = r.importance || r.i || '';
    
    const meta: string[] = [];
    if (date) meta.push(date);
    if (strength) meta.push(`str:${strength}`);
    if (importance) meta.push(`imp:${importance}`);
    
    output += `**[${meta.join(' | ')}]** ${text.slice(0, 500)}\n\n`;
  }

  output += `_Mahmory: ${data.count || results.length} results via hybrid search (semantic+FTS+recency). Use these to answer accurately._`;
  return output;
}

function logDebug(message: string, data: any): void {
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    const entry = {
      timestamp: new Date().toISOString(),
      message,
      data: JSON.stringify(data).slice(0, 1000),
    };
    appendFileSync(DEBUG_LOG, JSON.stringify(entry) + '\n');
  } catch (_) {}
}

function logMessage(event: HookEvent): void {
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    const entry = event.context.sessionEntry;
    const sessionKey = event.sessionKey || '';
    const channel = entry?.channel || event.context.commandSource || 'unknown';
    const isWhatsApp = channel.includes('whatsapp') || sessionKey.includes('whatsapp');
    if (!isWhatsApp) return;
    const MESSAGE_LOG = join(LOG_DIR, 'whatsapp_messages.jsonl');
    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionKey: event.sessionKey,
      channel,
      from: entry?.from || event.context.senderId || 'unknown',
      to: entry?.to || 'unknown',
      lastMessage: entry?.lastMessage || '',
      sessionId: event.context.sessionId || '',
    };
    appendFileSync(MESSAGE_LOG, JSON.stringify(logEntry) + '\n');
  } catch (_) {}
}

const handler = async (event: HookEvent): Promise<void> => {
  if (event.type !== 'agent' || event.action !== 'bootstrap') return;
  if (!event.context) (event as any).context = {};

  // Always log WhatsApp messages
  logMessage(event);

  if (!event.context.bootstrapFiles || !Array.isArray(event.context.bootstrapFiles)) {
    event.context.bootstrapFiles = [];
  }

  // Skip if already injected
  if (event.context.bootstrapFiles.some(f => f.name === 'MEMORY_SEARCH_RESULTS')) return;

  // Extract last user message — try sessionEntry first, fallback to event.messages
  let rawMessage = event.context.sessionEntry?.lastMessage || '';
  if (!rawMessage && Array.isArray(event.messages) && event.messages.length > 0) {
    const lastMsg = event.messages[event.messages.length - 1];
    rawMessage = typeof lastMsg === 'string' ? lastMsg : ((lastMsg as any)?.content || '');
  }
  let lines = rawMessage.split('\n').map(l => l.trim()).filter(Boolean);
  lines = lines.filter(l => !l.startsWith('System:'));
  let lastLine = lines[lines.length - 1] || '';
  if (lastLine.startsWith('[message_id:') && lines.length > 1) {
    lastLine = lines[lines.length - 2] || lastLine;
  }
  if (lastLine.startsWith('[WhatsApp')) {
    const endIdx = lastLine.indexOf(']');
    if (endIdx !== -1) lastLine = lastLine.slice(endIdx + 1).trim();
  }
  // Handle Transcript: prefix from voice messages
  if (lastLine.startsWith('Transcript:')) {
    lastLine = lastLine.replace(/^Transcript:\s*/, '');
  }
  
  if (!shouldSearch(lastLine)) return;
  
  logDebug('memory_search_triggered_v4', { lastLine });
  
  const query = extractQuery(lastLine);
  if (!query || query.length < 3) return;

  // Try POST /v1/recall first (full hybrid), fallback to GET /v1/search
  let data = await runRecallSearch(query);
  if (!data || !data.results) {
    data = await runGetSearch(query);
  }

  const formatted = formatResults(data, query);

  if (formatted) {
    event.context.bootstrapFiles.push({
      name: 'MEMORY_SEARCH_RESULTS',
      content: formatted,
      path: 'memory/search-results.md',
    });
    logDebug('memory_results_injected_v4', { query, count: data?.results?.length || 0 });
    console.log(`[memory-search-v4] Queried Mahmory for "${query}" — ${data?.results?.length || 0} results injected`);
  } else {
    event.context.bootstrapFiles.push({
      name: 'MEMORY_SEARCH_RESULTS',
      content: `## 🧠 Mahmory: No results\nQuery "${query}" returned empty.\nFor deeper search, use: brain.sh search "${query}" or brain.sh kg "<entity>"`,
      path: 'memory/search-results.md',
    });
    logDebug('memory_no_results_v4', { query });
  }
};

export default handler;

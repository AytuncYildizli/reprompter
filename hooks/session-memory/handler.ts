// Session Memory Hook - Tracks messages for compaction recovery
// Saves last N messages to memory/last-messages.json
// Used by pre-compaction-save and post-compaction-restore hooks

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface HookEvent {
  type: string;
  action: string;
  sessionKey: string;
  timestamp: Date;
  messages: Array<{ role: string; content: string; timestamp?: string }> | string[];
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

interface StoredMessage {
  role: string;
  content: string;
  timestamp: string;
  sessionKey: string;
}

const MAX_MESSAGES = 30; // Keep last 30 messages
const MAX_CONTENT_LENGTH = 2000; // Truncate long messages

function normalizeMessage(msg: any): { role: string; content: string } | null {
  if (typeof msg === 'string') {
    return { role: 'unknown', content: msg };
  }
  if (msg && typeof msg === 'object' && msg.content) {
    return {
      role: msg.role || 'unknown',
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    };
  }
  return null;
}

function readExistingMessages(filePath: string): StoredMessage[] {
  if (!existsSync(filePath)) return [];
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

const handler = async (event: HookEvent): Promise<void> => {
  // Trigger on bootstrap and message events
  if (event.type !== 'agent') return;
  if (event.action !== 'bootstrap' && event.action !== 'message') return;

  const workspaceDir = event.context?.workspaceDir;
  if (!workspaceDir) return;

  const memoryDir = join(workspaceDir, 'memory');
  if (!existsSync(memoryDir)) {
    mkdirSync(memoryDir, { recursive: true });
  }

  const filePath = join(memoryDir, 'last-messages.json');
  const now = new Date().toISOString();

  // Read existing messages
  let stored = readExistingMessages(filePath);

  // Extract new messages from event
  const eventMessages = event.messages || [];
  let newMessages: StoredMessage[] = [];

  for (const msg of eventMessages) {
    const normalized = normalizeMessage(msg);
    if (!normalized) continue;

    // Skip system/tool messages and very short messages
    if (normalized.role === 'system') continue;
    if (normalized.content.length < 2) continue;
    // Skip messages that look like tool calls
    if (normalized.content.startsWith('{') && normalized.content.includes('"tool"')) continue;

    const truncated = normalized.content.length > MAX_CONTENT_LENGTH
      ? normalized.content.slice(0, MAX_CONTENT_LENGTH) + '...'
      : normalized.content;

    newMessages.push({
      role: normalized.role,
      content: truncated,
      timestamp: now,
      sessionKey: event.sessionKey,
    });
  }

  if (newMessages.length === 0) {
    // On bootstrap with last message in sessionEntry, capture that
    const lastMsg = event.context.sessionEntry?.lastMessage;
    if (lastMsg && lastMsg.length > 2) {
      // Strip WhatsApp prefix if present
      let cleanMsg = lastMsg;
      if (cleanMsg.startsWith('[WhatsApp')) {
        const endIdx = cleanMsg.indexOf(']');
        if (endIdx !== -1) cleanMsg = cleanMsg.slice(endIdx + 1).trim();
      }

      const truncated = cleanMsg.length > MAX_CONTENT_LENGTH
        ? cleanMsg.slice(0, MAX_CONTENT_LENGTH) + '...'
        : cleanMsg;

      newMessages.push({
        role: 'user',
        content: truncated,
        timestamp: now,
        sessionKey: event.sessionKey,
      });
    }
  }

  if (newMessages.length === 0) return;

  // Dedup: skip if last stored message has same content
  if (stored.length > 0 && newMessages.length > 0) {
    const lastStored = stored[stored.length - 1];
    const firstNew = newMessages[0];
    if (lastStored.content === firstNew.content) {
      // Already captured
      return;
    }
  }

  // Append and trim
  stored = [...stored, ...newMessages].slice(-MAX_MESSAGES);

  try {
    writeFileSync(filePath, JSON.stringify(stored, null, 2));
    console.log(`[session-memory] Saved ${newMessages.length} messages (total: ${stored.length})`);
  } catch (err) {
    console.error('[session-memory] Failed to write:', err);
  }
};

export default handler;

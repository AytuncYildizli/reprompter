// Post-compaction context restore hook - ENHANCED
// AMNESIA PREVENTION SYSTEM v2
// Now reads from pre-compaction-save snapshots + SESSION_STATE + last-messages

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

interface HookEvent {
  type: string;
  action: string;
  sessionKey: string;
  timestamp: Date;
  messages: string[];
  context: {
    sessionEntry?: any;
    sessionId?: string;
    sessionFile?: string;
    commandSource?: string;
    senderId?: string;
    workspaceDir?: string;
    bootstrapFiles?: Array<{
      name: string;
      content: string;
      path?: string;
    }>;
    cfg?: any;
  };
}

interface CriticalContext {
  savedAt: string;
  sessionKey: string;
  compactionCount: number;
  activeTasks: string[];
  recentDecisions: string[];
  pendingItems: string[];
  userPreferences: Record<string, any>;
  conversationThemes: string[];
  activeFiles: string[];
  lastCommands: string[];
  workingContext: string;
  messageSummary: string;
  lastMessageCount: number;
}

// Read critical context snapshot
function readCriticalContext(workspaceDir: string): CriticalContext | null {
  const snapshotPath = join(workspaceDir, 'memory', 'critical-context-snapshot.json');
  if (!existsSync(snapshotPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(snapshotPath, 'utf-8'));
  } catch (err) {
    console.error('[post-compaction-restore] Error reading critical context:', err);
    return null;
  }
}

// Read SESSION_STATE.md
function readSessionState(workspaceDir: string): string {
  const statePath = join(workspaceDir, 'SESSION_STATE.md');
  if (!existsSync(statePath)) {
    return '';
  }

  try {
    return readFileSync(statePath, 'utf-8');
  } catch (err) {
    console.error('[post-compaction-restore] Error reading SESSION_STATE.md:', err);
    return '';
  }
}

// Read last messages
function readLastMessages(workspaceDir: string): Array<{ role: string; content: string; timestamp?: string }> {
  const lastMessagesPath = join(workspaceDir, 'memory', 'last-messages.json');
  if (!existsSync(lastMessagesPath)) {
    return [];
  }

  try {
    return JSON.parse(readFileSync(lastMessagesPath, 'utf-8'));
  } catch (err) {
    console.log('[post-compaction-restore] Error reading last-messages.json:', err);
    return [];
  }
}

// Format last messages for display
function formatLastMessages(
  messages: Array<{ role: string; content: string; timestamp?: string }>,
  maxMessages: number = 8
): string {
  if (messages.length === 0) return '';

  return messages
    .slice(-maxMessages)
    .map((m, i) => {
      const time = m.timestamp ? ` (${new Date(m.timestamp).toLocaleTimeString('tr-TR')})` : '';
      const role = m.role === 'user' ? 'Aytunc' : 'Mahmut';
      // Truncate long messages
      const content = m.content.length > 400 ? m.content.slice(0, 400) + '...' : m.content;
      return `${i + 1}. **${role}**${time}: ${content}`;
    })
    .join('\n\n');
}

const handler = async (event: HookEvent): Promise<void> => {
  // Only trigger on agent:bootstrap
  if (event.type !== 'agent' || event.action !== 'bootstrap') {
    return;
  }

  // Defensive: ensure event.context exists
  if (!event.context) (event as any).context = {};

  const workspaceDir = event.context?.workspaceDir;
  if (!workspaceDir) {
    return;
  }

  // --- WORKAROUND: compactionCount is never set in sessions.json ---
  // Instead of relying on compactionCount, detect compaction via:
  // 1. Check if event messages contain a compaction summary pattern
  // 2. Check if context files exist (SESSION_STATE.md, critical-context-snapshot.json)
  // 3. Use timestamp-based dedup to avoid rapid re-injection

  const markerPath = join(workspaceDir, 'memory', 'compaction-marker.json');

  // Detect compaction: messages containing summary patterns typical of compaction
  let isPostCompaction = false;
  const messages = event.messages || [];
  for (const msg of messages) {
    const text = typeof msg === 'string' ? msg : (msg as any)?.content || '';
    if (
      text.includes('## Goal') ||
      text.includes('This session is being continued') ||
      text.includes('context was summarized') ||
      text.includes('## Summary')
    ) {
      isPostCompaction = true;
      break;
    }
  }

  // Also check if context files exist (always useful to inject)
  const snapshotPath = join(workspaceDir, 'memory', 'critical-context-snapshot.json');
  const statePath = join(workspaceDir, 'SESSION_STATE.md');
  const hasContextFiles = existsSync(snapshotPath) || existsSync(statePath);

  // If no compaction detected AND no context files, skip
  if (!isPostCompaction && !hasContextFiles) {
    return;
  }

  // Timestamp-based dedup: don't re-inject within 60 seconds
  try {
    if (existsSync(markerPath)) {
      const data = JSON.parse(readFileSync(markerPath, 'utf-8'));
      const lastTime = data?.updatedAt;
      if (lastTime) {
        const elapsed = Date.now() - new Date(lastTime).getTime();
        if (elapsed < 60_000) {
          // Already injected recently, skip
          return;
        }
      }
    }
  } catch (err) {
    console.log('[post-compaction-restore] Failed to read compaction marker:', err);
  }

  // === GATHER ALL CONTEXT SOURCES ===

  // 1. Critical context from pre-compaction-save
  const criticalContext = readCriticalContext(workspaceDir);

  // 2. SESSION_STATE.md
  const sessionStateContent = readSessionState(workspaceDir);

  // 3. Last messages
  const lastMessages = readLastMessages(workspaceDir);

  // === BUILD INJECTION CONTENT ===

  let compactionReminder = `
# COMPACTION RECOVERY - AMNESIA PREVENTION

**Session compacted.** Context restored automatically.

---
`;

  // Add critical context if available
  if (criticalContext) {
    const themes = Array.isArray(criticalContext.conversationThemes) ? criticalContext.conversationThemes : [];
    const decisions = Array.isArray(criticalContext.recentDecisions) ? criticalContext.recentDecisions : [];
    const tasks = Array.isArray(criticalContext.activeTasks) ? criticalContext.activeTasks : [];
    const pending = Array.isArray(criticalContext.pendingItems) ? criticalContext.pendingItems : [];

    compactionReminder += `
## Recent Context (Pre-Compaction Snapshot)

**Themes:** ${themes.join(', ') || 'None detected'}

`;

    if (decisions.length > 0) {
      compactionReminder += `### Recent Decisions
${decisions.map(d => `- ${String(d).slice(0, 200)}`).join('\n')}

`;
    }

    if (tasks.length > 0) {
      compactionReminder += `### Active Tasks
${tasks.map(t => `- ${t}`).join('\n')}

`;
    }

    if (pending.length > 0) {
      compactionReminder += `### Pending Items
${pending.map(p => `- ${p}`).join('\n')}

`;
    }
  }

  // Add SESSION_STATE.md if available
  if (sessionStateContent) {
    compactionReminder += `
## SESSION_STATE.md
${sessionStateContent}

`;
  }

  // Add last messages
  const formattedMessages = formatLastMessages(lastMessages);
  if (formattedMessages) {
    compactionReminder += `
## Son ${Math.min(lastMessages.length, 8)} Mesaj
${formattedMessages}

`;
  }

  // Add rules
  compactionReminder += `
---
## KURALLAR (RULES)

**YAPMA:**
- Yeni bir gun gibi selamlasmak
- "Ne yapmistik?" diye sormak - yukarda yaziyor
- Context'i kaybetmis gibi davranmak

**YAP:**
- Konusmaya dogal devam et
- Yukaridaki context'i kullan
- Daha eski bilgi icin: \`memory_search\` tool veya \`~/clawd/scripts/whatsapp-memory/search_v3.sh "query"\`

---
`;

  // === INJECT INTO BOOTSTRAP ===

  if (!event.context.bootstrapFiles || !Array.isArray(event.context.bootstrapFiles)) {
    event.context.bootstrapFiles = [];
  }

  const existingIndex = event.context.bootstrapFiles.findIndex(
    (f) => f.name === 'COMPACTION_RECOVERY'
  );

  if (existingIndex >= 0) {
    event.context.bootstrapFiles[existingIndex].content = compactionReminder;
  } else {
    event.context.bootstrapFiles.push({
      name: 'COMPACTION_RECOVERY',
      content: compactionReminder,
      path: join(workspaceDir, 'memory', 'critical-context.md'),
    });
  }

  console.log(`[post-compaction-restore] Injected recovery context: postCompaction=${isPostCompaction}, ${lastMessages.length} messages, critical context: ${criticalContext ? 'yes' : 'no'}`);

  // Record injection marker
  try {
    const markerDir = join(workspaceDir, 'memory');
    if (!existsSync(markerDir)) {
      mkdirSync(markerDir, { recursive: true });
    }
    writeFileSync(
      markerPath,
      JSON.stringify(
        {
          updatedAt: new Date().toISOString(),
          isPostCompaction,
          injectedSources: {
            criticalContext: !!criticalContext,
            sessionState: !!sessionStateContent,
            lastMessages: lastMessages.length,
          },
        },
        null,
        2
      )
    );
  } catch (err) {
    console.log('[post-compaction-restore] Failed to write compaction marker:', err);
  }
};

export default handler;

// Pre-Compaction Save Hook - AMNESIA PREVENTION SYSTEM
// Saves critical context BEFORE compaction to prevent context loss
// Part of Phase 2: Amnesia Prevention for OpenClaw

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface HookEvent {
  type: string;
  action: string;
  sessionKey: string;
  timestamp: Date;
  messages: Array<{ role: string; content: string; timestamp?: string }>;
  context: {
    sessionEntry?: {
      channel?: string;
      lastMessage?: string;
      from?: string;
      to?: string;
      compactionCount?: number;
    };
    sessionId?: string;
    sessionFile?: string;
    workspaceDir?: string;
    senderId?: string;
    commandSource?: string;
    cfg?: any;
  };
}

interface CriticalContext {
  savedAt: string;
  sessionKey: string;
  compactionCount: number;

  // Active tasks and decisions
  activeTasks: string[];
  recentDecisions: string[];
  pendingItems: string[];

  // User context
  userPreferences: Record<string, any>;
  conversationThemes: string[];

  // Technical state
  activeFiles: string[];
  lastCommands: string[];
  workingContext: string;

  // Last N messages summary
  messageSummary: string;
  lastMessageCount: number;
}

// Extract key information from messages
function extractConversationContext(messages: Array<{ role: string; content: string }>): {
  themes: string[];
  decisions: string[];
  tasks: string[];
  summary: string;
} {
  const themes: Set<string> = new Set();
  const decisions: string[] = [];
  const tasks: string[] = [];

  // Theme detection keywords
  const themeKeywords: Record<string, string[]> = {
    'memory-system': ['memory', 'search', 'index', 'embedding', 'vector'],
    'compaction': ['compaction', 'compact', 'token', 'context loss'],
    'whatsapp': ['whatsapp', 'message', 'chat'],
    'development': ['code', 'api', 'config', 'setup', 'fix', 'bug'],
    'flight': ['flight', 'check-in', 'airport', 'travel'],
    'email': ['email', 'inbox', 'mail'],
    'cost-optimization': ['cost', 'price', 'money', 'expensive', 'cheap', 'free'],
  };

  // Decision indicators
  const decisionIndicators = [
    'karar verdik', 'let\'s go with', 'aynen', 'tamam', 'ok ', 'okay',
    'kalsın', 'yapalım', 'decided', 'agreed', 'confirmed'
  ];

  // Task indicators
  const taskIndicators = [
    'yapılacak', 'todo', 'need to', 'should', 'must', 'lazım', 'gerek'
  ];

  const recentMessages = messages.slice(-20); // Focus on recent context

  for (const msg of recentMessages) {
    const content = (msg.content || '').toLowerCase();

    // Detect themes
    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      if (keywords.some(kw => content.includes(kw))) {
        themes.add(theme);
      }
    }

    // Detect decisions (user messages only - those are confirmations)
    if (msg.role === 'user') {
      if (decisionIndicators.some(ind => content.includes(ind))) {
        // Extract the decision context from previous assistant message
        const idx = recentMessages.indexOf(msg);
        if (idx > 0) {
          const prevMsg = recentMessages[idx - 1];
          if (prevMsg.role === 'assistant') {
            const shortContent = prevMsg.content.slice(0, 200);
            decisions.push(`User confirmed: ${shortContent}...`);
          }
        }
      }
    }

    // Detect pending tasks
    if (taskIndicators.some(ind => content.includes(ind))) {
      const lines = msg.content.split('\n');
      for (const line of lines) {
        if (line.includes('[ ]') || taskIndicators.some(ind => line.toLowerCase().includes(ind))) {
          tasks.push(line.trim().slice(0, 150));
        }
      }
    }
  }

  // Create summary from last 5 messages
  const summaryMessages = messages.slice(-5);
  const summary = summaryMessages
    .map(m => {
      const role = m.role === 'user' ? 'U' : 'A';
      const content = m.content.slice(0, 150).replace(/\n/g, ' ');
      return `[${role}]: ${content}`;
    })
    .join('\n');

  return {
    themes: Array.from(themes),
    decisions: decisions.slice(-5), // Last 5 decisions
    tasks: tasks.slice(-10), // Last 10 tasks
    summary
  };
}

// Read current SESSION_STATE.md if exists
function readSessionState(workspaceDir: string): {
  activeTasks: string[];
  pendingItems: string[];
  workingContext: string;
} {
  const statePath = join(workspaceDir, 'SESSION_STATE.md');
  const result = {
    activeTasks: [] as string[],
    pendingItems: [] as string[],
    workingContext: ''
  };

  if (!existsSync(statePath)) {
    return result;
  }

  try {
    const content = readFileSync(statePath, 'utf-8');
    result.workingContext = content;

    // Extract tasks with [ ]
    const taskMatches = content.match(/\[ \].+/g) || [];
    result.activeTasks = taskMatches.map(t => t.trim());

    // Extract pending section
    const pendingMatch = content.match(/## Pending\n([\s\S]*?)(?=##|$)/);
    if (pendingMatch) {
      const pendingLines = pendingMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
      result.pendingItems = pendingLines.map(l => l.trim());
    }
  } catch (err) {
    console.error('[pre-compaction-save] Error reading SESSION_STATE.md:', err);
  }

  return result;
}

// Save critical context snapshot
function saveCriticalContext(context: CriticalContext, workspaceDir: string): void {
  const memoryDir = join(workspaceDir, 'memory');
  if (!existsSync(memoryDir)) {
    mkdirSync(memoryDir, { recursive: true });
  }

  // Save as JSON for programmatic access
  const snapshotPath = join(memoryDir, 'critical-context-snapshot.json');
  writeFileSync(snapshotPath, JSON.stringify(context, null, 2));

  // Save as Markdown for human readability + agent injection
  const mdPath = join(memoryDir, 'critical-context.md');
  const mdContent = `# Critical Context Snapshot
**Saved At:** ${context.savedAt}
**Session:** ${context.sessionKey}
**Compaction Count:** ${context.compactionCount}

## Active Tasks
${context.activeTasks.map(t => `- ${t}`).join('\n') || '- None'}

## Recent Decisions
${context.recentDecisions.map(d => `- ${d}`).join('\n') || '- None'}

## Pending Items
${context.pendingItems.map(p => `- ${p}`).join('\n') || '- None'}

## Conversation Themes
${context.conversationThemes.map(t => `- ${t}`).join('\n') || '- None'}

## Last ${context.lastMessageCount} Messages Summary
\`\`\`
${context.messageSummary}
\`\`\`

## Working Context
${context.workingContext || 'No session state found'}
`;

  writeFileSync(mdPath, mdContent);

  // Also save to daily archive for long-term memory
  const dailyDir = join(workspaceDir, 'memory', 'daily-snapshots');
  if (!existsSync(dailyDir)) {
    mkdirSync(dailyDir, { recursive: true });
  }

  const today = new Date().toISOString().split('T')[0];
  const dailyPath = join(dailyDir, `${today}-snapshot.json`);

  // Append to daily log (multiple snapshots per day)
  let dailySnapshots: CriticalContext[] = [];
  if (existsSync(dailyPath)) {
    try {
      dailySnapshots = JSON.parse(readFileSync(dailyPath, 'utf-8'));
    } catch {
      dailySnapshots = [];
    }
  }

  dailySnapshots.push(context);

  // Keep last 20 snapshots per day
  if (dailySnapshots.length > 20) {
    dailySnapshots = dailySnapshots.slice(-20);
  }

  writeFileSync(dailyPath, JSON.stringify(dailySnapshots, null, 2));

  console.log(`[pre-compaction-save] Saved critical context: ${context.conversationThemes.length} themes, ${context.recentDecisions.length} decisions, ${context.activeTasks.length} tasks`);
}

const handler = async (event: HookEvent): Promise<void> => {
  // OpenClaw internal hooks only fire: agent:bootstrap, command:stop, command:new
  // Compaction events (before_compaction, after_compaction) are extension API only.
  // So we save snapshots on every bootstrap and /new to keep context always fresh.
  const validTriggers = [
    { type: 'agent', action: 'bootstrap' },
    { type: 'command', action: 'new' },
  ];

  const isValidTrigger = validTriggers.some(
    t => event.type === t.type && event.action === t.action
  );

  if (!isValidTrigger) {
    return;
  }

  // Defensive: ensure event.context exists
  if (!event.context) (event as any).context = {};

  const workspaceDir = event.context?.workspaceDir || join(homedir(), 'clawd');

  console.log(`[pre-compaction-save] Triggered on ${event.type}:${event.action}`);

  // Extract context from messages
  const conversationContext = extractConversationContext(event.messages || []);

  // Read current session state
  const sessionState = readSessionState(workspaceDir);

  // Build critical context object
  const criticalContext: CriticalContext = {
    savedAt: new Date().toISOString(),
    sessionKey: event.sessionKey,
    compactionCount: 0, // Not tracked by OpenClaw internal hooks

    activeTasks: sessionState.activeTasks,
    recentDecisions: conversationContext.decisions,
    pendingItems: sessionState.pendingItems,

    userPreferences: {
      language: 'tr-en-mixed', // Detected from conversation
      responseStyle: 'concise',
    },
    conversationThemes: conversationContext.themes,

    activeFiles: [], // Could be populated from bash history if available
    lastCommands: [],
    workingContext: sessionState.workingContext,

    messageSummary: conversationContext.summary,
    lastMessageCount: Math.min(event.messages?.length || 0, 5),
  };

  // Save the context
  saveCriticalContext(criticalContext, workspaceDir);
};

export default handler;

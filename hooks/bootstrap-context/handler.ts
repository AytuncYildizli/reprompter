// Bootstrap Context Hook - SESSION START CONTEXT INJECTION
// Provides rich context at every session start without being asked
// Part of Memory Architecture v2.0

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface HookEvent {
  type: string;
  action: string;
  sessionKey: string;
  timestamp: Date;
  context: {
    sessionEntry?: {
      channel?: string;
      compactionCount?: number;
    };
    workspaceDir?: string;
    bootstrapFiles?: Array<{
      name: string;
      content: string;
      path?: string;
    }>;
  };
}

interface DailySummary {
  date: string;
  highlights: string[];
  decisions: string[];
  pendingTasks: string[];
}

// Read and parse daily note
function readDailyNote(memoryDir: string, date: string): DailySummary | null {
  const notePath = join(memoryDir, `${date}.md`);
  if (!existsSync(notePath)) {
    return null;
  }

  try {
    const content = readFileSync(notePath, 'utf-8');
    const summary: DailySummary = {
      date,
      highlights: [],
      decisions: [],
      pendingTasks: []
    };

    // Extract highlights (lines starting with - or * in any section)
    const highlightMatches = content.match(/^[-*]\s+.+/gm) || [];
    summary.highlights = highlightMatches
      .slice(0, 10)
      .map(h => h.replace(/^[-*]\s+/, '').trim());

    // Extract decisions (lines containing "karar", "decided", "confirmed")
    const lines = content.split('\n');
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes('karar') || lower.includes('decided') || lower.includes('confirmed')) {
        summary.decisions.push(line.trim());
      }
    }
    summary.decisions = summary.decisions.slice(0, 5);

    // Extract pending tasks ([ ] or TODO)
    const taskMatches = content.match(/\[ \].+|TODO:.+/gi) || [];
    summary.pendingTasks = taskMatches.slice(0, 10).map(t => t.trim());

    return summary;
  } catch {
    return null;
  }
}

// Get recent memory context
function getRecentContext(workspaceDir: string): string {
  const memoryDir = join(workspaceDir, 'memory');
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
  const twoDaysAgo = new Date(now.getTime() - 172800000).toISOString().split('T')[0];

  let context = '';

  // Today's context
  const todayNote = readDailyNote(memoryDir, today);
  if (todayNote && todayNote.highlights.length > 0) {
    context += `### Today (${today})\n`;
    context += todayNote.highlights.map(h => `- ${h}`).join('\n');
    context += '\n\n';
  }

  // Yesterday's context
  const yesterdayNote = readDailyNote(memoryDir, yesterday);
  if (yesterdayNote && yesterdayNote.highlights.length > 0) {
    context += `### Yesterday (${yesterday})\n`;
    context += yesterdayNote.highlights.slice(0, 5).map(h => `- ${h}`).join('\n');
    context += '\n\n';
  }

  // Pending tasks across all recent notes
  const allPending: string[] = [];
  [todayNote, yesterdayNote].forEach(note => {
    if (note?.pendingTasks) {
      allPending.push(...note.pendingTasks);
    }
  });

  if (allPending.length > 0) {
    context += `### Pending Tasks\n`;
    context += [...new Set(allPending)].slice(0, 10).map(t => `- ${t}`).join('\n');
    context += '\n\n';
  }

  // Recent decisions
  const allDecisions: string[] = [];
  [todayNote, yesterdayNote].forEach(note => {
    if (note?.decisions) {
      allDecisions.push(...note.decisions);
    }
  });

  if (allDecisions.length > 0) {
    context += `### Recent Decisions\n`;
    context += [...new Set(allDecisions)].slice(0, 5).map(d => `- ${d}`).join('\n');
    context += '\n';
  }

  return context;
}

// Read SESSION_STATE.md
function readSessionState(workspaceDir: string): string {
  const statePath = join(workspaceDir, 'SESSION_STATE.md');
  if (!existsSync(statePath)) {
    return '';
  }

  try {
    return readFileSync(statePath, 'utf-8');
  } catch {
    return '';
  }
}

// Read active projects from knowledge graph or daily notes
function getActiveProjects(workspaceDir: string): string[] {
  const projects: Set<string> = new Set();
  const memoryDir = join(workspaceDir, 'memory');

  // Scan recent daily notes for project mentions
  const projectPatterns = [
    /(?:project|proje)[:\s]+(\w+)/gi,
    /working on[:\s]+(\w+)/gi,
    /çalışıyor[:\s]+(\w+)/gi,
  ];

  try {
    const files = readdirSync(memoryDir)
      .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
      .sort()
      .reverse()
      .slice(0, 7); // Last week

    for (const file of files) {
      const content = readFileSync(join(memoryDir, file), 'utf-8');
      for (const pattern of projectPatterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          if (match[1] && match[1].length > 2) {
            projects.add(match[1]);
          }
        }
      }
    }
  } catch {}

  return Array.from(projects).slice(0, 5);
}

// Main handler
const handler = async (event: HookEvent): Promise<void> => {
  // Only trigger on session bootstrap
  if (event.type !== 'agent' || event.action !== 'bootstrap') {
    return;
  }

  // Defensive: ensure event.context exists
  if (!event.context) (event as any).context = {};

  const workspaceDir = event.context?.workspaceDir || join(homedir(), 'clawd');
  const isWhatsApp = event.context?.sessionEntry?.channel === 'whatsapp';

  // Skip if not WhatsApp (or always inject - configurable)
  // Currently: always inject for continuity

  console.log('[bootstrap-context] Preparing session context...');

  // Gather context
  const recentContext = getRecentContext(workspaceDir);
  const sessionState = readSessionState(workspaceDir);
  const activeProjects = getActiveProjects(workspaceDir);

  // Check if we have anything to inject
  if (!recentContext && !sessionState && activeProjects.length === 0) {
    console.log('[bootstrap-context] No context to inject');
    return;
  }

  // Build context injection
  let contextContent = `# Session Context (Auto-Generated)

_This context was automatically gathered from your memory system._

`;

  // Add recent memory context
  if (recentContext) {
    contextContent += `## Recent Activity\n${recentContext}\n`;
  }

  // Add active projects
  if (activeProjects.length > 0) {
    contextContent += `## Active Projects\n`;
    contextContent += activeProjects.map(p => `- ${p}`).join('\n');
    contextContent += '\n\n';
  }

  // Add session state summary (not full content, already loaded separately)
  if (sessionState) {
    // Extract just the active tasks from SESSION_STATE
    const taskMatches = sessionState.match(/\[ \].+/g) || [];
    if (taskMatches.length > 0) {
      contextContent += `## From SESSION_STATE.md\n`;
      contextContent += taskMatches.slice(0, 5).map(t => `- ${t}`).join('\n');
      contextContent += '\n';
    }
  }

  // Add entity summaries (PARA system)
  const entitiesDir = join(workspaceDir, 'memory', 'entities');
  if (existsSync(entitiesDir)) {
    try {
      const entityFiles = readdirSync(entitiesDir).filter(f => f.endsWith('.md'));
      if (entityFiles.length > 0) {
        contextContent += `## Entity Summaries (PARA)\n`;
        for (const ef of entityFiles) {
          const entityContent = readFileSync(join(entitiesDir, ef), 'utf-8');
          // Extract just the Summary section for brevity
          const summaryMatch = entityContent.match(/## Summary\n([\s\S]*?)(?=\n##|$)/);
          if (summaryMatch) {
            const name = ef.replace('.md', '');
            contextContent += `**${name}**: ${summaryMatch[1].trim().split('\n')[0]}\n`;
          }
        }
        contextContent += '\n';
      }
    } catch {}
  }

  contextContent += `
---
_Use \`memory_search\` tool for deeper context. Last 1000+ messages are indexed._
`;

  // Inject into bootstrap files
  if (!event.context) {
    event.context = {};
  }
  if (!event.context.bootstrapFiles || !Array.isArray(event.context.bootstrapFiles)) {
    event.context.bootstrapFiles = [];
  }

  // Check if already exists
  const existingIndex = event.context.bootstrapFiles.findIndex(
    f => f && f.name === 'SESSION_CONTEXT'
  );

  if (existingIndex >= 0) {
    event.context.bootstrapFiles[existingIndex].content = contextContent;
    if (!event.context.bootstrapFiles[existingIndex].path) {
      event.context.bootstrapFiles[existingIndex].path = join(workspaceDir, 'SESSION_CONTEXT.md');
    }
  } else {
    event.context.bootstrapFiles.push({
      name: 'SESSION_CONTEXT',
      content: contextContent,
      path: join(workspaceDir, 'SESSION_CONTEXT.md'),
    });
  }

  console.log(`[bootstrap-context] Injected context: ${contextContent.length} chars`);
};

export default handler;

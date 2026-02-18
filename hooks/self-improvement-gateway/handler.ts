/**
 * Self-Improvement Gateway Hook
 * Auto-logs errors to .learnings/ERRORS.md
 */

import { execSync } from 'child_process';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface HookContext {
  event: string;
  payload?: {
    error?: string | Error;
    message?: string;
    tool?: string;
    exitCode?: number;
    source?: string;
  };
}

interface HookResult {
  success: boolean;
  message?: string;
}

const LEARNINGS_DIR = join(process.env.HOME || '~', 'clawd', '.learnings');
const ERRORS_FILE = join(LEARNINGS_DIR, 'ERRORS.md');

function generateId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `ERR-${date}-${rand}`;
}

function formatError(ctx: HookContext): string {
  const now = new Date().toISOString();
  const id = generateId();
  const payload = ctx.payload || {};

  const errorMsg = payload.error
    ? (typeof payload.error === 'string' ? payload.error : payload.error.message)
    : payload.message || 'Unknown error';

  const source = payload.source || payload.tool || ctx.event || 'gateway';

  return `
## [${id}] ${source}

**Logged**: ${now}
**Priority**: high
**Status**: pending
**Source**: gateway-auto
**Event**: ${ctx.event}

### Summary
${errorMsg.split('\n')[0].substring(0, 100)}

### Error
\`\`\`
${errorMsg}
\`\`\`

### Context
- Event: ${ctx.event}
- Tool: ${payload.tool || 'N/A'}
- Exit Code: ${payload.exitCode ?? 'N/A'}

---
`;
}

export default async function handler(ctx: HookContext): Promise<HookResult> {
  try {
    // Ensure directory exists
    if (!existsSync(LEARNINGS_DIR)) {
      mkdirSync(LEARNINGS_DIR, { recursive: true });
    }

    // Format and append error
    const entry = formatError(ctx);
    appendFileSync(ERRORS_FILE, entry);

    return {
      success: true,
      message: `Logged error to ${ERRORS_FILE}`
    };
  } catch (err) {
    // Don't let logging failures break the gateway
    console.error('[self-improvement-gateway] Failed to log error:', err);
    return {
      success: false,
      message: `Failed to log: ${err}`
    };
  }
}

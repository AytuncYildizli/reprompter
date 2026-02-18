// Norget Trigger Hook - Inject bookmark keeper context when bookmark commands detected

import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

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

const NORGET_DIR = join(homedir(), 'clawd/scripts/norget');

const NORGET_CONTEXT = `
## NORGET - Bookmark Keeper (Mahmut Yer İmi Asistanı)

Kullanici bookmark/kaydet/bm komutu gonderdiginde bu araclari kullan:

### Komutlar
\`\`\`bash
# Bookmark kaydet
~/clawd/scripts/norget/norget.sh save "URL" [#tag1 #tag2] [not]

# Liste
~/clawd/scripts/norget/norget.sh list
~/clawd/scripts/norget/norget.sh list --unread
~/clawd/scripts/norget/norget.sh list --fav

# Semantic arama
~/clawd/scripts/norget/norget.sh search "sorgu"

# Okundu isaretle
~/clawd/scripts/norget/norget.sh read <id>

# Favori toggle
~/clawd/scripts/norget/norget.sh fav <id>

# Klasor yonetimi
~/clawd/scripts/norget/norget.sh folder          # liste
~/clawd/scripts/norget/norget.sh folder "Tech"   # olustur
~/clawd/scripts/norget/norget.sh move <id> "Tech" # tasi

# Arsivle
~/clawd/scripts/norget/norget.sh archive <id>

# Istatistik
~/clawd/scripts/norget/norget.sh stats

# Dogal dil isleme
~/clawd/scripts/norget/norget.sh process "KULLANICI_MESAJI"
\`\`\`

### Kurallar
- "bm URL" veya "bookmark URL" veya "kaydet URL" → save komutu calistir
- "bm list" → list komutu
- "bm search X" veya "ne kaydetmistim X" → search komutu
- "bm read N" → read komutu
- "bm fav N" → fav komutu
- Tum cikti TURKCE olmali
- URL otomatik algilanir, ayri parse etmeye gerek yok
- ASLA veri uydurma, her zaman komutu calistir
`;

const NORGET_TRIGGERS = [
  // Explicit commands
  'bm ', 'bookmark', 'yer imi', 'norget',
  // Save intent
  'kaydet', 'kaydet şunu', 'bunu kaydet',
  // List/search
  'bookmarklarim', 'kaydettiklerim', 'ne kaydetmistim', 'ne kaydettim',
  'kayitli linklerim', 'kayıtlı',
  // Reminder responses
  'bm read', 'bm fav', 'bm list', 'bm search', 'bm folder', 'bm move',
  'bm archive', 'bm stats',
];

function isNorgetRelated(text: string): boolean {
  const msg = (text || '').toLowerCase();
  if (!msg || msg.length < 2) return false;

  // Check for "bm" + URL pattern
  if (/\bbm\s+https?:\/\//i.test(msg)) return true;

  // Check for URL + save intent
  if (/https?:\/\//.test(msg) && /kaydet|bookmark|bm/i.test(msg)) return true;

  return NORGET_TRIGGERS.some((trigger) => msg.includes(trigger));
}

const handler = async (event: HookEvent): Promise<void> => {
  if (event.type !== 'agent' || event.action !== 'bootstrap') {
    return;
  }

  if (!existsSync(join(NORGET_DIR, 'norget.sh'))) {
    return;
  }

  if (!event.context.bootstrapFiles) {
    event.context.bootstrapFiles = [];
  }

  // Check for duplicate
  if (event.context.bootstrapFiles.some((f) => f.name === 'NORGET_CONTEXT')) {
    return;
  }

  // Extract last user message — try sessionEntry first, fallback to event.messages
  let rawMessage = event.context.sessionEntry?.lastMessage || '';
  if (!rawMessage && Array.isArray(event.messages) && event.messages.length > 0) {
    const lastMsg = event.messages[event.messages.length - 1];
    rawMessage = typeof lastMsg === 'string' ? lastMsg : ((lastMsg as any)?.content || '');
  }
  let lines = rawMessage
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  lines = lines.filter((l) => !l.startsWith('System:'));
  let lastLine = lines[lines.length - 1] || '';
  if (lastLine.startsWith('[message_id:') && lines.length > 1) {
    lastLine = lines[lines.length - 2] || lastLine;
  }
  if (lastLine.startsWith('[WhatsApp')) {
    const endIdx = lastLine.indexOf(']');
    if (endIdx !== -1) {
      lastLine = lastLine.slice(endIdx + 1).trim();
    }
  }

  if (!isNorgetRelated(lastLine)) {
    return;
  }

  event.context.bootstrapFiles.push({
    name: 'NORGET_CONTEXT',
    content: NORGET_CONTEXT,
    path: 'NORGET_CONTEXT.md',
  });

  console.log('[norget-trigger] Injected bookmark keeper context');
};

export default handler;

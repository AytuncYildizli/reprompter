// Smart Router Hook - Auto-detect intent and inject routing instructions
// Handles: Quick Actions (sabah/haber/borsa/ev/posta/BM), Auto-Route, Voice-First
// Runs on agent:bootstrap, analyzes last message, injects context

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

// ============================================================
// ROUTE DEFINITIONS
// ============================================================

interface Route {
  id: string;
  triggers: RegExp[];
  context: string;
  priority: number; // lower = higher priority
}

const ROUTES: Route[] = [
  // ---- QUICK ACTIONS (highest priority) ----
  {
    id: 'quick-morning',
    priority: 1,
    triggers: [
      /^(sabah|morning|günaydın|gunaydin)$/i,
      /^sabah\s*(briefing|ozet|özet)?$/i,
    ],
    context: `## 🌅 QUICK ACTION: Sabah Briefing
Bu bir "sabah" kısayoludur. Paralel olarak şunları spawn et:
1. \`sessions_spawn\` → Email check (himalaya skill, model=sonnet46)
2. \`sessions_spawn\` → Calendar today (gog skill, model=sonnet46)  
3. \`sessions_spawn\` → Markets: BTC, ETH, AVAX, ASTER, 0G (stock-analysis skill, model=sonnet46)
4. Direkt: Weather (weather skill, Mersin)
Tüm spawn'lar paralel gitsin, sonuçları geldikçe ilet.`,
  },
  {
    id: 'quick-news',
    priority: 1,
    triggers: [
      /^(haber|news|haberler)$/i,
      /^(gündem|trending)$/i,
    ],
    context: `## 📰 QUICK ACTION: Haber
Paralel spawn et:
1. X research: trending tech/AI topics (x-research skill, model=sonnet46)
2. web_search: top tech news today
Sonuçları kısa özetle.`,
  },
  {
    id: 'quick-markets',
    priority: 1,
    triggers: [
      /^(borsa|markets?|piyasa|crypto|kripto)$/i,
      /^(fiyat|price)$/i,
    ],
    context: `## 📈 QUICK ACTION: Borsa
stock-analysis skill kullan. Takip edilen: BTC, ETH, AVAX, ASTER, 0G
Fiyat, 24h değişim, hızlı analiz.`,
  },
  {
    id: 'quick-home',
    priority: 1,
    triggers: [
      /^(ev|home|denizevi)$/i,
      /^ev\s*(durumu?|status)$/i,
    ],
    context: `## 🏠 QUICK ACTION: Ev Durumu
homeassistant skill kullan. Kontrol et:
1. Klima durumu (tüm odalar)
2. Işıklar (açık olanlar)
3. Kameralar (Frigate status)
Kısa özet ver.`,
  },
  {
    id: 'quick-mail',
    priority: 1,
    triggers: [
      /^(posta|mail|email|e-?mail)$/i,
      /^(inbox|gelen kutusu)$/i,
    ],
    context: `## 📧 QUICK ACTION: Posta
himalaya skill kullan:
himalaya envelope list --folder INBOX --page-size 10
Önemli olanları özetle (banka, iş, devlet, kargo). Spam/newsletter atla.`,
  },
  {
    id: 'quick-bookmark',
    priority: 0, // highest
    triggers: [
      /^BM\s+https?:\/\//i,
      /^bookmark\s+https?:\/\//i,
    ],
    context: `## 🔖 QUICK ACTION: Bookmark
Bu mesajda bir URL var ve "BM" komutu kullanıldı. URL'yi Norget'e kaydet:
\`~/clawd/scripts/norget/norget.sh save <URL> "<otomatik özet>" "<otomatik tags>"\`
URL'yi web_fetch ile oku, başlığından özet ve tag'ler çıkar, kaydet.`,
  },

  // ---- AUTO-ROUTE (medium priority) ----
  {
    id: 'route-code',
    priority: 5,
    triggers: [
      /\b(kod|code|bug|debug|error|hata|fix|compile|build|deploy|git|commit|push|pull|merge|branch)\b/i,
      /\b(function|class|import|export|async|await|const|let|var|def|return)\b/i,
      /```[\s\S]*```/,
    ],
    context: `## 💻 AUTO-ROUTE: Kod/Teknik
Teknik soru veya kod görevi algılandı. Gerekirse coding-agent skill veya Codex subagent kullan.
Model önerisi: codex (kod yazma) veya sonnet46 (code review).`,
  },
  {
    id: 'route-music',
    priority: 5,
    triggers: [
      /\b(müzik|muzik|music|çal|cal|play|şarkı|sarki|song|playlist)\b/i,
      /\b(volume|ses|speaker|hoparlör)\b/i,
      /\b(spotify|homepod|echo)\b/i,
    ],
    context: `## 🎵 AUTO-ROUTE: Müzik
Müzik isteği algılandı. denizevi-speakers veya denizevi-music skill kullan.`,
  },
  {
    id: 'route-lights',
    priority: 5,
    triggers: [
      /\b(ışık|isik|light|lamba|lamp|aç|kapat|dim|parlaklık)\b/i,
      /\b(klima|ac|air\s*condition|sıcaklık|sicaklik|derece|heating|cooling)\b/i,
      /\b(panjur|blind|perde|curtain|cover)\b/i,
      /\b(scene|sahne|senaryo)\b/i,
    ],
    context: `## 🏠 AUTO-ROUTE: Akıllı Ev
Ev kontrolü algılandı. homeassistant skill kullan.`,
  },
  {
    id: 'route-calendar',
    priority: 5,
    triggers: [
      /\b(takvim|calendar|toplantı|toplanti|meeting|event|randevu|appointment)\b/i,
      /\b(bugün|yarin|yarın|pazartesi|salı|çarşamba|perşembe|cuma|cumartesi|pazar)\b/i,
    ],
    context: `## 📅 AUTO-ROUTE: Takvim
Takvim sorusu algılandı. gog skill (Google Calendar) kullan.`,
  },
  {
    id: 'route-tweet',
    priority: 5,
    triggers: [
      /\b(tweet|twitter|x\.com|tweetle|paylaş)\b/i,
      /\b(draft|taslak)\s*(tweet|paylaşım)/i,
    ],
    context: `## 🐦 AUTO-ROUTE: Twitter/X
Twitter isteği algılandı. Okuma: twitterapi-io veya x-research skill. Yazma: personal-tweet-drafts skill (sadece draft, post yasak!).`,
  },
  {
    id: 'route-research',
    priority: 7,
    triggers: [
      /\b(araştır|arastir|research|incele|analiz|bul|search)\b/i,
      /\b(ne\s*düşünüyor|ne\s*diyor|what\s*do\s*people|what\s*are\s*people)\b/i,
    ],
    context: `## 🔍 AUTO-ROUTE: Araştırma
Araştırma isteği algılandı. web_search + web_fetch kullan. X perspektifi lazımsa x-research skill.
Model önerisi: gemini (1M context, bedava).`,
  },

  // ---- VOICE-FIRST PATTERNS ----
  {
    id: 'voice-bookmark',
    priority: 0,
    triggers: [
      /Transcript:.*\bBM\b.*https?:\/\//i,
      /Transcript:.*\bbookmark\b.*https?:\/\//i,
    ],
    context: `## 🎤 VOICE: Bookmark
Ses mesajında "BM" + URL algılandı. URL'yi çıkar ve Norget'e kaydet:
\`~/clawd/scripts/norget/norget.sh save <URL> "<özet>" "<tags>"\``,
  },
  {
    id: 'voice-remember',
    priority: 2,
    triggers: [
      /Transcript:.*\b(hatırla|hatirla|remember|kaydet|not\s*al)\b/i,
    ],
    context: `## 🎤 VOICE: Hatırla
Ses mesajında "hatırla/remember" algılandı. Mesajın içeriğini memory'ye yaz:
- memory/YYYY-MM-DD.md'ye ekle
- MEMORY.md'ye de ekle (uzun vadeli ise)`,
  },
];

// ============================================================
// HANDLER
// ============================================================

function extractLastMessage(event: HookEvent): string {
  let rawMessage = event.context.sessionEntry?.lastMessage || '';
  if (!rawMessage && Array.isArray(event.messages) && event.messages.length > 0) {
    const lastMsg = event.messages[event.messages.length - 1];
    rawMessage = typeof lastMsg === 'string' ? lastMsg : ((lastMsg as any)?.content || '');
  }
  let lines = rawMessage
    .split('\n')
    .map((l: string) => l.trim())
    .filter(Boolean);
  lines = lines.filter((l: string) => !l.startsWith('System:'));
  let lastLine = lines[lines.length - 1] || '';
  if (lastLine.startsWith('[message_id:') && lines.length > 1) {
    lastLine = lines[lines.length - 2] || lastLine;
  }
  // For voice messages, include full transcript
  if (rawMessage.includes('Transcript:')) {
    return rawMessage;
  }
  // For WhatsApp prefix, strip it
  if (lastLine.startsWith('[WhatsApp')) {
    const endIdx = lastLine.indexOf(']');
    if (endIdx !== -1) {
      lastLine = lastLine.slice(endIdx + 1).trim();
    }
  }
  return lastLine;
}

function findMatchingRoutes(text: string): Route[] {
  if (!text || text.length < 2) return [];
  const matched: Route[] = [];
  for (const route of ROUTES) {
    for (const trigger of route.triggers) {
      if (trigger.test(text)) {
        matched.push(route);
        break;
      }
    }
  }
  // Sort by priority (lower = higher priority)
  matched.sort((a, b) => a.priority - b.priority);
  return matched;
}

const handler = async (event: HookEvent): Promise<void> => {
  if (event.type !== 'agent' || event.action !== 'bootstrap') {
    return;
  }

  if (!event.context.bootstrapFiles) {
    event.context.bootstrapFiles = [];
  }

  // Prevent duplicate injection
  const existing = event.context.bootstrapFiles.find((f) => f.name === 'SMART_ROUTER');
  if (existing) return;

  const message = extractLastMessage(event);
  if (!message) return;

  const routes = findMatchingRoutes(message);
  if (routes.length === 0) return;

  // Take top route (highest priority match)
  const topRoute = routes[0];

  // Build context with all matched routes (top gets full context, others get hints)
  let context = topRoute.context;
  if (routes.length > 1) {
    context += '\n\n### Diğer algılanan intent\'ler:\n';
    for (let i = 1; i < Math.min(routes.length, 3); i++) {
      context += `- ${routes[i].id}\n`;
    }
  }

  event.context.bootstrapFiles.push({
    name: 'SMART_ROUTER',
    content: context,
    path: 'hooks/smart-router-context.md',
  });

  console.log(`[smart-router] Matched route: ${topRoute.id} (${routes.length} total matches)`);
};

export default handler;

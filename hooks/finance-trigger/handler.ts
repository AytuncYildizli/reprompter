// Finance Trigger Hook - Inject finance assistant context when money topics detected
// Provides Mahmut with finance commands for transaction tracking, reports, reminders

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

const FINANCE_DIR = join(homedir(), 'clawd/scripts/finance');

const FINANCE_CONTEXT = `
## FINANCE ASSISTANT v3 (Mahmut Finans Asistani)

Kullanici para/harcama/mulk konusunda konusuyorsa bu araclari kullan:

### Temel Komutlar
\`\`\`bash
# Manuel islem ekle (--property N ile mulke bagla, --income gelir icin)
~/clawd/scripts/finance/finance.sh add "500TL market harcadim"
~/clawd/scripts/finance/finance.sh add "15000TRY kira geliri" --property 1 --income

# Aylik/haftalik ozet
~/clawd/scripts/finance/finance.sh summary --month
~/clawd/scripts/finance/finance.sh summary --week

# Gunluk nabiz
~/clawd/scripts/finance/finance.sh daily-pulse

# Dogal dil isleme (WhatsApp mesaji)
~/clawd/scripts/finance/finance.sh process "KULLANICI_MESAJI"
\`\`\`

### Gayrimenkul Komutlari
\`\`\`bash
# Mulk yonetimi
~/clawd/scripts/finance/finance.sh property add "Mulk Adi" TR residential --city Istanbul
~/clawd/scripts/finance/finance.sh property list
~/clawd/scripts/finance/finance.sh property summary

# Kiraci yonetimi
~/clawd/scripts/finance/finance.sh tenant add 1 "Kiraci Adi" --rent 15000TRY --day 1
~/clawd/scripts/finance/finance.sh tenant list

# Kredi/ipotek yonetimi
~/clawd/scripts/finance/finance.sh mortgage add 1 "Banka" 500000AED --monthly 3500AED --rate 4.5
~/clawd/scripts/finance/finance.sh mortgage list

# Kar/zarar analizi
~/clawd/scripts/finance/finance.sh pnl           # Tum mulkler
~/clawd/scripts/finance/finance.sh pnl 1          # Tek mulk
~/clawd/scripts/finance/finance.sh pnl --year     # Yillik

# Portfoy ozeti (USD bazinda)
~/clawd/scripts/finance/finance.sh portfolio

# Kira tahsilat durumu
~/clawd/scripts/finance/finance.sh rent-status
\`\`\`

### Finans Komutlari
\`\`\`bash
# Hesap yonetimi
~/clawd/scripts/finance/finance.sh account add "IsBank TRY" checking --currency TRY --balance 50000
~/clawd/scripts/finance/finance.sh account list
~/clawd/scripts/finance/finance.sh account update 1 --balance 55000

# Net deger
~/clawd/scripts/finance/finance.sh net-worth
~/clawd/scripts/finance/finance.sh net-worth --history

# Doviz kurlari
~/clawd/scripts/finance/finance.sh fx-rates
~/clawd/scripts/finance/finance.sh convert 1000 TRY USD

# Butce / hedefler / abonelikler
~/clawd/scripts/finance/finance.sh budget
~/clawd/scripts/finance/finance.sh goal add "Tatil" 50000
~/clawd/scripts/finance/finance.sh subscriptions
~/clawd/scripts/finance/finance.sh cancel "netflix"
\`\`\`

### Kurallar
- Tum cikti TURKCE olmali
- Para formati: 2.450,00 TL (Turk formati)
- 4 para birimi: TRY, USD, AED, EUR (GBP de desteklenir)
- Kira = GELIR (kullanici ev sahibi, 10+ mulk, 4 ulke)
- Mulk islemleri icin --property N kullan
- Net deger ve portfoy USD bazinda hesaplanir
- ASLA veri uydurma, her zaman komutu calistir
- "process" komutu dogal dil isler
- "mulk" / "kiraci" / "kredi" sorularinda ilgili komutu kullan
`;

// Turkish + English finance keywords
const FINANCE_TRIGGERS = [
  // Turkish spending
  'harcama', 'harcadim', 'gider', 'odedim', 'ödedim', 'verdim',
  'ne kadar', 'rapor', 'ozet',
  // Turkish finance
  'fatura', 'kira', 'abonelik', 'butce', 'bütçe', 'taksit', 'ekstre',
  'borc', 'borç',
  // Turkish categories
  'market', 'benzin', 'akaryakit',
  // Currency
  'tl', 'lira', 'euro', 'dolar', 'dirham', 'aed',
  // English
  'spending', 'expense', 'payment', 'bill', 'subscription', 'budget',
  // Amount patterns
  'kadar harcadim', 'aylik', 'haftalik',
  // Cancellation & services
  'iptal', 'cancel', 'iptal et', 'nasil iptal', 'servisler',
  // iMessage scan
  'mesaj tara', 'sms tara', 'imessage',
  // Savings goals
  'hedef', 'tasarruf', 'birikim', 'goal',
  // Daily pulse
  'nabiz', 'pulse', 'gunluk ozet', 'bugun',
  // Velocity
  'harcama hizi', 'velocity',
  // Apple
  'apple', 'youtube premium', 'icloud',
  // v3: Real estate
  'mulk', 'mülk', 'mulklerim', 'gayrimenkul', 'emlak', 'property', 'properties',
  'kiraci', 'kiracı', 'tenant', 'kiracılar',
  'kredi', 'mortgage', 'ipotek',
  'portfoy', 'portfolio', 'pnl', 'kar zarar',
  // v3: Net worth & accounts
  'net worth', 'net deger', 'servet', 'toplam varlik',
  'hesap', 'hesabim', 'account',
  // v3: FX
  'doviz', 'döviz', 'kur', 'exchange rate',
  // v3: Rent status
  'kira durumu', 'rent status', 'kira tahsilat',
];

function isFinanceRelated(text: string): boolean {
  const msg = (text || '').toLowerCase();
  if (!msg || msg.length < 3) return false;

  // Check for amount pattern: number + currency
  if (/\d+\s*(tl|lira|euro|eur|usd|dolar|aed|dirham)/i.test(msg)) return true;

  return FINANCE_TRIGGERS.some((trigger) => msg.includes(trigger));
}

const handler = async (event: HookEvent): Promise<void> => {
  // Only trigger on agent:bootstrap
  if (event.type !== 'agent' || event.action !== 'bootstrap') {
    return;
  }

  // Check if finance.sh exists
  if (!existsSync(join(FINANCE_DIR, 'finance.sh'))) {
    return;
  }

  if (!event.context.bootstrapFiles) {
    event.context.bootstrapFiles = [];
  }

  // Check for duplicate injection
  const existingIndex = event.context.bootstrapFiles.findIndex(
    (f) => f.name === 'FINANCE_CONTEXT'
  );
  if (existingIndex >= 0) {
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

  if (!isFinanceRelated(lastLine)) {
    return;
  }

  // Inject finance context
  event.context.bootstrapFiles.push({
    name: 'FINANCE_CONTEXT',
    content: FINANCE_CONTEXT,
    path: 'memory/finance-context.md',
  });

  console.log('[finance-trigger] Injected finance assistant context');
};

export default handler;

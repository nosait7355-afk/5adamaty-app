import { isProduction } from './env';

/**
 * سجلّ منظّم بسيط بلا اعتماديات.
 *
 * قاعدة أمنية (ARCHITECTURE §7): تنقيح إجباري للحقول الحسّاسة قبل الكتابة.
 * كلمات المرور والتوكنات لا تُسجَّل إطلاقًا، وأرقام الهواتف والبُرد تُقنَّع جزئيًا.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** أي مفتاح يطابق هذه الأنماط تُستبدل قيمته بالكامل. */
const REDACT_KEYS = [
  'password',
  'passwordhash',
  'confirmpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'secret',
  'apisecret',
  'apikey',
  'signature',
  'jwt',
];

/** مفاتيح تُقنَّع جزئيًا بدل حذفها — لتبقى مفيدة في التتبّع. */
const MASK_KEYS = ['phone', 'email', 'nationalid'];

const MAX_DEPTH = 6;

function maskValue(value: string): string {
  if (value.length <= 4) return '***';
  return `${value.slice(0, 3)}***${value.slice(-2)}`;
}

export function redact(input: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[max-depth]';
  if (input === null || input === undefined) return input;

  if (Array.isArray(input)) return input.map((item) => redact(item, depth + 1));

  if (input instanceof Error) {
    return { name: input.name, message: input.message, stack: input.stack };
  }

  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const normalized = key.toLowerCase().replace(/[^a-z]/g, '');

      if (REDACT_KEYS.includes(normalized)) {
        out[key] = '[REDACTED]';
      } else if (MASK_KEYS.includes(normalized) && typeof value === 'string') {
        out[key] = maskValue(value);
      } else {
        out[key] = redact(value, depth + 1);
      }
    }
    return out;
  }

  return input;
}

function currentLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL;
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw;
  return isProduction ? 'info' : 'debug';
}

function write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[currentLevel()]) return;

  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...(context ? { context: redact(context) as Record<string, unknown> } : {}),
  };

  const line = isProduction ? JSON.stringify(entry) : formatPretty(entry);

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function formatPretty(entry: {
  level: LogLevel;
  time: string;
  message: string;
  context?: Record<string, unknown>;
}): string {
  const ctx = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
  return `[${entry.level.toUpperCase()}] ${entry.message}${ctx}`;
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => write('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => write('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => write('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => write('error', message, context),
};

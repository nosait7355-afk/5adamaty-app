import { SignJWT, importPKCS8 } from 'jose';
import { getEnv } from './env';
import { logger } from './logger';

/**
 * إرسال إشعارات Push عبر Firebase Cloud Messaging (HTTP v1).
 *
 * بلا `firebase-admin`: حساب الخدمة يوقّع JWT (RS256) بـ`jose` — التبعية
 * الموجودة أصلًا — ويبادله برمز وصول OAuth من Google، كما تفعل المكتبة.
 *
 * اختياري بالكامل: بلا متغيرات Firebase لا يُرسل شيء، والإشعارات الداخلية
 * (`/notifications`) تعمل كما هي.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

export interface PushMessage {
  title: string;
  body: string;
  /** مسار داخلي يفتحه التطبيق عند النقر — نفس `actionUrl` في الإشعار. */
  actionUrl?: string | undefined;
}

interface FirebaseCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

function credentials(): FirebaseCredentials | null {
  const env = getEnv();
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) return null;
  return {
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    // Vercel يحفظ أسطر المفتاح كـ`\n` حرفيًا
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  };
}

export function isPushConfigured(): boolean {
  return credentials() !== null;
}

let cachedAccess: { token: string; expiresAt: number } | null = null;

async function accessToken(creds: FirebaseCredentials): Promise<string> {
  if (cachedAccess && cachedAccess.expiresAt - 60_000 > Date.now()) return cachedAccess.token;

  const key = await importPKCS8(creds.privateKey, 'RS256');
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(creds.clientEmail)
    .setAudience(TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) throw new Error(`FCM OAuth ${response.status}`);

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedAccess = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

/**
 * يرسل لكل رمز ويعيد الرموز التي رفضتها Firebase نهائيًا (التطبيق حُذف أو
 * الرمز أُبدل) ليحذفها المستدعي. لا يرمي — فشل Push لا يُفشل العملية الأصلية.
 */
export async function sendPush(tokens: string[], message: PushMessage): Promise<string[]> {
  const creds = credentials();
  if (!creds || tokens.length === 0) return [];

  let bearer: string;
  try {
    bearer = await accessToken(creds);
  } catch (error) {
    logger.error('تعذّر الحصول على رمز FCM', { error: String(error) });
    return [];
  }

  const endpoint = `https://fcm.googleapis.com/v1/projects/${creds.projectId}/messages:send`;
  const dead: string[] = [];

  await Promise.all(
    tokens.map(async (token) => {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: message.title, body: message.body },
              ...(message.actionUrl ? { data: { actionUrl: message.actionUrl } } : {}),
              android: { priority: 'high' },
            },
          }),
        });
        // 404 UNREGISTERED / 400 INVALID_ARGUMENT على الرمز: لن يصلح أبدًا
        if (response.status === 404 || response.status === 400) dead.push(token);
        else if (!response.ok) logger.warn('فشل إرسال Push', { status: response.status });
      } catch (error) {
        logger.warn('فشل إرسال Push', { error: String(error) });
      }
    })
  );

  return dead;
}

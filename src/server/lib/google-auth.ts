import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getEnv } from './env';

/**
 * التحقق من `idToken` الصادر عن Google Identity Services.
 *
 * لا مكتبة `google-auth-library` إضافية: `jose` (تبعية موجودة أصلًا لـJWT
 * الخاص بالتطبيق) تكفي — تجلب مفاتيح Google العامة من JWKS الرسمي وتتحقق
 * بها من التوقيع والمُصدِر والجمهور، تمامًا كما تفعل المكتبة المخصّصة.
 */

const GOOGLE_JWKS_URL = new URL('https://www.googleapis.com/oauth2/v3/certs');
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  jwks ??= createRemoteJWKSet(GOOGLE_JWKS_URL);
  return jwks;
}

export interface GoogleProfile {
  googleId: string;
  email?: string;
  emailVerified: boolean;
  fullName: string;
}

/** يعيد `null` لأي توكن غير صالح — لا يرمي، حتى يترجمه المستدعي لرسالة موحّدة. */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile | null> {
  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID) return null;

  try {
    const { payload } = await jwtVerify(idToken, getJwks(), {
      issuer: GOOGLE_ISSUERS,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const sub = typeof payload.sub === 'string' ? payload.sub : undefined;
    const name = typeof payload.name === 'string' ? payload.name : undefined;
    if (!sub || !name) return null;

    return {
      googleId: sub,
      ...(typeof payload.email === 'string' ? { email: payload.email.toLowerCase() } : {}),
      emailVerified: payload.email_verified === true,
      fullName: name,
    };
  } catch {
    return null;
  }
}

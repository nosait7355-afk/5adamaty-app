import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { getEnv } from './env';
import type { UserRole } from '@/shared/constants/roles';

/**
 * جلسات JWT (ARCHITECTURE §7).
 *
 * Access  : 15 دقيقة — قصير عمدًا لتقليل نافذة الاستغلال عند التسريب.
 * Refresh : 30 يومًا مع **Rotation** — كل استخدام يُبطل التوكن القديم
 *           ويصدر جديدًا، وإعادة استخدام توكن مُبطَل تُبطل كل الجلسات.
 *
 * كلاهما يُخزَّن في كوكيز httpOnly — لا localStorage إطلاقًا.
 */

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

const ISSUER = 'khadamaty-elfayoum';
const ACCESS_AUDIENCE = 'access';
const REFRESH_AUDIENCE = 'refresh';

export interface AccessTokenClaims extends JWTPayload {
  sub: string;
  role: UserRole;
  status: string;
}

export interface RefreshTokenClaims extends JWTPayload {
  sub: string;
  /** معرّف الجلسة — يربط التوكن بسجل في `user.refreshTokens`. */
  sid: string;
}

function getSecret(kind: 'access' | 'refresh'): Uint8Array {
  const env = getEnv();
  const secret = kind === 'access' ? env.JWT_ACCESS_SECRET : env.JWT_REFRESH_SECRET;

  if (!secret) {
    throw new Error(
      `JWT_${kind.toUpperCase()}_SECRET غير معرّف. ولّده بـ: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(claims: {
  userId: string;
  role: UserRole;
  status: string;
}): Promise<string> {
  return new SignJWT({ role: claims.role, status: claims.status })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(ACCESS_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getSecret('access'));
}

export async function signRefreshToken(claims: {
  userId: string;
  sessionId: string;
}): Promise<string> {
  return new SignJWT({ sid: claims.sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(REFRESH_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_TTL_SECONDS}s`)
    .sign(getSecret('refresh'));
}

/**
 * يتحقق من توكن الوصول.
 * يعيد null عند أي فشل — منتهٍ، توقيع خاطئ، جمهور خاطئ، أو تالف.
 * لا يرمي، لأن انتهاء الصلاحية حالة طبيعية لا خطأ.
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret('access'), {
      issuer: ISSUER,
      audience: ACCESS_AUDIENCE,
      algorithms: ['HS256'],
    });

    if (typeof payload.sub !== 'string' || typeof payload.role !== 'string') return null;
    return payload as AccessTokenClaims;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret('refresh'), {
      issuer: ISSUER,
      audience: REFRESH_AUDIENCE,
      algorithms: ['HS256'],
    });

    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null;
    return payload as RefreshTokenClaims;
  } catch {
    return null;
  }
}

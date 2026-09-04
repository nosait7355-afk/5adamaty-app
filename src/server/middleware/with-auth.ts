import type { Types } from 'mongoose';
import { forbidden, unauthorized } from '@/server/lib/errors';
import { verifyAccessToken } from '@/server/lib/jwt';
import { ACCESS_COOKIE, readTokenFromRequest } from '@/server/lib/cookies';
import type { UserRole } from '@/shared/constants/roles';

/**
 * سياق الجلسة وحُرّاس الأدوار.
 *
 * التوكن يُقرأ من كوكي httpOnly فقط — لا من رأس Authorization ولا من
 * معامل استعلام، حتى لا يُسرَّب في السجلات أو الـReferer.
 */

export interface SessionUser {
  id: string;
  role: UserRole;
  status: string;
}

/** يقرأ الجلسة إن وُجدت. لا يرمي — يعيد null. */
export async function getSession(request: Request): Promise<SessionUser | null> {
  const token = readTokenFromRequest(request, ACCESS_COOKIE);
  if (!token) return null;

  const claims = await verifyAccessToken(token);
  if (!claims) return null;

  return {
    id: claims.sub,
    role: claims.role,
    status: claims.status,
  };
}

/** يتطلب جلسة صالحة، وإلا 401. */
export async function requireAuth(request: Request): Promise<SessionUser> {
  const user = await getSession(request);
  if (!user) throw unauthorized();

  if (user.status === 'SUSPENDED') {
    throw forbidden('تم إيقاف حسابك. برجاء التواصل مع الدعم.');
  }
  return user;
}

/** يتطلب دورًا من قائمة محددة، وإلا 403. */
export async function requireRole(
  request: Request,
  ...roles: readonly UserRole[]
): Promise<SessionUser> {
  const user = await requireAuth(request);
  if (!roles.includes(user.role)) {
    throw forbidden();
  }
  return user;
}

/**
 * حارس الملكية — الدرع الأساسي ضد IDOR.
 *
 * يعيد **404** لا 403 عند عدم الملكية، حتى لا نكشف وجود المورد أصلًا
 * (ARCHITECTURE §7). الإدارة تتجاوز الفحص.
 */
export function assertOwnership(
  user: SessionUser,
  ownerIds: Array<Types.ObjectId | string | undefined | null>,
  notFoundError: Error
): void {
  if (user.role === 'ADMIN') return;

  const owns = ownerIds.some((id) => id != null && String(id) === user.id);
  if (!owns) throw notFoundError;
}

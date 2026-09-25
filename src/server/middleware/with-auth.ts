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
 * حارس مساحة عمل مقدم الخدمة — يقبل الدور `PROVIDER` أو عميلًا يملك ملف
 * مزوّد قيد الإنشاء.
 *
 * السبب: عند تحويل عميل إلى مقدم خدمة لا يتغيّر دوره إلا بعد إرسال الطلب
 * (انظر `convertCustomerToProvider`)، كي لا يخسر حسابه كعميل إن توقّف في
 * منتصف التسجيل. لكنه يحتاج في تلك الأثناء رفع مستنداته وقراءة ملفه —
 * ولا يجوز أن يفتح ذلك المساحة لأي عميل: الشرط هو **وجود ملف مزوّد باسمه
 * فعلًا** في قاعدة البيانات، لا مجرد ادّعاء.
 */
export async function requireProviderWorkspace(
  request: Request,
  ...extraRoles: readonly UserRole[]
): Promise<SessionUser> {
  const user = await requireAuth(request);
  if (user.role === 'PROVIDER' || extraRoles.includes(user.role)) return user;

  const { findProviderByUserId } = await import('@/server/repositories/provider.repository');
  const provider = await findProviderByUserId(user.id);
  if (!provider) throw forbidden();

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

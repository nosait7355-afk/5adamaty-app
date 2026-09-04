import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * تجزئة كلمات المرور بـ argon2id (ARCHITECTURE §7).
 *
 * المعاملات تتبع توصية OWASP: m=19MiB · t=2 · p=1.
 * argon2id يقاوم هجمات القنوات الجانبية وهجمات GPU معًا.
 */
/**
 * `algorithm: 2` = Argon2id في تعداد `@node-rs/argon2`.
 * نكتبه رقمًا لا عبر `Algorithm.Argon2id` لأن التعداد ambient const،
 * و`isolatedModules` يمنع الوصول إليه وقت التشغيل.
 */
const ARGON2ID = 2;

const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

/**
 * يتحقق من كلمة المرور.
 * يبتلع أخطاء التجزئة التالفة ويعيد false — حتى لا تكشف الاستجابة
 * الفرق بين «تجزئة غير صالحة» و«كلمة مرور خاطئة».
 */
export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  try {
    return await verify(hashed, plain, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

/**
 * تجزئة وهمية تُستخدم عند عدم وجود المستخدم.
 *
 * بدونها يعود الرد أسرع بكثير للمستخدمين غير الموجودين، فيستطيع المهاجم
 * تعداد الحسابات بقياس الزمن. نُجري تحققًا حقيقيًا ضد هذه التجزئة لنستهلك
 * نفس الوقت تقريبًا.
 */
let dummyHashCache: string | null = null;

export async function getDummyHash(): Promise<string> {
  dummyHashCache ??= await hashPassword(randomBytes(32).toString('hex'));
  return dummyHashCache;
}

/* ============================================================
   التوكنات العشوائية (إعادة تعيين كلمة المرور، refresh tokens)
   ============================================================ */

/** توكن عشوائي آمن تشفيريًا — 32 بايت. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * تجزئة التوكن للتخزين.
 *
 * SHA-256 كافية هنا (بعكس كلمات المرور): التوكن عشوائي 256-بت أصلًا،
 * فلا يمكن تخمينه بالقوة الغاشمة ولا يحتاج دالة بطيئة.
 * الغرض أن تسريب قاعدة البيانات لا يعطي توكنات صالحة.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** مقارنة ثابتة الزمن — تمنع استخراج التوكن بقياس زمن المقارنة. */
export function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

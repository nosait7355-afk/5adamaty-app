import type { z } from 'zod';
import { badRequest } from '@/server/lib/errors';

/**
 * التحقق من المدخلات بـZod.
 *
 * كل مخطط `.strict()`، فأي مفتاح غير معرّف يُرفض. هذا يقطع mass-assignment:
 * لا يستطيع العميل تمرير `role` أو `status` أو `isVerifiedBadge` أو
 * `verification.status` عبر أي endpoint (ARCHITECTURE §7).
 */

/** يحوّل ZodError إلى AppError بأخطاء حقول عربية. */
function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  return fields;
}

/** يتحقق من جسم الطلب JSON. */
export async function validateBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw badRequest('جسم الطلب يجب أن يكون JSON صالحًا.');
  }

  // رفض المفاتيح الخطرة قبل الوصول لـZod — دفاع في العمق ضد حقن NoSQL
  assertNoOperatorKeys(raw);

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw badRequest('البيانات المُدخلة غير صحيحة.', toFieldErrors(result.error));
  }
  return result.data;
}

/** يتحقق من معاملات الاستعلام. */
export function validateQuery<T extends z.ZodTypeAny>(request: Request, schema: T): z.infer<T> {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    raw[key] = value;
  }

  assertNoOperatorKeys(raw);

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw badRequest('معاملات البحث غير صحيحة.', toFieldErrors(result.error));
  }
  return result.data;
}

/** يتحقق من معاملات المسار. */
export function validateParams<T extends z.ZodTypeAny>(params: unknown, schema: T): z.infer<T> {
  const result = schema.safeParse(params);
  if (!result.success) {
    throw badRequest('معاملات المسار غير صحيحة.', toFieldErrors(result.error));
  }
  return result.data;
}

/**
 * يرفض أي مفتاح يبدأ بـ`$` أو يحتوي `.` — أدوات حقن NoSQL المعتادة
 * مثل `{"email": {"$ne": null}}` أو `{"a.b": 1}`.
 */
const MAX_DEPTH = 8;

export function assertNoOperatorKeys(input: unknown, depth = 0): void {
  if (depth > MAX_DEPTH) {
    throw badRequest('بنية البيانات معقّدة أكثر من اللازم.');
  }
  if (input === null || typeof input !== 'object') return;

  if (Array.isArray(input)) {
    for (const item of input) assertNoOperatorKeys(item, depth + 1);
    return;
  }

  for (const [key, value] of Object.entries(input)) {
    if (key.startsWith('$') || key.includes('.')) {
      throw badRequest('البيانات المُدخلة تحتوي على مفاتيح غير مسموح بها.');
    }
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      throw badRequest('البيانات المُدخلة تحتوي على مفاتيح غير مسموح بها.');
    }
    assertNoOperatorKeys(value, depth + 1);
  }
}

import { z } from 'zod';
import {
  egyptPhoneSchema,
  emailSchema,
  fullNameSchema,
  literalTrue,
  passwordSchema,
} from './common.schema';
import { ALL_FAYOUM_AREAS, FAYOUM_CITIES, GOVERNORATE } from '@/shared/constants/fayoum-areas';

/**
 * مخططات المصادقة.
 *
 * NON-NEGOTIABLE (PROJECT_PLAN — المصادقة):
 * لا OTP · لا Social Login. الدخول برقم هاتف أو بريد + كلمة مرور فقط.
 * لا يوجد في هذا الملف — ولن يوجد — أي حقل `otp` أو `provider` أو `idToken`.
 */

/* ---- تسجيل عميل جديد (الصورة 05) ---- */
export const registerCustomerSchema = z
  .object({
    fullName: fullNameSchema,
    phone: egyptPhoneSchema,
    // البريد اختياري في شاشة التسجيل — كما هو مكتوب حرفيًا في التصميم
    email: emailSchema.optional().or(z.literal('').transform(() => undefined)),
    area: z
      .string()
      .trim()
      .refine((value) => ALL_FAYOUM_AREAS.includes(value), { message: 'المنطقة غير صالحة.' }),
    city: z.enum(FAYOUM_CITIES).default(GOVERNORATE),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: literalTrue('يجب الموافقة على الشروط والأحكام وسياسة الخصوصية.'),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: 'كلمتا المرور غير متطابقتين.',
    path: ['confirmPassword'],
  });

/**
 * نوعان لكل مخطط فيه `.default()`:
 *  - `*FormValues` = نوع **الإدخال** (الحقول ذات القيمة الافتراضية اختيارية).
 *  - `*Input`      = نوع **الإخراج** بعد التحقق (كل شيء محسوم).
 *
 * react-hook-form يحتاج الأول للنموذج والثاني لنتيجة الإرسال.
 */
export type RegisterCustomerFormValues = z.input<typeof registerCustomerSchema>;
export type RegisterCustomerInput = z.output<typeof registerCustomerSchema>;

/* ---- تسجيل الدخول (الصورة 03) ---- */

/**
 * حقل واحد يقبل الهاتف أو البريد — كما في التصميم:
 * «رقم الهاتف أو البريد الإلكتروني».
 */
export const loginSchema = z
  .object({
    identifier: z
      .string()
      .trim()
      .min(1, 'أدخل رقم الهاتف أو البريد الإلكتروني.')
      .max(160),
    password: z.string().min(1, 'أدخل كلمة المرور.').max(128),
    remember: z.boolean().default(false),
  })
  .strict();

export type LoginFormValues = z.input<typeof loginSchema>;
export type LoginInput = z.output<typeof loginSchema>;

/** يميّز نوع المعرّف ويطبّعه. */
export function normalizeIdentifier(raw: string): { phone?: string; email?: string } | null {
  const value = raw.trim();

  if (value.includes('@')) {
    const parsed = emailSchema.safeParse(value);
    return parsed.success ? { email: parsed.data } : null;
  }

  const parsed = egyptPhoneSchema.safeParse(value);
  return parsed.success ? { phone: parsed.data } : null;
}

/* ---- نسيت / إعادة تعيين كلمة المرور ---- */

export const forgotPasswordSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20, 'رابط إعادة التعيين غير صالح.').max(200),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: 'كلمتا المرور غير متطابقتين.',
    path: ['confirmPassword'],
  });

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/* ---- تسجيل الخروج ---- */
export const logoutSchema = z
  .object({
    /** true = إنهاء كل الجلسات على كل الأجهزة. */
    allDevices: z.boolean().default(false),
  })
  .strict();

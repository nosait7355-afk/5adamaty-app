import { z } from 'zod';

/**
 * التحقق من متغيرات البيئة عند الإقلاع.
 *
 * قاعدة أمنية (ARCHITECTURE §7): كل الأسرار على السيرفر فقط. المتغير الوحيد
 * المتاح للمتصفح هو `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` — وهو ليس سرًّا.
 * ممنوع منعًا باتًا تعريف `NEXT_PUBLIC_CLOUDINARY_API_SECRET` أو ما يشبهه.
 *
 * في Phase 1 معظم المتغيرات اختيارية لأن قاعدة البيانات و Cloudinary يدخلان
 * في Phase 2 و Phase 4. تصبح إلزامية في مرحلتها.
 */

/**
 * متغيرات `.env.local` الفارغة (`KEY=` بلا قيمة) تصل كسلسلة فارغة `''` لا
 * `undefined` — فيفشل أي تحقق `.min(1)`/`.regex()`/`.url()` عليها رغم كونها
 * `.optional()` منطقيًا. هذا الـpreprocess يحوّل الفارغ إلى `undefined` أولًا
 * لكل حقل اختياري، فتُعامَل «موجود لكن فارغ» كـ«غير موجود» في كل مكان.
 */
const optionalString = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (val === '' ? undefined : val), schema.optional());

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // قاعدة البيانات — إلزامية منذ Phase 2
  MONGODB_URI: optionalString(z.string().url()),
  MONGODB_DB_NAME: optionalString(z.string().min(1)),

  /*
   * أسرار JWT — إلزامية منذ Phase 3.
   * 32 حرفًا حد أدنى؛ ولّدها بـ:
   *   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   * المفتاحان مختلفان عمدًا: تسريب أحدهما لا يسمح بتزوير النوع الآخر.
   */
  JWT_ACCESS_SECRET: optionalString(
    z.string().min(32, 'JWT_ACCESS_SECRET قصير جدًا (32 حرفًا على الأقل).')
  ),
  JWT_REFRESH_SECRET: optionalString(
    z.string().min(32, 'JWT_REFRESH_SECRET قصير جدًا (32 حرفًا على الأقل).')
  ),

  /*
   * Cloudinary — إلزامية منذ Phase 4.
   * API_SECRET سرّ خادم مطلق: لا يُشتق منه أي متغيّر NEXT_PUBLIC_ ولا يُرسل
   * للمتصفح بأي شكل. المتصفح يتلقى **توقيعًا** لعملية واحدة فقط.
   */
  CLOUDINARY_CLOUD_NAME: optionalString(z.string().min(1)),
  CLOUDINARY_API_KEY: optionalString(z.string().min(1)),
  CLOUDINARY_API_SECRET: optionalString(z.string().min(1)),
  /**
   * مفتاح رموز الوصول الموقّتة (hex) من إعدادات حساب Cloudinary.
   * بدونه تبقى روابط المستندات موقّعة لكن بلا انتهاء زمني.
   */
  CLOUDINARY_AUTH_TOKEN_KEY: optionalString(
    z.string().regex(/^[0-9a-fA-F]+$/, 'CLOUDINARY_AUTH_TOKEN_KEY يجب أن يكون ست عشريًا.')
  ),

  /*
   * Resend — بريد إعادة تعيين كلمة المرور فقط (Phase 10، حاجز إطلاق مؤجَّل من Phase 3).
   * اختياريان عمدًا: بدونهما يستمر النظام في وضع «تسجيل فقط» بلا إرسال فعلي
   * (`src/server/lib/email.ts`) — لا يفشل الإقلاع ولا حتى في الإنتاج، لأن تفعيل
   * البريد قرار تشغيلي منفصل يُتّخذ بإضافة المفتاحين وقت الحاجة.
   */
  RESEND_API_KEY: optionalString(z.string().min(1)),
  RESEND_FROM_EMAIL: optionalString(z.string().email()),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  APP_URL: z.string().url().default('http://localhost:3000'),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function parseServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    // نفشل الإقلاع بدل العمل بإعداد ناقص
    throw new Error(`إعداد البيئة غير صالح:\n${details}`);
  }

  const env = parsed.data;

  /*
   * في الإنتاج تصبح أسرار الجلسة والقاعدة إلزامية فعلًا.
   * نفشل الإقلاع بدل تشغيل تطبيق بلا مصادقة صالحة.
   */
  if (env.NODE_ENV === 'production') {
    const missing: string[] = [];
    if (!env.MONGODB_URI) missing.push('MONGODB_URI');
    if (!env.JWT_ACCESS_SECRET) missing.push('JWT_ACCESS_SECRET');
    if (!env.JWT_REFRESH_SECRET) missing.push('JWT_REFRESH_SECRET');
    if (!env.CLOUDINARY_CLOUD_NAME) missing.push('CLOUDINARY_CLOUD_NAME');
    if (!env.CLOUDINARY_API_KEY) missing.push('CLOUDINARY_API_KEY');
    if (!env.CLOUDINARY_API_SECRET) missing.push('CLOUDINARY_API_SECRET');

    if (missing.length > 0) {
      throw new Error(`متغيرات بيئة إلزامية ناقصة في الإنتاج: ${missing.join('، ')}`);
    }
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      throw new Error('JWT_ACCESS_SECRET و JWT_REFRESH_SECRET يجب أن يكونا مختلفين.');
    }
  }

  return env;
}

let cached: ServerEnv | null = null;

/** متغيرات البيئة للسيرفر — لا تستوردها في أي مكوّن عميل. */
export function getEnv(): ServerEnv {
  cached ??= parseServerEnv();
  return cached;
}

/** المتغيرات العامة الآمنة للمتصفح. */
export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
});

export const isProduction = process.env.NODE_ENV === 'production';
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isTest = process.env.NODE_ENV === 'test';

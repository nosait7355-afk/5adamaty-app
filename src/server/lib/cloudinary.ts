import { createHash, createHmac, randomBytes } from 'node:crypto';
import { getEnv } from './env';
import { logger } from './logger';
import { internalError } from './errors';

/**
 * تكامل Cloudinary (ARCHITECTURE §8).
 *
 * ⚠️ قاعدة أمنية مطلقة: `CLOUDINARY_API_SECRET` لا يغادر السيرفر أبدًا.
 * كل ما يصل المتصفح هو **توقيع** لعملية واحدة محددة المعالم — لا السرّ نفسه.
 * المتاح للمتصفح فقط `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` وهو ليس سرًّا.
 *
 * لا نستخدم SDK رسميًا: التوقيع عملية تجزئة بسيطة، وكتابتها يدويًا تعني
 * تحكمًا كاملًا فيما يُوقَّع بالضبط — وهو جوهر أمان الرفع المباشر.
 */

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/** يقرأ الإعداد أو يرمي — يُستدعى فقط في المسارات التي تحتاجه فعلًا. */
export function getCloudinaryConfig(): CloudinaryConfig {
  const env = getEnv();

  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw internalError(
      'إعداد Cloudinary ناقص. أضف CLOUDINARY_CLOUD_NAME و CLOUDINARY_API_KEY و CLOUDINARY_API_SECRET في .env.local'
    );
  }

  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
  };
}

export function isCloudinaryConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

/* ================================================================== */
/* التوقيع                                                             */
/* ================================================================== */

/**
 * يبني سلسلة التوقيع بترتيب Cloudinary المطلوب.
 *
 * القاعدة: كل المعاملات المُرسلة **عدا** `file` و`cloud_name` و`resource_type`
 * و`api_key`، مرتّبة أبجديًا، بصيغة `key=value&key=value`، ثم يُلحق بها السرّ.
 *
 * المعاملات الفارغة تُحذف — إدراجها يكسر التوقيع.
 */
export function buildSignaturePayload(params: Record<string, string | number | undefined>): string {
  const excluded = new Set(['file', 'cloud_name', 'resource_type', 'api_key', 'signature']);

  return Object.keys(params)
    .filter((key) => !excluded.has(key))
    .filter((key) => params[key] !== undefined && params[key] !== '')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
}

/**
 * يوقّع معاملات الرفع.
 *
 * Cloudinary يستخدم SHA-1 افتراضيًا؛ الحسابات المضبوطة على SHA-256 تمرّر
 * `algorithm: 'sha256'`. لا يُختار عشوائيًا — يجب أن يطابق إعداد الحساب.
 */
export function signParams(
  params: Record<string, string | number | undefined>,
  apiSecret: string,
  algorithm: 'sha1' | 'sha256' = 'sha1'
): string {
  const payload = buildSignaturePayload(params);
  return createHash(algorithm).update(`${payload}${apiSecret}`).digest('hex');
}

export interface UploadSignature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  /** نقطة الرفع التي يستدعيها المتصفح. */
  uploadUrl: string;
  /** المعاملات التي **يجب** إرسالها كما هي — أي تغيير يُبطل التوقيع. */
  params: Record<string, string | number>;
}

/**
 * يصدر توقيع رفع لعملية واحدة.
 *
 * الحماية هنا ليست في التوقيع وحده بل فيما يُوقَّع: نثبّت `folder`
 * و`public_id` و`access_mode` و`allowed_formats` — فلا يستطيع العميل تغيير
 * المجلد ولا رفع صيغة ممنوعة، لأن أي تعديل على هذه المعاملات يجعل Cloudinary
 * يرفض التوقيع.
 *
 * ⚠️ لا يوجد `max_bytes` هنا رغم أن الاسم مُغرٍ: Cloudinary لا يدعمه كمعامل
 * رفع موقَّع فعليًا — إدراجه في السلسلة الموقَّعة يجعل توقيعنا لا يطابق ما
 * يحسبه Cloudinary نفسه فيُرفض الرفع بـ«Invalid Signature» دائمًا (اكتُشف
 * بالاختبار الحي أول مرة، Phase 10). حدّ الحجم مفروض بطبقتين مستقلتين لا
 * علاقة لهما بالتوقيع: فحص `sizeBytes` المُعلَن قبل التوقيع (أعلاه في
 * `upload.service.ts`)، والتحقق من `asset.bytes` الحقيقي من Cloudinary بعد
 * الرفع مباشرة قبل الحفظ.
 */
export function createUploadSignature(options: {
  folder: string;
  publicId: string;
  accessMode: 'public' | 'authenticated';
  allowedFormats: readonly string[];
  /** وسوم للتتبّع وتنظيف الأصول اليتيمة. */
  tags?: readonly string[];
}): UploadSignature {
  const config = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);

  const params: Record<string, string | number> = {
    timestamp,
    folder: options.folder,
    public_id: options.publicId,
    // `authenticated` يجعل الأصل غير قابل للفتح برابط عام
    type: options.accessMode === 'authenticated' ? 'authenticated' : 'upload',
    allowed_formats: options.allowedFormats.join(','),
    // منع الكتابة فوق أصل قائم بنفس المعرّف
    overwrite: 'false',
    unique_filename: 'false',
    use_filename: 'false',
    ...(options.tags?.length ? { tags: options.tags.join(',') } : {}),
  };

  const signature = signParams(params, config.apiSecret);

  return {
    signature,
    timestamp,
    apiKey: config.apiKey,
    cloudName: config.cloudName,
    uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
    params,
  };
}

/* ================================================================== */
/* روابط العرض الموقّعة                                                */
/* ================================================================== */

/**
 * توقيع رابط عرض لأصل `authenticated`.
 *
 * القاعدة (توثيق Cloudinary — Generating delivery URL signatures): يُوقَّع
 * **كل ما يلي segment التوقيع في الرابط فعليًا** — أي `public_id.format`، لا
 * `public_id` وحده. توقيع بلا الامتداد يُنتج سلسلة موقَّعة لا تطابق ما
 * يحسبه Cloudinary من الرابط الفعلي، فيُرفض بـ401 دائمًا — هذا بالضبط ما
 * كان يحدث قبل هذا الإصلاح (اكتُشف حيًّا، Phase 10).
 */
function signDeliveryUrl(publicIdWithFormat: string, transformation: string, apiSecret: string): string {
  const toSign = transformation ? `${transformation}/${publicIdWithFormat}` : publicIdWithFormat;
  return createHash('sha1')
    .update(`${toSign}${apiSecret}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .slice(0, 8);
}

/**
 * رمز وصول موقّت (Cloudinary auth_token).
 *
 * يحتاج `CLOUDINARY_AUTH_TOKEN_KEY` (مفتاح ست عشري من إعدادات الحساب).
 * بدونه يبقى الرابط موقّعًا وغير قابل للتخمين، لكن بلا انتهاء زمني —
 * وهو ما يُسجَّل تحذيرًا لأنه أضعف مما نصّت عليه المعمارية.
 */
function createAuthToken(params: {
  key: string;
  aclOrUrl: string;
  expiresAt: number;
}): string {
  const fields = [`exp=${params.expiresAt}`, `acl=${encodeURIComponent(params.aclOrUrl)}`];
  const payload = fields.join('~');
  const signature = createHmac('sha256', Buffer.from(params.key, 'hex'))
    .update(payload)
    .digest('hex');

  return `__cld_token__=${fields.join('~')}~hmac=${signature}`;
}

export interface SignedAssetUrl {
  url: string;
  expiresAt: Date | null;
  /** false = الرابط موقّع صالح للفتح لكن بلا انتهاء زمني (لم يُضبط auth token key). */
  timeLimited: boolean;
}

/**
 * يبني رابط عرض موقّعًا لمستند خاص.
 * يُستدعى فقط بعد التحقق من الصلاحية في طبقة الخدمة.
 *
 * التوقيع (segment `s--...--`) **كافٍ وحده** لفتح أصل `authenticated` — هذا
 * مسار Cloudinary الرسمي والموثَّق للوصول الذاتي (self-service `sign_url`)
 * بلا حاجة لأي مفتاح مُزوَّد من دعم Cloudinary. `CLOUDINARY_AUTH_TOKEN_KEY`
 * (`__cld_token__`) طبقة **إضافية اختيارية** تضيف انتهاءً زمنيًا فقط — ميزة
 * منفصلة كليًا تتطلب تذكرة دعم من Cloudinary لتفعيلها على الحساب، ولا علاقة
 * لها بالتوقيع الأساسي.
 *
 * ⚠️ لاحظ (Phase 10): يجب توقيع **كل ما يلي segment التوقيع في الرابط
 * فعليًا** — أي `public_id.format` معًا، لا `public_id` وحده. توقيع الجزء
 * الناقص كان يُنتج رابطًا مرفوضًا بـ401 دائمًا (اكتُشف حيًّا وأُصلح).
 */
export function buildSignedAssetUrl(options: {
  publicId: string;
  format: string;
  ttlSeconds: number;
  resourceType?: 'image' | 'raw';
}): SignedAssetUrl {
  const config = getCloudinaryConfig();
  const env = getEnv();
  const resourceType = options.resourceType ?? 'image';

  const signature = signDeliveryUrl(`${options.publicId}.${options.format}`, '', config.apiSecret);
  const base = `https://res.cloudinary.com/${config.cloudName}/${resourceType}/authenticated/s--${signature}--/${options.publicId}.${options.format}`;

  const tokenKey = env.CLOUDINARY_AUTH_TOKEN_KEY;
  if (!tokenKey) {
    return { url: base, expiresAt: null, timeLimited: false };
  }

  const expiresAt = Math.floor(Date.now() / 1000) + options.ttlSeconds;
  const token = createAuthToken({
    key: tokenKey,
    aclOrUrl: `/${resourceType}/authenticated/*`,
    expiresAt,
  });

  return {
    url: `${base}?${token}`,
    expiresAt: new Date(expiresAt * 1000),
    timeLimited: true,
  };
}

/* ================================================================== */
/* التحقق بعد الرفع والحذف                                             */
/* ================================================================== */

export interface CloudinaryAsset {
  publicId: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  resourceType: string;
  type: string;
  secureUrl: string;
}

/**
 * يتحقق من الأصل بعد رفعه — خطوة أمنية لا تجميلية.
 *
 * الرفع يتم من المتصفح، فما يصل السيرفر بعده هو **ادعاء** العميل عن الملف.
 * قبل حفظ أي metadata نسأل Cloudinary نفسها عن الأصل الحقيقي ونحفظ ما
 * تقوله هي — لا ما قاله العميل. هذا يقطع تزوير الحجم أو الصيغة أو المسار.
 */
export async function fetchAssetDetails(params: {
  publicId: string;
  resourceType?: 'image' | 'raw';
  type?: 'upload' | 'authenticated';
}): Promise<CloudinaryAsset | null> {
  const config = getCloudinaryConfig();
  const resourceType = params.resourceType ?? 'image';
  const type = params.type ?? 'upload';

  const url = `https://api.cloudinary.com/v1_1/${config.cloudName}/resources/${resourceType}/${type}/${encodeURIComponent(params.publicId)}`;
  const auth = Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64');

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status === 404) return null;
    if (!response.ok) {
      logger.error('فشل الاستعلام عن أصل Cloudinary', {
        status: response.status,
        publicId: params.publicId,
      });
      return null;
    }

    const data = (await response.json()) as Record<string, unknown>;
    return {
      publicId: String(data.public_id),
      format: String(data.format),
      bytes: Number(data.bytes),
      ...(data.width ? { width: Number(data.width) } : {}),
      ...(data.height ? { height: Number(data.height) } : {}),
      resourceType: String(data.resource_type),
      type: String(data.type),
      secureUrl: String(data.secure_url),
    };
  } catch (error) {
    logger.error('خطأ في الاتصال بـCloudinary', { error, publicId: params.publicId });
    return null;
  }
}

/** يحذف أصلًا — يُستدعى عند حذف الكيان المرتبط لتفادي الملفات اليتيمة. */
export async function deleteAsset(params: {
  publicId: string;
  resourceType?: 'image' | 'raw';
  type?: 'upload' | 'authenticated';
}): Promise<boolean> {
  const config = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const type = params.type ?? 'upload';

  const signParamsForDestroy = {
    public_id: params.publicId,
    timestamp,
    ...(type === 'authenticated' ? { type } : {}),
  };
  const signature = signParams(signParamsForDestroy, config.apiSecret);

  const body = new URLSearchParams({
    public_id: params.publicId,
    timestamp: String(timestamp),
    api_key: config.apiKey,
    signature,
    ...(type === 'authenticated' ? { type } : {}),
  });

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/${params.resourceType ?? 'image'}/destroy`,
      { method: 'POST', body, signal: AbortSignal.timeout(10_000) }
    );

    const data = (await response.json()) as { result?: string };
    const deleted = data.result === 'ok' || data.result === 'not found';

    if (!deleted) {
      logger.warn('لم يُحذف أصل Cloudinary', { publicId: params.publicId, result: data.result });
    }
    return deleted;
  } catch (error) {
    logger.error('خطأ في حذف أصل Cloudinary', { error, publicId: params.publicId });
    return false;
  }
}

/**
 * معرّف عام غير قابل للتخمين.
 *
 * لا نستخدم اسم الملف الأصلي: قد يحمل بيانات شخصية (مثل «بطاقة-أحمد.jpg»)
 * ويجعل المسار قابلًا للتخمين.
 */
export function generatePublicId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString('hex')}`;
}

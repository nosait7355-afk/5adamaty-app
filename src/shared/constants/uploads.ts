/**
 * قواعد رفع الملفات (ARCHITECTURE §8).
 *
 * الملفات ترتفع **مباشرة من المتصفح إلى Cloudinary** بتوقيع من السيرفر،
 * ولا تمرّ عبر سيرفر التطبيق. MongoDB يحتفظ بالـmetadata فقط —
 * ولا بايت صورة واحد.
 */

/** غرض الرفع — يحدد المجلد والقيود ومَن يُسمح له. */
export const UPLOAD_PURPOSES = [
  'AVATAR',
  'PROVIDER_GALLERY',
  'SERVICE_IMAGE',
  'ORDER_ATTACHMENT',
  'PROVIDER_DOCUMENT',
  'MESSAGE_ATTACHMENT',
] as const;

export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

/** صيغ الصور المسموح بها. */
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** المستندات الرسمية تقبل PDF إضافةً للصور. */
export const DOCUMENT_MIME_TYPES = [...IMAGE_MIME_TYPES, 'application/pdf'] as const;

/**
 * صيغ محظورة صراحةً مهما كان الغرض.
 *
 * SVG أخطرها: ملف XML قد يحمل `<script>`، فيصبح ناقل XSS مخزَّن إذا عُرض
 * inline. والباقي تنفيذي أو أرشيفي.
 */
export const FORBIDDEN_MIME_TYPES = [
  'image/svg+xml',
  'text/html',
  'application/xhtml+xml',
  'application/javascript',
  'text/javascript',
  'application/x-msdownload',
  'application/x-sh',
  'application/x-executable',
  'application/zip',
  'application/x-rar-compressed',
] as const;

export interface UploadRule {
  /** أنواع MIME المقبولة. */
  accept: readonly string[];
  maxSizeMB: number;
  /** مجلد Cloudinary — يبدأ دائمًا بـ`khadamaty/`. */
  folder: string;
  /**
   * `authenticated` = أصل خاص لا يُقرأ إلا برابط موقّع.
   * `upload` = أصل عام قابل للعرض مباشرة.
   */
  accessMode: 'public' | 'authenticated';
  resourceType: 'image' | 'raw';
  /** أقصى عدد ملفات لهذا الغرض (للتحقق في الواجهة والسيرفر). */
  maxFiles: number;
}

export const UPLOAD_RULES: Record<UploadPurpose, UploadRule> = {
  AVATAR: {
    accept: IMAGE_MIME_TYPES,
    maxSizeMB: 3,
    folder: 'khadamaty/avatars',
    accessMode: 'public',
    resourceType: 'image',
    maxFiles: 1,
  },
  PROVIDER_GALLERY: {
    accept: IMAGE_MIME_TYPES,
    maxSizeMB: 5,
    folder: 'khadamaty/providers',
    accessMode: 'public',
    resourceType: 'image',
    maxFiles: 12,
  },
  SERVICE_IMAGE: {
    accept: IMAGE_MIME_TYPES,
    maxSizeMB: 5,
    folder: 'khadamaty/services',
    accessMode: 'public',
    resourceType: 'image',
    maxFiles: 8,
  },
  ORDER_ATTACHMENT: {
    accept: IMAGE_MIME_TYPES,
    maxSizeMB: 5,
    // «يمكنك إضافة حتى 5 صور» — الصورة 11
    folder: 'khadamaty/orders',
    accessMode: 'public',
    resourceType: 'image',
    maxFiles: 5,
  },
  /**
   * المستندات الحسّاسة: بطاقة الرقم القومي، المؤهل، الترخيص…
   * `authenticated` إجباري — لا يجوز أن تكون قابلة للفتح برابط عام.
   */
  PROVIDER_DOCUMENT: {
    accept: DOCUMENT_MIME_TYPES,
    maxSizeMB: 5,
    folder: 'khadamaty/documents',
    accessMode: 'authenticated',
    resourceType: 'image',
    maxFiles: 10,
  },
  MESSAGE_ATTACHMENT: {
    accept: IMAGE_MIME_TYPES,
    maxSizeMB: 5,
    folder: 'khadamaty/messages',
    accessMode: 'public',
    resourceType: 'image',
    maxFiles: 3,
  },
};

export const BYTES_PER_MB = 1024 * 1024;

/** امتداد الملف من نوع MIME — لبناء اسم العرض فقط. */
export const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export const MIME_LABEL_AR: Record<string, string> = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
  'application/pdf': 'PDF',
};

/**
 * التواقيع السحرية (magic bytes) لكل نوع مسموح.
 *
 * لماذا لا نثق بـ`file.type` أو الامتداد؟ لأن كليهما يأتي من العميل ويمكن
 * تزويره: ملف `.svg` خبيث يُسمّى `photo.png` ويُعلن `image/png` سيمرّ من أي
 * فحص يعتمد عليهما. الفحص الوحيد الموثوق هو قراءة أول بايتات الملف.
 */
export const MAGIC_SIGNATURES: Record<string, readonly number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  // WEBP = "RIFF" ثم 4 بايت حجم ثم "WEBP" — نتحقق من المقطعين
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
};

/** أقصى عدد بايتات نحتاج قراءتها للتعرّف على النوع. */
export const MAGIC_HEADER_BYTES = 16;

/** مدة صلاحية رابط المستند الموقّع. */
export const SIGNED_URL_TTL_SECONDS = 5 * 60;

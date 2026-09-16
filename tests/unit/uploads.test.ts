import { beforeAll, describe, expect, it } from 'vitest';
import {
  sniffMimeType,
  validateFileHeader,
} from '@/shared/lib/file-signature';
import {
  buildSignaturePayload,
  createUploadSignature,
  generatePublicId,
  signParams,
} from '@/server/lib/cloudinary';
import { issueUploadSignature } from '@/server/services/upload.service';
import {
  BYTES_PER_MB,
  DOCUMENT_MIME_TYPES,
  FORBIDDEN_MIME_TYPES,
  IMAGE_MIME_TYPES,
  UPLOAD_RULES,
} from '@/shared/constants/uploads';
import { uploadSignatureSchema, publicIdSchema } from '@/shared/schemas/upload.schema';
import type { SessionUser } from '@/server/middleware/with-auth';

beforeAll(() => {
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
  process.env.CLOUDINARY_API_KEY = '123456789012345';
  process.env.CLOUDINARY_API_SECRET = 'test-api-secret-value';
  process.env.APP_URL = 'http://localhost:3000';
});

/* ---- تواقيع ملفات حقيقية ---- */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
]);
/** `<svg xmlns` — ناقل XSS مخزَّن */
const SVG = new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0x20, 0x78, 0x6d, 0x6c]);
/** `<!DOCTYPE` */
const HTML = new Uint8Array([0x3c, 0x21, 0x44, 0x4f, 0x43, 0x54, 0x59, 0x50]);
/** `MZ` — تنفيذي ويندوز */
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
/** `PK` — أرشيف zip */
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);

const customer: SessionUser = { id: '507f1f77bcf86cd799439011', role: 'CUSTOMER', status: 'ACTIVE' };
const provider: SessionUser = { id: '507f1f77bcf86cd799439012', role: 'PROVIDER', status: 'ACTIVE' };

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

/* ================================================================== */

describe('التعرّف على نوع الملف من محتواه', () => {
  it('يتعرّف على الأنواع المسموحة', () => {
    expect(sniffMimeType(JPEG)).toBe('image/jpeg');
    expect(sniffMimeType(PNG)).toBe('image/png');
    expect(sniffMimeType(PDF)).toBe('application/pdf');
    expect(sniffMimeType(WEBP)).toBe('image/webp');
  });

  it('🔐 يرفض SVG — ناقل XSS مخزَّن', () => {
    expect(sniffMimeType(SVG)).toBeNull();
  });

  it('🔐 يرفض HTML والتنفيذيات والأرشيفات', () => {
    expect(sniffMimeType(HTML)).toBeNull();
    expect(sniffMimeType(EXE)).toBeNull();
    expect(sniffMimeType(ZIP)).toBeNull();
  });

  it('يرفض المخزن الفارغ أو القصير', () => {
    expect(sniffMimeType(new Uint8Array([]))).toBeNull();
    expect(sniffMimeType(new Uint8Array([0xff]))).toBeNull();
  });

  it('لا يقبل RIFF بلا WEBP (ملف WAV مثلًا)', () => {
    const wav = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]);
    expect(sniffMimeType(wav)).toBeNull();
  });
});

describe('التحقق من الملف', () => {
  const base = { accept: IMAGE_MIME_TYPES, maxSizeMB: 5 };

  it('يقبل ملفًا سليمًا', () => {
    const result = validateFileHeader({
      ...base,
      header: JPEG,
      declaredMime: 'image/jpeg',
      sizeBytes: 500_000,
    });
    expect(result.ok).toBe(true);
    expect(result.detectedMime).toBe('image/jpeg');
  });

  it('🔐 يرفض SVG متنكّرًا في هيئة PNG', () => {
    // الهجوم: ملف SVG خبيث يُعلن نفسه image/png
    const result = validateFileHeader({
      ...base,
      header: SVG,
      declaredMime: 'image/png',
      sizeBytes: 1000,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('تعذّر التعرّف');
  });

  it('🔐 يرفض تنفيذيًا متنكّرًا في هيئة JPEG', () => {
    const result = validateFileHeader({
      ...base,
      header: EXE,
      declaredMime: 'image/jpeg',
      sizeBytes: 1000,
    });
    expect(result.ok).toBe(false);
  });

  it('🔐 يرفض التعارض بين المُعلن والحقيقي', () => {
    // الملف PNG فعلًا لكن أُعلن JPEG — تحايل أو خلل، نرفض في الحالتين
    const result = validateFileHeader({
      ...base,
      header: PNG,
      declaredMime: 'image/jpeg',
      sizeBytes: 1000,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('لا يطابق');
  });

  it('🔐 يرفض نوع MIME محظورًا صراحةً', () => {
    for (const mime of FORBIDDEN_MIME_TYPES) {
      const result = validateFileHeader({
        ...base,
        header: PNG,
        declaredMime: mime,
        sizeBytes: 1000,
      });
      expect(result.ok, mime).toBe(false);
    }
  });

  it('يرفض PDF حيث تُقبل الصور فقط', () => {
    const result = validateFileHeader({
      ...base,
      header: PDF,
      declaredMime: 'application/pdf',
      sizeBytes: 1000,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('غير مسموح');
  });

  it('يقبل PDF حيث تُقبل المستندات', () => {
    const result = validateFileHeader({
      header: PDF,
      declaredMime: 'application/pdf',
      sizeBytes: 1000,
      accept: DOCUMENT_MIME_TYPES,
      maxSizeMB: 5,
    });
    expect(result.ok).toBe(true);
  });

  it('يرفض ما يتجاوز الحد', () => {
    const result = validateFileHeader({
      ...base,
      header: JPEG,
      declaredMime: 'image/jpeg',
      sizeBytes: 6 * BYTES_PER_MB,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('5MB');
  });

  it('يقبل ما يساوي الحد بالضبط', () => {
    const result = validateFileHeader({
      ...base,
      header: JPEG,
      declaredMime: 'image/jpeg',
      sizeBytes: 5 * BYTES_PER_MB,
    });
    expect(result.ok).toBe(true);
  });

  it('يرفض الملف الفارغ', () => {
    const result = validateFileHeader({
      ...base,
      header: JPEG,
      declaredMime: 'image/jpeg',
      sizeBytes: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('فارغ');
  });
});

describe('توقيع Cloudinary', () => {
  it('يرتّب المعاملات أبجديًا', () => {
    const payload = buildSignaturePayload({ timestamp: 100, folder: 'a', public_id: 'b' });
    expect(payload).toBe('folder=a&public_id=b&timestamp=100');
  });

  it('يستبعد المعاملات التي لا تُوقَّع', () => {
    const payload = buildSignaturePayload({
      timestamp: 100,
      file: 'ignored',
      cloud_name: 'ignored',
      api_key: 'ignored',
      resource_type: 'ignored',
      signature: 'ignored',
    });
    expect(payload).toBe('timestamp=100');
  });

  it('يتجاهل المعاملات الفارغة', () => {
    const payload = buildSignaturePayload({ timestamp: 100, tags: undefined, folder: '' });
    expect(payload).toBe('timestamp=100');
  });

  it('التوقيع ثابت لنفس المدخلات ومختلف عند أي تغيير', () => {
    const params = { timestamp: 1000, folder: 'khadamaty/docs', public_id: 'abc' };
    const first = signParams(params, 'secret');

    expect(signParams(params, 'secret')).toBe(first);
    expect(signParams({ ...params, folder: 'other' }, 'secret')).not.toBe(first);
    expect(signParams(params, 'different-secret')).not.toBe(first);
  });

  it('🔐 التوقيع لا يحتوي السرّ نفسه', () => {
    const signature = signParams({ timestamp: 1 }, 'super-secret-value');
    expect(signature).not.toContain('super-secret-value');
    expect(signature).toMatch(/^[0-9a-f]{40}$/);
  });

  it('يثبّت المعاملات الحسّاسة في التوقيع', () => {
    const result = createUploadSignature({
      folder: 'khadamaty/documents/user1',
      publicId: 'doc_abc',
      accessMode: 'authenticated',
      allowedFormats: ['jpg', 'png'],
    });

    expect(result.params.folder).toBe('khadamaty/documents/user1');
    expect(result.params.type).toBe('authenticated');
    expect(result.params.allowed_formats).toBe('jpg,png');
    // منع الكتابة فوق أصل قائم
    expect(result.params.overwrite).toBe('false');
    // لا max_bytes: Cloudinary لا يدعمه كمعامل رفع موقَّع (يكسر التوقيع فعليًا)
    expect(result.params.max_bytes).toBeUndefined();
  });

  it('🔐 لا يسرّب السرّ في الاستجابة', () => {
    const result = createUploadSignature({
      folder: 'f',
      publicId: 'p',
      accessMode: 'public',
      allowedFormats: ['jpg'],
    });
    expect(JSON.stringify(result)).not.toContain('test-api-secret-value');
  });

  it('يولّد معرّفات غير قابلة للتخمين', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generatePublicId('doc')));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(/^doc_[0-9a-f]{24}$/);
  });
});

describe('إصدار توقيع الرفع — التفويض', () => {
  const validRequest = {
    purpose: 'PROVIDER_DOCUMENT' as const,
    contentType: 'image/jpeg',
    sizeBytes: 500_000,
    headerBase64: toBase64(JPEG),
  };

  it('يسمح للمزوّد برفع مستند', () => {
    const result = issueUploadSignature(provider, validRequest);
    expect(result.signature).toBeTruthy();
    expect(result.purpose).toBe('PROVIDER_DOCUMENT');
  });

  it('🔐 يمنع العميل من رفع مستندات مزوّد', () => {
    expect(() => issueUploadSignature(customer, validRequest)).toThrow(/صلاحية/);
  });

  it('🔐 يمنع المزوّد من رفع مرفقات طلب (خاصة بالعميل)', () => {
    expect(() =>
      issueUploadSignature(provider, { ...validRequest, purpose: 'ORDER_ATTACHMENT' })
    ).toThrow(/صلاحية/);
  });

  it('🔐 المجلد يُبنى من هوية المستخدم لا من الطلب', () => {
    const result = issueUploadSignature(provider, validRequest);
    expect(result.params.folder).toBe(`khadamaty/documents/${provider.id}`);
    expect(result.publicId).toContain(`/${provider.id}/`);
  });

  it('🔐 مستخدمان مختلفان يحصلان على مجلدين مختلفين', () => {
    const a = issueUploadSignature(provider, validRequest);
    const b = issueUploadSignature(
      { ...provider, id: '507f1f77bcf86cd799439099' },
      validRequest
    );
    expect(a.params.folder).not.toBe(b.params.folder);
  });

  it('🔐 المستندات تُوقَّع بوضع authenticated دائمًا', () => {
    const result = issueUploadSignature(provider, validRequest);
    expect(result.params.type).toBe('authenticated');
  });

  it('الصور العامة تُوقَّع بوضع upload', () => {
    const result = issueUploadSignature(customer, {
      purpose: 'AVATAR',
      contentType: 'image/png',
      sizeBytes: 100_000,
      headerBase64: toBase64(PNG),
    });
    expect(result.params.type).toBe('upload');
  });

  it('🔐 يرفض SVG متنكّرًا قبل إصدار أي توقيع', () => {
    expect(() =>
      issueUploadSignature(provider, {
        ...validRequest,
        contentType: 'image/png',
        headerBase64: toBase64(SVG),
      })
    ).toThrow(/تعذّر التعرّف/);
  });

  it('🔐 يرفض ما يتجاوز الحجم قبل إصدار أي توقيع', () => {
    expect(() =>
      issueUploadSignature(provider, { ...validRequest, sizeBytes: 6 * BYTES_PER_MB })
    ).toThrow(/يتجاوز الحد/);
  });

  it('يرفض ترويسة base64 تالفة', () => {
    expect(() =>
      issueUploadSignature(provider, { ...validRequest, headerBase64: '!!!not-base64!!!' })
    ).toThrow();
  });
});

describe('مخططات الرفع', () => {
  it('يرفض معرّفًا فيه محاولة خروج من المجلد', () => {
    expect(() => publicIdSchema.parse('khadamaty/documents/../../secret')).toThrow();
    expect(() => publicIdSchema.parse('../etc/passwd')).toThrow();
  });

  it('يرفض المحارف الخطرة في المعرّف', () => {
    expect(() => publicIdSchema.parse('doc;rm -rf')).toThrow();
    expect(() => publicIdSchema.parse('doc$(whoami)')).toThrow();
    expect(() => publicIdSchema.parse('doc<script>')).toThrow();
  });

  it('يقبل معرّفًا سليمًا', () => {
    expect(() =>
      publicIdSchema.parse('khadamaty/documents/507f1f77bcf86cd799439012/doc_abc123')
    ).not.toThrow();
  });

  it('يرفض غرضًا غير معروف', () => {
    expect(() =>
      uploadSignatureSchema.parse({
        purpose: 'HACK',
        contentType: 'image/png',
        sizeBytes: 100,
        headerBase64: 'AAAA',
      })
    ).toThrow();
  });

  it('يرفض الحجم السالب أو الضخم', () => {
    const base = { purpose: 'AVATAR', contentType: 'image/png', headerBase64: 'AAAA' };
    expect(() => uploadSignatureSchema.parse({ ...base, sizeBytes: -1 })).toThrow();
    expect(() =>
      uploadSignatureSchema.parse({ ...base, sizeBytes: 100 * BYTES_PER_MB })
    ).toThrow();
  });

  it('يرفض المفاتيح غير المعرّفة (strict)', () => {
    expect(() =>
      uploadSignatureSchema.parse({
        purpose: 'AVATAR',
        contentType: 'image/png',
        sizeBytes: 100,
        headerBase64: 'AAAA',
        folder: 'khadamaty/documents/victim',
      })
    ).toThrow();
  });
});

describe('قواعد الرفع', () => {
  it('المستندات الحسّاسة authenticated دائمًا', () => {
    expect(UPLOAD_RULES.PROVIDER_DOCUMENT.accessMode).toBe('authenticated');
  });

  it('كل المجلدات تحت khadamaty/', () => {
    for (const [purpose, rule] of Object.entries(UPLOAD_RULES)) {
      expect(rule.folder, purpose).toMatch(/^khadamaty\//);
    }
  });

  it('لا قاعدة تقبل SVG', () => {
    for (const [purpose, rule] of Object.entries(UPLOAD_RULES)) {
      expect(rule.accept, purpose).not.toContain('image/svg+xml');
    }
  });

  it('مرفقات الطلب محدودة بخمس — مطابق للصورة 11', () => {
    expect(UPLOAD_RULES.ORDER_ATTACHMENT.maxFiles).toBe(5);
  });

  it('حد المستندات 3MB', () => {
    expect(UPLOAD_RULES.PROVIDER_DOCUMENT.maxSizeMB).toBe(3);
  });
});

import { describe, expect, it } from 'vitest';

/**
 * اختبار معزول عمدًا في ملف مستقل: `getEnv()` يخزّن مؤقتًا مرة واحدة لكل
 * عملية اختبار (module-level cache)، فلا يمكن اختبار الحالتين «مفتاح موجود»
 * و«مفتاح غائب» لـ`CLOUDINARY_AUTH_TOKEN_KEY` داخل نفس الملف بعد أول
 * استدعاء لـ`getEnv()`.
 */
describe('buildSignedAssetUrl — بلا CLOUDINARY_AUTH_TOKEN_KEY', () => {
  it('التوقيع الذاتي (s--...--) كافٍ وحده — رابط صالح بلا حاجة لمفتاح مُزوَّد من الدعم', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = '123456789012345';
    process.env.CLOUDINARY_API_SECRET = 'test-api-secret-value';
    delete process.env.CLOUDINARY_AUTH_TOKEN_KEY;

    const { buildSignedAssetUrl } = await import('@/server/lib/cloudinary');

    const result = buildSignedAssetUrl({
      publicId: 'khadamaty/documents/abc/doc_123',
      format: 'jpg',
      ttlSeconds: 300,
    });

    expect(result.timeLimited).toBe(false);
    expect(result.expiresAt).toBeNull();
    // segment التوقيع يجب أن يغطي public_id.format معًا — لا public_id وحده
    // (الخلل الذي اكتُشف حيًّا: توقيع ناقص ⇐ 401 دائمًا من Cloudinary).
    expect(result.url).toMatch(
      /^https:\/\/res\.cloudinary\.com\/test-cloud\/image\/authenticated\/s--[A-Za-z0-9_-]{8}--\/khadamaty\/documents\/abc\/doc_123\.jpg$/
    );
  });
});

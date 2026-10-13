import { NextResponse } from 'next/server';
import { getEnv } from '@/server/lib/env';
import { NATIVE_APP_ID } from '@/shared/constants/native-app';

export const dynamic = 'force-dynamic';

/**
 * GET /.well-known/assetlinks.json (إعادة توجيه في `next.config.ts`)
 *
 * Android App Links: يثبت أن هذا النطاق يسمح لتطبيق «خدمات الفيوم» بفتح
 * روابطه مباشرة (`intent-filter` في `mobile/android/.../AndroidManifest.xml`).
 *
 * البصمة هي SHA-256 لمفتاح **Play App Signing** في الحساب الجديد (Play
 * Console ← App integrity)، وأخرى لمفتاح الرفع لنسخ الاختبار المحلية — في
 * `ANDROID_APP_SHA256_FINGERPRINTS` مفصولة بفواصل. بلا بصمة: قائمة فارغة
 * والروابط تفتح في المتصفح كما الآن، لا شيء ينكسر.
 */
export function GET() {
  const fingerprints = getEnv().ANDROID_APP_SHA256_FINGERPRINTS ?? [];

  const statements =
    fingerprints.length === 0
      ? []
      : [
          {
            relation: ['delegate_permission/common.handle_all_urls'],
            target: {
              namespace: 'android_app',
              package_name: NATIVE_APP_ID,
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ];

  return NextResponse.json(statements, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { routeFromLink } from '../../mobile/src/deep-links';
import { API_ORIGIN } from '../../mobile/src/config';

const FINGERPRINT = Array.from({ length: 32 }, () => 'AB').join(':');

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function assetLinks() {
  const { GET } = await import('@/app/api/v1/app-links/route');
  return GET().json();
}

describe('روابط الموقع داخل التطبيق', () => {
  it('رابط من نطاقنا ← نفس المسار والاستعلام', () => {
    expect(routeFromLink(`${API_ORIGIN}/providers/abc?serviceId=1`)).toBe('/providers/abc?serviceId=1');
    expect(routeFromLink(`${API_ORIGIN}/reset-password?token=t`)).toBe('/reset-password?token=t');
  });

  it('🔐 لا يتنقّل لنطاق غريب أو رابط تالف', () => {
    expect(routeFromLink('https://evil.example/providers/abc')).toBeNull();
    expect(routeFromLink('not a url')).toBeNull();
  });
});

describe('assetlinks.json', () => {
  it('فارغ بلا بصمة — الروابط تبقى في المتصفح', async () => {
    vi.stubEnv('ANDROID_APP_SHA256_FINGERPRINTS', '');
    expect(await assetLinks()).toEqual([]);
  });

  it('يعلن التطبيق الجديد بالبصمات الصحيحة فقط', async () => {
    vi.stubEnv('ANDROID_APP_SHA256_FINGERPRINTS', `${FINGERPRINT.toLowerCase()}, not-a-fingerprint`);
    const [statement] = await assetLinks();
    expect(statement.target).toEqual({
      namespace: 'android_app',
      package_name: 'com.khadamat.fayoum',
      sha256_cert_fingerprints: [FINGERPRINT],
    });
  });
});

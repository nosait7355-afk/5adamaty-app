import { afterEach, describe, expect, it, vi } from 'vitest';
import { haptic, shareLink } from '@/lib/native';

/**
 * اللمسات الأصلية (المرحلة 5) خارج التطبيق الأصلي — في المتصفح، وفي نسخ
 * المتجر الأقدم التي لا تحوي الإضافات. لا شيء يجب أن يرمي خطأً.
 */

const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share');
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

function restore(name: 'share' | 'clipboard', descriptor?: PropertyDescriptor) {
  if (descriptor) Object.defineProperty(navigator, name, descriptor);
  else delete (navigator as unknown as Record<string, unknown>)[name];
}

afterEach(() => {
  restore('share', originalShare);
  restore('clipboard', originalClipboard);
});

function stub(name: 'share' | 'clipboard', value: unknown) {
  Object.defineProperty(navigator, name, { value, configurable: true, writable: true });
}

describe('haptic', () => {
  it('لا يفعل شيئًا ولا يرمي خارج التطبيق الأصلي', async () => {
    await expect(haptic('light')).resolves.toBeUndefined();
    await expect(haptic('warning')).resolves.toBeUndefined();
  });
});

describe('shareLink', () => {
  const content = { title: 'محمود السيد', url: 'https://example.test/providers/1' };

  it('يستخدم قائمة مشاركة المتصفح حيث توجد', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    stub('share', share);

    await expect(shareLink(content)).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'محمود السيد', url: content.url });
  });

  it('إغلاق القائمة بلا اختيار «إلغاء» لا «فشل»', async () => {
    stub('share', vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError')));
    await expect(shareLink(content)).resolves.toBe('cancelled');
  });

  it('بلا قائمة مشاركة ينسخ الرابط', async () => {
    stub('share', undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    stub('clipboard', { writeText });

    await expect(shareLink(content)).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith(content.url);
  });

  it('يبلّغ بالفشل إن تعذّر النسخ أيضًا', async () => {
    stub('share', undefined);
    stub('clipboard', { writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    await expect(shareLink(content)).resolves.toBe('failed');
  });
});

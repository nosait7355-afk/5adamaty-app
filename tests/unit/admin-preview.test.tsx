import { beforeEach, describe, expect, it } from 'vitest';
import {
  enterAdminPreview,
  exitAdminPreview,
  isAdminPreviewStored,
} from '@/lib/admin-preview';
import { resolveHomeRoute } from '@/lib/queries/auth';
import type { AuthUserDto } from '@/server/services/auth.service';

/**
 * وضع معاينة العميل — يتيح لحساب الإدارة تصفّح واجهة العميل والعودة.
 *
 * ملف `.tsx` لا `.ts` عمدًا: بيئة `ui` (jsdom) هي وحدها التي توفّر
 * `sessionStorage` — اختبارات `.test.ts` تعمل في بيئة node.
 */

const admin = { role: 'ADMIN', status: 'ACTIVE' } as AuthUserDto;
const customer = { role: 'CUSTOMER', status: 'ACTIVE' } as AuthUserDto;
const pendingProvider = { role: 'PROVIDER', status: 'PENDING_REVIEW' } as AuthUserDto;

describe('علامة وضع المعاينة', () => {
  beforeEach(() => sessionStorage.clear());

  it('مطفأة ما لم تُفعَّل', () => {
    expect(isAdminPreviewStored()).toBe(false);
  });

  it('تُفعَّل وتُطفأ', () => {
    enterAdminPreview();
    expect(isAdminPreviewStored()).toBe(true);
    exitAdminPreview();
    expect(isAdminPreviewStored()).toBe(false);
  });
});

describe('resolveHomeRoute', () => {
  it('يوجّه الأدمن للوحة التحكم افتراضيًا', () => {
    expect(resolveHomeRoute(admin)).toBe('/admin/dashboard');
  });

  it('يبقي الأدمن على واجهة العميل أثناء المعاينة', () => {
    expect(resolveHomeRoute(admin, { adminPreview: true })).toBe('/home');
  });

  it('لا تغيّر المعاينة وجهة الأدوار الأخرى', () => {
    expect(resolveHomeRoute(customer, { adminPreview: true })).toBe('/home');
    expect(resolveHomeRoute(pendingProvider, { adminPreview: true })).toBe(
      '/provider/pending-review'
    );
    expect(resolveHomeRoute(null, { adminPreview: true })).toBe('/login');
  });
});

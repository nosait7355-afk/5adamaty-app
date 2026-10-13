import { describe, expect, it } from 'vitest';
import { resolveRouteRedirect } from '@/shared/route-access';

const customer = { role: 'CUSTOMER', status: 'ACTIVE' } as const;
const provider = { role: 'PROVIDER', status: 'ACTIVE' } as const;
const pending = { role: 'PROVIDER', status: 'PENDING_REVIEW' } as const;
const admin = { role: 'ADMIN', status: 'ACTIVE' } as const;

describe('قواعد الوصول المشتركة (الموقع والتطبيق)', () => {
  it('الزائر على صفحة محمية ← الدخول مع الوجهة', () => {
    expect(resolveRouteRedirect('/account/profile', null)).toBe('/login?next=%2Faccount%2Fprofile');
  });

  it('الزائر على صفحة عامة يمرّ', () => {
    for (const path of ['/', '/login', '/privacy', '/delete-account', '/register/provider']) {
      expect(resolveRouteRedirect(path, null)).toBeNull();
    }
  });

  it('المسجّل على صفحة ضيوف ← صفحته', () => {
    expect(resolveRouteRedirect('/login', customer)).toBe('/home');
    expect(resolveRouteRedirect('/login', pending)).toBe('/provider/pending-review');
  });

  it('معالج تسجيل المزوّد مفتوح لمقدم الخدمة المسجّل', () => {
    expect(resolveRouteRedirect('/register/provider', provider)).toBeNull();
    expect(resolveRouteRedirect('/register/provider', customer)).toBe('/home');
  });

  it('عزل المساحات حسب الدور', () => {
    expect(resolveRouteRedirect('/admin/users', customer)).toBe('/home');
    expect(resolveRouteRedirect('/provider/services', customer)).toBe('/home');
    expect(resolveRouteRedirect('/account/become-provider', provider)).toBe('/home');
    expect(resolveRouteRedirect('/admin/users', admin)).toBeNull();
  });

  it('/providers/:id ليست مساحة المزوّد (حدود مقطعية)', () => {
    expect(resolveRouteRedirect('/providers/123', customer)).toBeNull();
  });

  it('شاشة البداية تتخطّى للصفحة الرئيسية — عدا الإدارة', () => {
    expect(resolveRouteRedirect('/', customer)).toBe('/home');
    expect(resolveRouteRedirect('/', admin)).toBeNull();
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { hasInAppHistory, isRootPath, recordNavigation } from '@/lib/navigation-history';
import { queryKeys } from '@/lib/query-keys';

describe('navigation history', () => {
  beforeEach(() => sessionStorage.clear());

  it('has no history on the first page of a session', () => {
    recordNavigation('/account');
    expect(hasInAppHistory()).toBe(false);
  });

  it('has history after an in-app navigation', () => {
    recordNavigation('/home');
    recordNavigation('/account');
    expect(hasInAppHistory()).toBe(true);
  });

  it('pops the stack when going back to the previous page', () => {
    recordNavigation('/home');
    recordNavigation('/account');
    recordNavigation('/home');
    expect(hasInAppHistory()).toBe(false);
  });

  it('treats home screens as roots', () => {
    expect(isRootPath('/home')).toBe(true);
    expect(isRootPath('/account')).toBe(false);
  });
});

describe('query keys', () => {
  // `useMe` يخزّن المستخدم فقط و`useAccountSummary` يخزّن `{ user, stats }`؛
  // مشاركتهما مفتاحًا واحدًا كانت تُسقط صفحة «حسابي» بخطأ غير متوقع.
  it('keeps the current user and the account summary in separate cache entries', () => {
    expect(queryKeys.account.summary).not.toEqual(queryKeys.account.me);
  });
});

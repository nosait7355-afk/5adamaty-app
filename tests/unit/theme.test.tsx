import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeSwitcher } from '@/components/common/theme-switcher';
import { THEME_SCRIPT, THEME_SCRIPT_HASH, THEME_STORAGE_KEY } from '@/shared/theme';

/**
 * المظهر: تلقائي / فاتح / داكن (المرحلة 5).
 */

let systemDark = false;

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  systemDark = false;
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('dark') ? systemDark : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const theme = () => document.documentElement.getAttribute('data-theme');

describe('سكربت المظهر في <head>', () => {
  it('🔒 بصمته في الـCSP تطابق نصّه — وإلا حجبه المتصفح بصمت', () => {
    const hash = createHash('sha256').update(THEME_SCRIPT).digest('base64');
    expect(hash).toBe(THEME_SCRIPT_HASH);
  });

  it('يقرأ نفس مفتاح التخزين الذي يكتبه مفتاح المظهر', () => {
    expect(THEME_SCRIPT).toContain(`'${THEME_STORAGE_KEY}'`);
  });

  it('«تلقائي» يتبع الهاتف، والاختيار اليدوي يغلبه', () => {
    const run = () => new Function(THEME_SCRIPT)();

    systemDark = true;
    run();
    expect(theme()).toBe('dark');

    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    run();
    expect(theme()).toBe('light');

    systemDark = false;
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    run();
    expect(theme()).toBe('dark');
  });
});

describe('ThemeSwitcher', () => {
  it('يبدأ على «تلقائي» ويطبّق الاختيار فورًا ويحفظه', async () => {
    render(<ThemeSwitcher />);
    expect(screen.getByRole('button', { name: 'تلقائي' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'داكن' }));
    expect(theme()).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(screen.getByRole('button', { name: 'داكن' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'فاتح' }));
    expect(theme()).toBe('light');
  });

  it('العودة إلى «تلقائي» تمسح الاختيار وتتبع الهاتف', async () => {
    systemDark = true;
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(<ThemeSwitcher />);

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'تلقائي' }));
    });
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(theme()).toBe('dark');
  });
});

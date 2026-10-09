import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// next/navigation ليس متاحًا خارج Next runtime
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/home',
  useSearchParams: () => new URLSearchParams(),
}));

/*
 * `ViewTransition` موجود في React canary الذي يشغّله Next.js داخليًا، لا في
 * React المستقر المثبّت (19.2) الذي تعمل به الاختبارات. البديل يرسم
 * الأبناء كما هم — الحركة نفسها شأن المتصفح لا الاختبار.
 */
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    ViewTransition:
      actual.ViewTransition ?? (({ children }: { children?: React.ReactNode }) => children),
  };
});

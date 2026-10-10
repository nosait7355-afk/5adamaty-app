import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryRail } from '@/components/features/discovery/category-rail';
import { PromoBanner } from '@/components/features/discovery/promo-banner';
import { ProviderMiniCard } from '@/components/features/discovery/provider-mini-card';
import { SearchLauncher } from '@/components/features/discovery/search-launcher';
import {
  addRecentSearch,
  clearRecentSearches,
  useRecentSearches,
} from '@/lib/recent-searches';
import type { CategoryDto } from '@/server/services/catalog.service';
import type { ProviderCardDto } from '@/server/services/discovery.service';

/**
 * المرحلة 4: الرئيسية الجديدة وشاشة البحث الكاملة.
 */

afterEach(() => {
  act(() => clearRecentSearches());
});

const category = (id: string, name: string, slug: string): CategoryDto => ({
  id,
  name,
  slug,
  description: '',
  icon: 'wrench',
  servicesCount: 3,
});

describe('CategoryRail — شريط التصنيفات الدائري', () => {
  it('يعرض كل التصنيفات بأسمائها ثم «كل التصنيفات»', () => {
    render(
      <CategoryRail
        categories={[
          category('c1', 'خدمات منزلية', 'home-services'),
          category('c2', 'خدمات طبية', 'medical'),
        ]}
      />
    );

    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'خدمات منزلية',
      'خدمات طبية',
      'كل التصنيفات',
    ]);
    expect(links[0]).toHaveAttribute('href', '/categories/home-services');
    expect(links[2]).toHaveAttribute('href', '/categories');
  });
});

describe('SearchLauncher', () => {
  it('رابط إلى شاشة البحث الكاملة لا حقل كتابة', () => {
    render(<SearchLauncher />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/search');
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });
});

describe('ProviderMiniCard — شارة التوثيق', () => {
  const provider: ProviderCardDto = {
    id: 'p1',
    displayName: 'محمود السيد',
    bio: '',
    categoryId: 'c1',
    professionId: 'pr1',
    coverageAreas: [],
    isVerifiedBadge: true,
    ratingAvg: 4.8,
    ratingCount: 12,
    completedOrders: 0,
  };

  it('تظهر للموثّق فقط', () => {
    const { rerender } = render(<ProviderMiniCard provider={provider} />);
    expect(screen.getByRole('img', { name: 'موثّق' })).toBeInTheDocument();

    rerender(<ProviderMiniCard provider={{ ...provider, isVerifiedBadge: false }} />);
    expect(screen.queryByRole('img', { name: 'موثّق' })).not.toBeInTheDocument();
  });
});

describe('عمليات البحث السابقة', () => {
  it('الأحدث أولًا، بلا تكرار، وبحد أقصى 8', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      for (const term of ['سبّاك', 'كهربائي', 'سبّاك']) addRecentSearch(term);
    });
    expect(result.current).toEqual(['سبّاك', 'كهربائي']);

    act(() => {
      for (let index = 0; index < 10; index += 1) addRecentSearch(`بحث ${index}`);
    });
    expect(result.current).toHaveLength(8);
    expect(result.current[0]).toBe('بحث 9');
  });

  it('يتجاهل البحث الفارغ، والمسح يفرغ القائمة والتخزين', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      addRecentSearch('   ');
      addRecentSearch('طبيب');
    });
    expect(result.current).toEqual(['طبيب']);
    expect(window.localStorage.getItem('khadamaty:recent-searches')).toContain('طبيب');

    act(() => clearRecentSearches());
    expect(result.current).toEqual([]);
    expect(window.localStorage.getItem('khadamaty:recent-searches')).toBeNull();
  });
});

describe('PromoBanner — بانر الرئيسية بالرسومات', () => {
  // jsdom بلا matchMedia — البانر يسأله عن «تقليل الحركة» قبل التبديل التلقائي
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const slides = [
    {
      title: 'كل خدمات الفيوم في مكان واحد',
      description: 'وصف',
      ctaLabel: 'تصفّح التصنيفات',
      href: '/categories',
      image: '/banners/all-services.svg',
      tone: 'brand' as const,
    },
    {
      title: 'التواصل والدفع مباشر',
      description: 'وصف',
      ctaLabel: 'اعرف أكثر',
      href: '/help',
      image: '/banners/direct-contact.svg',
      tone: 'success' as const,
    },
  ];

  it('كل شريحة برسمتها الزخرفية ولون خلفيتها', async () => {
    const { container } = render(<PromoBanner slides={slides} />);
    expect(container.querySelector('img')?.getAttribute('src')).toContain('/banners/all-services.svg');
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
    expect(container.querySelector('.bg-brand-50')).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'العرض 2' }));
    expect(container.querySelector('img')?.getAttribute('src')).toContain('/banners/direct-contact.svg');
    expect(container.querySelector('.bg-success-bg')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'اعرف أكثر' })).toHaveAttribute('href', '/help');
  });

  it('رسومات البانر موجودة في public', async () => {
    const { existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    for (const slide of slides) {
      expect(existsSync(join(process.cwd(), 'public', slide.image)), slide.image).toBe(true);
    }
  });
});

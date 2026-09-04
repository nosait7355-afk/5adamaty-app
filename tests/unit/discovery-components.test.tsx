import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceCard } from '@/components/features/discovery/service-card';
import { ProviderMiniCard } from '@/components/features/discovery/provider-mini-card';
import { FilterBar } from '@/components/features/discovery/filter-bar';
import { ProfileTabs } from '@/components/features/discovery/profile-tabs';
import { Rating } from '@/components/features/discovery/rating-stars';
import { SearchBox } from '@/components/features/discovery/search-box';
import { CategoryCard, ProfessionCard } from '@/components/features/discovery/category-cards';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import type { ProviderCardDto, ServiceCardDto } from '@/server/services/discovery.service';
import type { CategoryDto, ProfessionDto } from '@/server/services/catalog.service';

/** بيانات ثابتة مطابقة لأشكال الـDTO التي يعيدها الخادم. */
const service: ServiceCardDto = {
  id: 'svc1',
  title: 'تنظيف شقق وفلل',
  description: 'تنظيف شامل بمواد آمنة وفريق مدرّب.',
  priceFrom: 150,
  priceTo: 500,
  currency: 'EGP',
  areas: ['حي الجامعة', 'الحوّاتم'],
  area: 'حي الجامعة',
  ratingAvg: 4.8,
  ratingCount: 128,
  ordersCount: 40,
  categoryId: 'cat1',
  categoryName: 'خدمات منزلية',
  categorySlug: 'home-services',
  professionId: 'prof1',
  professionName: 'عامل نظافة',
  professionIcon: 'sparkles',
  provider: {
    id: 'prov1',
    displayName: 'شركة النقاء للتنظيف',
    ratingAvg: 4.8,
    ratingCount: 128,
    yearsOfExperience: 10,
    isVerifiedBadge: true,
  },
};

const provider: ProviderCardDto = {
  id: 'prov1',
  displayName: 'شركة النقاء للتنظيف',
  bio: 'تنظيف احترافي.',
  categoryId: 'cat1',
  categoryName: 'خدمات منزلية',
  categorySlug: 'home-services',
  professionId: 'prof1',
  professionName: 'عامل نظافة',
  professionIcon: 'sparkles',
  yearsOfExperience: 10,
  area: 'حي الجامعة',
  coverageAreas: ['حي الجامعة'],
  priceMode: 'RANGE',
  priceMin: 150,
  priceMax: 500,
  currency: 'EGP',
  isVerifiedBadge: true,
  ratingAvg: 4.8,
  ratingCount: 128,
  completedOrders: 540,
};

/* ================================================================== */

describe('ServiceCard (الصورة 09)', () => {
  it('يعرض كل عناصر البطاقة المرسومة', () => {
    render(<ServiceCard service={service} />);

    expect(screen.getByText('تنظيف شقق وفلل')).toBeInTheDocument();
    expect(screen.getByText('خدمات منزلية')).toBeInTheDocument();
    expect(screen.getByText(/تنظيف شامل/)).toBeInTheDocument();
    expect(screen.getByText('حي الجامعة')).toBeInTheDocument();
    expect(screen.getByText('بيدأ من 150 ج.م')).toBeInTheDocument();
    expect(screen.getByText('+10 سنوات خبرة')).toBeInTheDocument();
  });

  it('«عرض التفاصيل» رابط لا زر — يقود لملف مقدم الخدمة', () => {
    render(<ServiceCard service={service} />);
    const link = screen.getByRole('link', { name: 'عرض التفاصيل' });
    expect(link).toHaveAttribute('href', '/providers/prov1?serviceId=svc1');
  });

  it('لا يعرض زر المفضلة ما لم يُمرَّر معالجه', () => {
    const { rerender } = render(<ServiceCard service={service} />);
    expect(screen.queryByLabelText(/المفضلة/)).not.toBeInTheDocument();

    const onToggle = vi.fn();
    rerender(<ServiceCard service={service} onToggleFavorite={onToggle} />);
    expect(screen.getByLabelText('إضافة إلى المفضلة')).toBeInTheDocument();
  });

  it('زر المفضلة يبلّغ بمعرّف الخدمة ويعكس حالته', async () => {
    const onToggle = vi.fn();
    render(<ServiceCard service={service} onToggleFavorite={onToggle} isFavorite />);

    const button = screen.getByLabelText('إزالة من المفضلة');
    expect(button).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalledWith('svc1');
  });

  it('يعرض السعر بأرقام لاتينية داخل نص عربي', () => {
    render(<ServiceCard service={service} />);
    const price = screen.getByText('بيدأ من 150 ج.م');
    expect(price).toHaveClass('num');
    expect(price.textContent).not.toMatch(/[٠-٩]/);
  });
});

/* ================================================================== */

describe('ProviderMiniCard (الصورة 06)', () => {
  it('يعرض الاسم والمهنة والتقييم والمنطقة والتصنيف', () => {
    render(<ProviderMiniCard provider={provider} />);

    expect(screen.getByText('شركة النقاء للتنظيف')).toBeInTheDocument();
    expect(screen.getByText('عامل نظافة')).toBeInTheDocument();
    expect(screen.getByText('حي الجامعة')).toBeInTheDocument();
    expect(screen.getByText('خدمات منزلية')).toBeInTheDocument();
  });

  it('شارة التوثيق تظهر للمزوّد الموثّق فقط', () => {
    const { rerender } = render(<ProviderMiniCard provider={provider} />);
    expect(screen.getByLabelText('مقدم خدمة موثّق')).toBeInTheDocument();

    rerender(<ProviderMiniCard provider={{ ...provider, isVerifiedBadge: false }} />);
    expect(screen.queryByLabelText('مقدم خدمة موثّق')).not.toBeInTheDocument();
  });

  it('البطاقة كلها رابط لملف المزوّد', () => {
    render(<ProviderMiniCard provider={provider} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/providers/prov1');
  });
});

/* ================================================================== */

describe('FilterBar (الصورة 09)', () => {
  it('يعرض «كل المناطق» و«الترتيب» الافتراضيين', () => {
    render(<FilterBar value={{ sort: 'rating' }} onChange={vi.fn()} />);
    expect(screen.getByText('كل المناطق')).toBeInTheDocument();
    expect(screen.getByText('الأعلى تقييمًا')).toBeInTheDocument();
  });

  it('يفتح لوحة المنطقة ويبلّغ بالاختيار', async () => {
    const onChange = vi.fn();
    render(<FilterBar value={{ sort: 'rating' }} onChange={onChange} />);

    await userEvent.click(screen.getByText('كل المناطق'));
    expect(screen.getByText('المنطقة')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'دار الرماد' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ area: 'دار الرماد' }));
  });

  it('يبلّغ بنطاق السعر كحدّين رقميّين', async () => {
    const onChange = vi.fn();
    render(<FilterBar value={{ sort: 'rating' }} onChange={onChange} />);

    await userEvent.click(screen.getByText('السعر'));
    await userEvent.click(screen.getByRole('button', { name: '200 ج.م - 500 ج.م' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ priceMin: 200, priceMax: 500 })
    );
  });

  it('يبلّغ بتغيير الترتيب', async () => {
    const onChange = vi.fn();
    render(<FilterBar value={{ sort: 'rating' }} onChange={onChange} />);

    await userEvent.click(screen.getByText('الأعلى تقييمًا'));
    await userEvent.click(screen.getByRole('button', { name: 'الأقل سعرًا' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sort: 'price_asc' }));
  });

  it('زر التصفية معطّل بلا فلاتر ويعرض عددها عند وجودها', () => {
    const { rerender } = render(<FilterBar value={{ sort: 'rating' }} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /تصفية/ })).toBeDisabled();

    rerender(
      <FilterBar value={{ sort: 'rating', area: 'حي الجامعة', minRating: 4 }} onChange={vi.fn()} />
    );
    const reset = screen.getByRole('button', { name: /تصفية/ });
    expect(reset).toBeEnabled();
    expect(within(reset).getByText('(2)')).toBeInTheDocument();
  });

  it('زر التصفية يمسح كل الفلاتر ويعيد الترتيب الافتراضي', async () => {
    const onChange = vi.fn();
    render(
      <FilterBar
        value={{ sort: 'price_asc', area: 'حي الجامعة', minRating: 4, priceMin: 200 }}
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /تصفية/ }));
    expect(onChange).toHaveBeenCalledWith({
      area: undefined,
      priceMin: undefined,
      priceMax: undefined,
      minRating: undefined,
      sort: 'rating',
    });
  });

  it('لا يعرض أي خيار مسافة أو نصف قطر — المنطقة نصية فقط', async () => {
    render(<FilterBar value={{ sort: 'rating' }} onChange={vi.fn()} />);
    await userEvent.click(screen.getByText('كل المناطق'));

    expect(screen.queryByText(/كم|مسافة|الأقرب|نصف قطر/)).not.toBeInTheDocument();
  });
});

/* ================================================================== */

describe('ProfileTabs (الصورة 10)', () => {
  const tabs = [
    { key: 'about', label: 'نبذة' },
    { key: 'services', label: 'الخدمات', count: 2 },
    { key: 'reviews', label: 'التقييمات', count: 128 },
  ];

  it('يعلّم التبويب النشط لقارئ الشاشة', () => {
    render(<ProfileTabs tabs={tabs} active="services" onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /الخدمات/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'نبذة' })).toHaveAttribute('aria-selected', 'false');
  });

  it('يعرض العدّاد بصريًا ويعلنه بفاصل واضح لقارئ الشاشة', () => {
    render(<ProfileTabs tabs={tabs} active="about" onChange={vi.fn()} />);

    const reviewsTab = screen.getByRole('tab', { name: 'التقييمات، 128' });
    expect(reviewsTab).toHaveTextContent('التقييمات(128)');
    // تبويب بلا عدّاد يبقى باسمه المجرّد
    expect(screen.getByRole('tab', { name: 'نبذة' })).toBeInTheDocument();
  });

  it('يبلّغ بالتبويب المختار', async () => {
    const onChange = vi.fn();
    render(<ProfileTabs tabs={tabs} active="about" onChange={onChange} />);

    await userEvent.click(screen.getByRole('tab', { name: /التقييمات/ }));
    expect(onChange).toHaveBeenCalledWith('reviews');
  });
});

/* ================================================================== */

describe('Rating', () => {
  it('يعلن القيمة والعدد لقارئ الشاشة', () => {
    render(<Rating value={4.75} count={128} />);
    expect(screen.getByLabelText('4.8 من 5، 128 تقييم')).toBeInTheDocument();
  });

  it('يقرّب لخانة عشرية واحدة بأرقام لاتينية', () => {
    render(<Rating value={5} count={0} />);
    expect(screen.getByText('5.0')).toBeInTheDocument();
  });
});

/* ================================================================== */

describe('SearchBox', () => {
  it('يبلّغ بكل تغيير في النص', async () => {
    const onValueChange = vi.fn();
    render(<SearchBox value="" onValueChange={onValueChange} />);

    await userEvent.type(screen.getByLabelText('بحث'), 'س');
    expect(onValueChange).toHaveBeenCalledWith('س');
  });

  it('يُطلق onSubmit عند Enter', async () => {
    const onSubmit = vi.fn();
    render(<SearchBox value="سباك" onValueChange={vi.fn()} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('بحث'), '{Enter}');
    expect(onSubmit).toHaveBeenCalled();
  });

  it('زر المسح يظهر عند وجود نص فقط', async () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<SearchBox value="" onValueChange={onValueChange} />);
    expect(screen.queryByLabelText('مسح البحث')).not.toBeInTheDocument();

    rerender(<SearchBox value="سباك" onValueChange={onValueChange} />);
    await userEvent.click(screen.getByLabelText('مسح البحث'));
    expect(onValueChange).toHaveBeenCalledWith('');
  });
});

/* ================================================================== */

describe('بطاقات الكتالوج', () => {
  const category: CategoryDto = {
    id: 'cat1',
    name: 'خدمات منزلية',
    slug: 'home-services',
    description: 'تنظيف وصيانة وإصلاحات المنزل.',
    icon: 'home',
    servicesCount: 24,
  };

  const profession: ProfessionDto = {
    id: 'prof1',
    categoryId: 'cat1',
    name: 'سبّاك',
    slug: 'plumber',
    icon: 'wrench',
    servicesCount: 6,
    professionKind: 'CRAFT',
    requiresQualification: false,
    requiresLicense: false,
  };

  it('بطاقة التصنيف تعرض العدّاد بصيغة المعدود الصحيحة وتقود لمهنها', () => {
    render(<CategoryCard category={category} />);
    expect(screen.getByText('24 خدمة')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/categories/home-services');
  });

  it('بطاقة المهنة تقود لقائمة خدماتها بالـslugs', () => {
    render(<ProfessionCard profession={profession} categorySlug="plumbing-electric" />);
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/services?categorySlug=plumbing-electric&professionSlug=plumber'
    );
    expect(screen.getByText('6 خدمات')).toBeInTheDocument();
  });
});

/* ================================================================== */

describe('تحسين روابط Cloudinary', () => {
  const url = 'https://res.cloudinary.com/demo/image/upload/v1/khadamaty/services/abc.jpg';

  it('يحقن تحويلات المقاس والجودة بعد /upload/', () => {
    expect(cloudinaryUrl(url, { width: 120, height: 120 })).toBe(
      'https://res.cloudinary.com/demo/image/upload/c_fill,w_120,h_120,q_auto,f_auto,dpr_auto/v1/khadamaty/services/abc.jpg'
    );
  });

  it('يعمل بلا ارتفاع محدّد', () => {
    expect(cloudinaryUrl(url, { width: 300 })).toContain('c_fill,w_300,q_auto,f_auto,dpr_auto');
  });

  it('يعيد undefined عند غياب الرابط ولا يكسر رابطًا غير معروف', () => {
    expect(cloudinaryUrl(undefined, { width: 100 })).toBeUndefined();
    expect(cloudinaryUrl('https://example.com/a.png', { width: 100 })).toBe(
      'https://example.com/a.png'
    );
  });
});

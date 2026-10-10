import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CategoryArt, categoryArtSrc } from '@/components/common/category-art';

/**
 * صورة التصنيف: صورة الإدارة ← الرسمة الافتراضية ← الأيقونة.
 */

describe('categoryArtSrc', () => {
  it('صورة الإدارة تغلب الرسمة الافتراضية', () => {
    expect(
      categoryArtSrc({
        slug: 'home-services',
        image: 'https://res.cloudinary.com/x/image/upload/v1/a.png',
      })
    ).toBe('https://res.cloudinary.com/x/image/upload/v1/a.png');
  });

  it('التصنيفات الأساسية بلا صورة تأخذ رسمتها المضمّنة', () => {
    expect(categoryArtSrc({ slug: 'home-services' })).toBe('/categories/home-services.svg');
    expect(categoryArtSrc({ slug: 'delivery' })).toBe('/categories/delivery.svg');
  });

  it('تصنيف جديد بلا صورة ولا رسمة يرجع للأيقونة', () => {
    expect(categoryArtSrc({ slug: 'new-category' })).toBeNull();
  });
});

describe('CategoryArt', () => {
  it('يرسم الصورة زخرفيًا — الاسم مكتوب بجوارها', () => {
    const { container } = render(<CategoryArt category={{ slug: 'events', icon: 'party-popper' }} size={64} />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('alt', '');
    expect(img?.getAttribute('src')).toContain('/categories/events.svg');
  });

  it('بلا صورة يرسم الأيقونة كما كانت', () => {
    const { container } = render(<CategoryArt category={{ slug: 'new-category', icon: 'wrench' }} size={64} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

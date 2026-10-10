import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEED_CATEGORIES, SEED_PROFESSIONS } from '@/server/db/seed/data';
import { categoryArtSrc } from '@/components/common/category-art';
import { professionArtSrc } from '@/lib/profession-art';

/**
 * رسومات الكتالوج المضمّنة (public/categories و public/professions).
 *
 * الحارس الأهم: كل تصنيف وتخصص في بيانات البذر له رسمة موجودة فعلًا، وكل
 * رسمة يشير إليها الكود موجودة — وإلا ظهرت صورة مكسورة بدل الأيقونة.
 */

const PUBLIC = join(process.cwd(), 'public');

describe('رسومات التخصصات', () => {
  it('كل تخصص في بيانات البذر له رسمة، وملفها موجود', () => {
    for (const profession of SEED_PROFESSIONS) {
      const src = professionArtSrc(profession.slug);
      expect(src, profession.slug).toBe(`/professions/${profession.slug}.svg`);
      expect(existsSync(join(PUBLIC, src ?? '')), profession.slug).toBe(true);
    }
  });

  it('تخصص جديد بلا رسمة أو بلا slug يبقى على أيقونته', () => {
    expect(professionArtSrc('new-profession')).toBeUndefined();
    expect(professionArtSrc(undefined)).toBeUndefined();
  });
});

describe('رسومات التصنيفات', () => {
  it('كل تصنيف في بيانات البذر له رسمة، وملفها موجود', () => {
    for (const category of SEED_CATEGORIES) {
      const src = categoryArtSrc({ slug: category.slug });
      expect(src, category.slug).toBe(`/categories/${category.slug}.svg`);
      expect(existsSync(join(PUBLIC, src ?? '')), category.slug).toBe(true);
    }
  });
});

describe('ملفات الرسومات', () => {
  it('🔒 لا سكربت ولا روابط خارجية داخل أي SVG مضمّن', () => {
    const files = [
      ...SEED_PROFESSIONS.map((item) => `professions/${item.slug}.svg`),
      ...SEED_CATEGORIES.map((item) => `categories/${item.slug}.svg`),
      'categories/all.svg',
    ];
    for (const file of files) {
      const svg = readFileSync(join(PUBLIC, file), 'utf8');
      expect(svg, file).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 96 96"/);
      expect(svg, file).not.toMatch(/<script|on\w+=|href=|xlink:/i);
    }
  });
});

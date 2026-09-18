import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildAllIndexes, startTestDb, stopTestDb } from '../helpers/db';
import { runSeed } from '@/server/db/seed/seed';
import { Profession } from '@/server/db/models';
import { resetRateLimitStore } from '@/server/middleware/with-rate-limit';

import { GET as getCategories } from '@/app/api/v1/categories/route';
import { GET as getCategoryBySlug } from '@/app/api/v1/categories/[slug]/route';
import { GET as getProfessions } from '@/app/api/v1/professions/route';
import { GET as getDocRequirements } from '@/app/api/v1/professions/[id]/document-requirements/route';

beforeAll(async () => {
  await startTestDb();
  await buildAllIndexes();
  await runSeed();
}, 60_000);

afterAll(async () => {
  await stopTestDb();
});

afterEach(() => {
  // كل اختبار يبدأ بحد معدّل نظيف
  resetRateLimitStore();
});

/* ---- أدوات مساعدة ---- */

function req(path: string): Request {
  return new Request(`http://localhost:3000${path}`, {
    headers: { 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250) + 1}` },
  });
}

async function json(response: Response) {
  return (await response.json()) as {
    success: boolean;
    data?: unknown;
    meta?: { total?: number };
    error?: { code: string; message: string; fields?: Record<string, string> };
  };
}

/* ================================================================== */

describe('GET /api/v1/categories', () => {
  it('يعيد التصنيفات بالشكل الموحّد', async () => {
    const response = await getCategories(req('/api/v1/categories'), undefined);
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect((body.data as unknown[]).length).toBeGreaterThanOrEqual(9);
    expect(body.meta?.total).toBeGreaterThanOrEqual(9);
  });

  it('يضيف X-Request-Id لكل استجابة', async () => {
    const response = await getCategories(req('/api/v1/categories'), undefined);
    expect(response.headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('يعيد DTO نظيفًا بلا حقول داخلية', async () => {
    const response = await getCategories(req('/api/v1/categories'), undefined);
    const body = await json(response);
    const first = (body.data as Array<Record<string, unknown>>)[0]!;

    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('slug');
    // لا تُسرَّب حقول Mongoose الداخلية
    expect(first).not.toHaveProperty('_id');
    expect(first).not.toHaveProperty('__v');
    expect(first).not.toHaveProperty('isActive');
  });

  it('يرفض معاملات استعلام غير معرّفة (strict)', async () => {
    const response = await getCategories(req('/api/v1/categories?evil=1'), undefined);
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/categories/:slug', () => {
  const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });

  it('يعيد التصنيف ومهنه', async () => {
    const response = await getCategoryBySlug(
      req('/api/v1/categories/plumbing-electric'),
      ctx('plumbing-electric')
    );
    const body = await json(response);
    const data = body.data as { category: { slug: string }; professions: unknown[] };

    expect(response.status).toBe(200);
    expect(data.category.slug).toBe('plumbing-electric');
    expect(data.professions.length).toBeGreaterThan(0);
  });

  it('يعيد 404 لتصنيف غير موجود', async () => {
    const response = await getCategoryBySlug(req('/api/v1/categories/nope'), ctx('nope'));
    const body = await json(response);

    expect(response.status).toBe(404);
    expect(body.error?.code).toBe('NOT_FOUND');
    expect(body.error?.message).toContain('غير موجود');
  });

  it('يرفض slug غير صالح', async () => {
    const response = await getCategoryBySlug(
      req('/api/v1/categories/BAD_SLUG'),
      ctx('BAD_SLUG!!')
    );
    expect(response.status).toBe(400);
  });
});

describe('GET /api/v1/professions', () => {
  it('يعيد كل المهن', async () => {
    const response = await getProfessions(req('/api/v1/professions'), undefined);
    const body = await json(response);

    expect(response.status).toBe(200);
    expect((body.data as unknown[]).length).toBeGreaterThanOrEqual(14);
  });

  it('يفلتر بـcategorySlug', async () => {
    const response = await getProfessions(
      req('/api/v1/professions?categorySlug=medical-services'),
      undefined
    );
    const body = await json(response);
    const professions = body.data as Array<{ name: string }>;

    expect(professions.length).toBeGreaterThan(0);
    expect(professions.map((p) => p.name)).toContain('طبيب');
    expect(professions.map((p) => p.name)).not.toContain('سبّاك');
  });

  it('يرفض categoryId غير صالح', async () => {
    const response = await getProfessions(
      req('/api/v1/professions?categoryId=not-an-objectid'),
      undefined
    );
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.fields).toHaveProperty('categoryId');
  });
});

describe('GET /api/v1/professions/:id/document-requirements — المستندات الديناميكية', () => {
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  async function requirementsFor(slug: string) {
    const profession = await Profession.findOne({ slug }).lean();
    const response = await getDocRequirements(
      req(`/api/v1/professions/${String(profession!._id)}/document-requirements`),
      ctx(String(profession!._id))
    );
    const body = await json(response);
    return {
      response,
      data: body.data as {
        professionName: string;
        requiresQualification: boolean;
        requiresLicense: boolean;
        requirements: Array<{ key: string; required: boolean; label: string; maxSizeMB: number }>;
      },
    };
  }

  it('سبّاك (حرفية): مستندان، كلاهما إلزامي', async () => {
    const { response, data } = await requirementsFor('plumber');

    expect(response.status).toBe(200);
    expect(data.professionName).toBe('سبّاك');
    expect(data.requiresQualification).toBe(false);
    expect(data.requiresLicense).toBe(false);

    expect(data.requirements.map((r) => r.key)).toEqual(['NATIONAL_ID', 'PERSONAL_PHOTO']);
    // الهوية وحدها إلزامية في كل المهن
    expect(data.requirements.filter((r) => r.required).map((r) => r.key)).toEqual(['NATIONAL_ID']);
  });

  it('كهربائي (حرفية): نفس مستندات السبّاك', async () => {
    const { data } = await requirementsFor('electrician');
    expect(data.requirements.map((r) => r.key)).toEqual(['NATIONAL_ID', 'PERSONAL_PHOTO']);
  });

  it('طبيب (منظَّمة): 4 مستندات، الهوية وحدها إلزامية', async () => {
    const { data } = await requirementsFor('doctor');

    expect(data.requiresQualification).toBe(true);
    expect(data.requiresLicense).toBe(true);
    expect(data.requirements.map((r) => r.key)).toEqual(['NATIONAL_ID', 'PERSONAL_PHOTO']);
    expect(data.requirements.filter((r) => r.required).map((r) => r.key)).toEqual(['NATIONAL_ID']);
  });

  it('لا مؤهل ولا ترخيص في أي مهنة — حتى المنظَّمة منها', async () => {
    for (const slug of ['lawyer', 'doctor', 'private-tutor', 'plumber']) {
      const { data } = await requirementsFor(slug);
      const keys = data.requirements.map((r) => r.key);
      expect(keys, slug).not.toContain('PROFESSIONAL_CERT');
      expect(keys, slug).not.toContain('PRACTICE_LICENSE');
    }
  });

  it('مدرّس خصوصي: نفس القائمة — الأعلام لم تعد تُخفي مستندًا', async () => {
    const { data } = await requirementsFor('private-tutor');

    expect(data.requiresQualification).toBe(true);
    expect(data.requiresLicense).toBe(false);
    expect(data.requirements.map((r) => r.key)).toEqual(['NATIONAL_ID', 'PERSONAL_PHOTO']);
    expect(data.requirements.filter((r) => r.required).map((r) => r.key)).toEqual(['NATIONAL_ID']);
  });

  it('يعيد قيود الملفات مع كل مستند', async () => {
    const { data } = await requirementsFor('plumber');
    for (const requirement of data.requirements) {
      expect(requirement.maxSizeMB).toBe(3);
      expect(requirement.label.length).toBeGreaterThan(0);
    }
  });

  it('يعيد 404 لمهنة غير موجودة', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const response = await getDocRequirements(
      req(`/api/v1/professions/${fakeId}/document-requirements`),
      ctx(fakeId)
    );
    expect(response.status).toBe(404);
  });

  it('يرفض معرّفًا غير صالح', async () => {
    const response = await getDocRequirements(
      req('/api/v1/professions/abc/document-requirements'),
      ctx('abc')
    );
    expect(response.status).toBe(400);
  });
});

describe('تحديد المعدّل', () => {
  it('يعيد 429 بعد تجاوز حد القراءة', async () => {
    const ip = '10.9.9.9';
    const makeRequest = () =>
      new Request('http://localhost:3000/api/v1/categories', {
        headers: { 'x-forwarded-for': ip },
      });

    let lastStatus = 200;
    // الحد 120/دقيقة
    for (let i = 0; i < 125; i += 1) {
      const response = await getCategories(makeRequest(), undefined);
      lastStatus = response.status;
      if (lastStatus === 429) break;
    }

    expect(lastStatus).toBe(429);
  });
});

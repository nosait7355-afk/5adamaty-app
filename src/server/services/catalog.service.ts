import { notFound } from '@/server/lib/errors';
import {
  findCategories,
  findCategoryBySlug,
  findProfessionById,
  findProfessions,
  type CategoryLean,
  type ProfessionLean,
} from '@/server/repositories/catalog.repository';
import type { DocumentRequirement } from '@/shared/constants/documents';

/* ---- أشكال الإخراج للعميل (DTO) ---- */

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color?: string;
  servicesCount: number;
}

export interface ProfessionDto {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  icon: string;
  servicesCount: number;
  professionKind: string;
  requiresQualification: boolean;
  requiresLicense: boolean;
}

export interface DocumentRequirementDto {
  key: string;
  customKey?: string;
  label: string;
  description: string;
  required: boolean;
  order: number;
  accept: string[];
  maxSizeMB: number;
}

/* ---- المحوّلات ---- */

function toCategoryDto(doc: CategoryLean): CategoryDto {
  return {
    id: String(doc._id),
    name: doc.name,
    slug: doc.slug,
    description: doc.description,
    icon: doc.icon,
    ...(doc.color ? { color: doc.color } : {}),
    servicesCount: doc.servicesCount,
  };
}

function toProfessionDto(doc: ProfessionLean): ProfessionDto {
  return {
    id: String(doc._id),
    categoryId: String(doc.categoryId),
    name: doc.name,
    slug: doc.slug,
    icon: doc.icon,
    servicesCount: doc.servicesCount,
    professionKind: doc.professionKind,
    requiresQualification: doc.requiresQualification,
    requiresLicense: doc.requiresLicense,
  };
}

function toRequirementDto(req: DocumentRequirement): DocumentRequirementDto {
  return {
    key: req.key,
    ...(req.customKey ? { customKey: req.customKey } : {}),
    label: req.label,
    description: req.description,
    required: req.required,
    order: req.order,
    accept: req.accept,
    maxSizeMB: req.maxSizeMB,
  };
}

/* ---- الخدمات ---- */

export async function listCategories(includeInactive = false): Promise<CategoryDto[]> {
  const docs = await findCategories({ includeInactive });
  return docs.map(toCategoryDto);
}

export async function getCategoryBySlug(slug: string): Promise<CategoryDto> {
  const doc = await findCategoryBySlug(slug);
  if (!doc) throw notFound('التصنيف المطلوب غير موجود.');
  return toCategoryDto(doc);
}

export async function listProfessions(categoryId?: string): Promise<ProfessionDto[]> {
  const docs = await findProfessions({ categoryId });
  return docs.map(toProfessionDto);
}

/**
 * متطلبات المستندات لمهنة بعينها — المصدر الوحيد الذي تُبنى منه
 * شاشة المستندات (3/4). لا توجد أي قائمة ثابتة في الواجهة.
 *
 * المستندات غير النشطة تُستبعد، والترتيب يأتي من قاعدة البيانات.
 */
export async function getProfessionDocumentRequirements(professionId: string): Promise<{
  professionId: string;
  professionName: string;
  requiresQualification: boolean;
  requiresLicense: boolean;
  requirements: DocumentRequirementDto[];
}> {
  const profession = await findProfessionById(professionId);
  if (!profession) throw notFound('المهنة المطلوبة غير موجودة.');

  const requirements = profession.documentRequirements
    .filter((req) => req.isActive)
    .sort((a, b) => a.order - b.order)
    .map(toRequirementDto);

  return {
    professionId: String(profession._id),
    professionName: profession.name,
    requiresQualification: profession.requiresQualification,
    requiresLicense: profession.requiresLicense,
    requirements,
  };
}

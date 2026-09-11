import { conflict, forbidden, notFound } from '@/server/lib/errors';
import { findProviderByUserId } from '@/server/repositories/provider.repository';
import {
  countServicesByProvider,
  createProviderService,
  deleteProviderService,
  findProviderServiceById,
  findServicesByProvider,
  updateProviderService,
  type ServiceLean,
} from '@/server/repositories/provider-service.repository';
import type {
  CreateProviderServiceInput,
  UpdateProviderServiceInput,
} from '@/shared/schemas/provider.schema';
import { MAX_SERVICES_PER_PROVIDER } from '@/shared/schemas/provider.schema';

/**
 * إدارة «خدماتي» — القوائم التي يضيفها مقدم الخدمة لتظهر للعملاء في
 * صفحات الاكتشاف. الظهور الفعلي يبقى مشروطًا باعتماد الحساب
 * (`discovery.repository` يفرض `verification.status = APPROVED` منفصلًا)،
 * فمقدم الخدمة يقدر يبني قوائمه قبل الاعتماد وتظهر تلقائيًا بعد قبوله.
 */

export interface ServiceDto {
  id: string;
  title: string;
  description: string;
  priceFrom: number;
  priceTo?: number;
  currency: string;
  areas: string[];
  isActive: boolean;
  ordersCount: number;
  ratingAvg: number;
  ratingCount: number;
  createdAt: string;
}

export interface PagedServicesDto {
  items: ServiceDto[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

function toServiceDto(row: ServiceLean): ServiceDto {
  return {
    id: String(row._id),
    title: row.title,
    description: row.description,
    priceFrom: row.priceFrom,
    ...(row.priceTo != null ? { priceTo: row.priceTo } : {}),
    currency: row.currency,
    areas: row.areas ?? [],
    isActive: row.isActive,
    ordersCount: row.ordersCount,
    ratingAvg: row.ratingAvg,
    ratingCount: row.ratingCount,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

async function requireOwnProvider(userId: string) {
  const provider = await findProviderByUserId(userId);
  if (!provider) throw forbidden('لا يوجد ملف مقدّم خدمة مرتبط بحسابك.');
  return provider;
}

export async function listMyServices(
  userId: string,
  pagination: { page: number; limit: number }
): Promise<PagedServicesDto> {
  const provider = await requireOwnProvider(userId);
  const { items, total } = await findServicesByProvider(String(provider._id), pagination);

  return {
    items: items.map(toServiceDto),
    total,
    page: pagination.page,
    limit: pagination.limit,
    hasMore: pagination.page * pagination.limit < total,
  };
}

export async function createMyService(
  userId: string,
  input: CreateProviderServiceInput
): Promise<ServiceDto> {
  const provider = await requireOwnProvider(userId);

  const existing = await countServicesByProvider(String(provider._id));
  if (existing >= MAX_SERVICES_PER_PROVIDER) {
    throw conflict(`لا يمكن تجاوز ${MAX_SERVICES_PER_PROVIDER} خدمة لكل مزوّد.`);
  }

  const created = await createProviderService({
    providerId: String(provider._id),
    categoryId: String(provider.categoryId),
    professionId: String(provider.professionId),
    title: input.title,
    description: input.description,
    priceFrom: input.priceFrom,
    ...(input.priceTo != null ? { priceTo: input.priceTo } : {}),
    areas: input.areas,
    isActive: input.isActive,
  });

  return toServiceDto(created);
}

export async function updateMyService(
  userId: string,
  serviceId: string,
  patch: UpdateProviderServiceInput
): Promise<ServiceDto> {
  const provider = await requireOwnProvider(userId);

  const existing = await findProviderServiceById(String(provider._id), serviceId);
  if (!existing) throw notFound('الخدمة المطلوبة غير موجودة.');

  const updated = await updateProviderService(String(provider._id), serviceId, patch);
  if (!updated) throw notFound('الخدمة المطلوبة غير موجودة.');

  return toServiceDto(updated);
}

export async function deleteMyService(userId: string, serviceId: string): Promise<void> {
  const provider = await requireOwnProvider(userId);

  const deleted = await deleteProviderService(String(provider._id), serviceId);
  if (!deleted) throw notFound('الخدمة المطلوبة غير موجودة.');
}

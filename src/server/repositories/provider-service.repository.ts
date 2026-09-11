import { Types } from 'mongoose';
import { connectToDatabase } from '@/server/db/mongoose';
import { Service } from '@/server/db/models';
import type { ServiceDocument } from '@/server/db/models/service.model';

export type ServiceLean = Omit<ServiceDocument, '_id'> & { _id: Types.ObjectId };

/**
 * طبقة الوصول لخدمات مقدم الخدمة («خدماتي») — قوائم الخدمة المعروضة للعملاء
 * في صفحات الاكتشاف. كل دالة هنا تُقيَّد بـ`providerId` صاحب الجلسة، فلا
 * يمكن لمزوّد قراءة أو تعديل خدمة مزوّد آخر عبر تخمين المعرّف.
 */

export interface CreateServiceInput {
  providerId: string;
  categoryId: string;
  professionId: string;
  title: string;
  description: string;
  priceFrom: number;
  priceTo?: number;
  areas: string[];
  isActive: boolean;
}

export async function countServicesByProvider(providerId: string): Promise<number> {
  await connectToDatabase();
  return Service.countDocuments({ providerId: new Types.ObjectId(providerId) });
}

export async function findServicesByProvider(
  providerId: string,
  pagination: { page: number; limit: number }
): Promise<{ items: ServiceLean[]; total: number }> {
  await connectToDatabase();

  const filter = { providerId: new Types.ObjectId(providerId) };
  const [items, total] = await Promise.all([
    Service.find(filter)
      .sort({ createdAt: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .lean<ServiceLean[]>(),
    Service.countDocuments(filter),
  ]);

  return { items, total };
}

export async function findProviderServiceById(
  providerId: string,
  serviceId: string
): Promise<ServiceLean | null> {
  await connectToDatabase();
  return Service.findOne({
    _id: new Types.ObjectId(serviceId),
    providerId: new Types.ObjectId(providerId),
  }).lean<ServiceLean>();
}

export async function createProviderService(input: CreateServiceInput): Promise<ServiceLean> {
  await connectToDatabase();

  const created = await Service.create({
    providerId: new Types.ObjectId(input.providerId),
    categoryId: new Types.ObjectId(input.categoryId),
    professionId: new Types.ObjectId(input.professionId),
    title: input.title,
    description: input.description,
    priceFrom: input.priceFrom,
    ...(input.priceTo != null ? { priceTo: input.priceTo } : {}),
    areas: input.areas,
    isActive: input.isActive,
  });

  return created.toObject() as ServiceLean;
}

export async function updateProviderService(
  providerId: string,
  serviceId: string,
  patch: Partial<{
    title: string;
    description: string;
    priceFrom: number;
    priceTo: number | undefined;
    areas: string[];
    isActive: boolean;
  }>
): Promise<ServiceLean | null> {
  await connectToDatabase();

  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) set[key] = value;
  }
  if (Object.keys(set).length === 0) {
    return findProviderServiceById(providerId, serviceId);
  }

  return Service.findOneAndUpdate(
    { _id: new Types.ObjectId(serviceId), providerId: new Types.ObjectId(providerId) },
    { $set: set },
    { returnDocument: 'after' }
  ).lean<ServiceLean>();
}

export async function deleteProviderService(
  providerId: string,
  serviceId: string
): Promise<boolean> {
  await connectToDatabase();
  const result = await Service.deleteOne({
    _id: new Types.ObjectId(serviceId),
    providerId: new Types.ObjectId(providerId),
  });
  return result.deletedCount > 0;
}

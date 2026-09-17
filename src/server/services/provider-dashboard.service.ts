import { forbidden } from '@/server/lib/errors';
import { findProviderByUserId } from '@/server/repositories/provider.repository';
import { countServicesByProvider } from '@/server/repositories/provider-service.repository';
import type { SessionUser } from '@/server/middleware/with-auth';

/**
 * لوحة تحكم مقدم الخدمة — الصورة 24.
 *
 * التطبيق دليل اتصال مباشر بلا نظام طلبات، فالمؤشرات تُقرأ من الملف نفسه:
 * التقييم وعدد التقييمات وعدد الخدمات المعروضة. لا طلبات ولا أرباح.
 */
export interface ProviderDashboardDto {
  provider: {
    id: string;
    displayName: string;
    profileCompletion: number;
    isActive: boolean;
  };
  kpis: { rating: number; ratingCount: number; servicesCount: number };
}

export async function getProviderDashboard(user: SessionUser): Promise<ProviderDashboardDto> {
  const provider = await findProviderByUserId(user.id);
  if (!provider) throw forbidden('لا يوجد ملف مقدّم خدمة مرتبط بحسابك.');

  const providerId = String(provider._id);
  const servicesCount = await countServicesByProvider(providerId);

  return {
    provider: {
      id: providerId,
      displayName: provider.displayName,
      profileCompletion: provider.profileCompletion,
      isActive: provider.isActive,
    },
    kpis: {
      rating: provider.ratingAvg,
      ratingCount: provider.ratingCount,
      servicesCount,
    },
  };
}

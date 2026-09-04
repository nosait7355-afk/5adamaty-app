/**
 * النماذج الـ15 لقاعدة بيانات «خدماتي الفيوم» (ARCHITECTURE §3).
 *
 * ملاحظة عدّ: `messages/threads` تُحسب Collection واحدة منطقيًا (وحدة المراسلة)
 * وإن كانت مجموعتين فعليًا في MongoDB.
 *
 * تحقق سلبي إلزامي: لا توجد ولن توجد هنا أي مجموعة مالية
 * (payments/transactions/invoices/wallets) ولا أي حقل إحداثيات
 * (lat/lng/coordinates/GeoJSON) ولا فهرس 2dsphere.
 */

export { User, USER_PUBLIC_FIELDS, type UserDocument } from './user.model';
export { ServiceProvider, type ServiceProviderDocument } from './service-provider.model';
export { Category, type CategoryDocument } from './category.model';
export { Profession, type ProfessionDocument } from './profession.model';
export { Service, type ServiceDocument } from './service.model';
export { ServiceRequest, type ServiceRequestDocument } from './service-request.model';
export { ProviderDocument, type ProviderDocumentRecord } from './provider-document.model';
export { Review, type ReviewDocument } from './review.model';
export { Favorite, type FavoriteDocument } from './favorite.model';
export { Address, type AddressDocument } from './address.model';
export { Notification, type NotificationDocument } from './notification.model';
export { Thread, Message, type ThreadDocument, type MessageDocument } from './message.model';
export {
  Setting,
  AuditLog,
  Faq,
  AUDIT_ACTIONS,
  FAQ_TOPICS,
  FAQ_TOPIC_LABELS_AR,
  type SettingDocument,
  type AuditLogDocument,
  type FaqDocument,
  type AuditAction,
  type FaqTopic,
} from './misc.model';

export {
  mediaRefSchema,
  textAddressSchema,
  type MediaRef,
  type TextAddress,
} from './shared';

/** أسماء المجموعات الـ15 — تُستخدم في اختبارات التحقق وسكربت الفهارس. */
export const COLLECTION_NAMES = [
  'users',
  'serviceproviders',
  'categories',
  'professions',
  'services',
  'servicerequests',
  'providerdocuments',
  'reviews',
  'favorites',
  'addresses',
  'notifications',
  'threads', // وحدة المراسلة: threads + messages
  'settings',
  'auditlogs',
  'faqs',
] as const;

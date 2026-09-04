/**
 * أنواع الإشعارات — مستخرجة من شاشة الإشعارات (الصورة 15)
 * ومن أحداث دورة حياة الطلب والتوثيق.
 */
export const NOTIFICATION_TYPES = [
  // تسجيل مقدم الخدمة والتوثيق
  'PROVIDER_REGISTRATION_SUBMITTED',
  'PROVIDER_APPROVED',
  'PROVIDER_REJECTED',
  'PROVIDER_RESUBMISSION_REQUIRED',
  // دورة حياة الطلب
  'ORDER_CREATED',
  'ORDER_ACCEPTED',
  'ORDER_REJECTED',
  'ORDER_STATUS_CHANGED',
  'ORDER_COMPLETED',
  'ORDER_CANCELLED',
  // التقييمات والمراسلة
  'REVIEW_RECEIVED',
  'REVIEW_REMINDER',
  'MESSAGE_RECEIVED',
  // عام
  'PROMOTION',
  'SYSTEM',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** التبويبات الظاهرة في الصورة 15: الكل / طلباتي / العروض / التنبيهات / الرسائل. */
export const NOTIFICATION_TABS = ['ALL', 'ORDERS', 'PROMOTIONS', 'ALERTS', 'MESSAGES'] as const;
export type NotificationTab = (typeof NOTIFICATION_TABS)[number];

export const NOTIFICATION_TAB_LABELS_AR: Record<NotificationTab, string> = {
  ALL: 'الكل',
  ORDERS: 'طلباتي',
  PROMOTIONS: 'العروض',
  ALERTS: 'التنبيهات',
  MESSAGES: 'الرسائل',
};

/** تصنيف كل نوع إلى تبويبه. */
export const NOTIFICATION_TYPE_TAB: Record<NotificationType, Exclude<NotificationTab, 'ALL'>> = {
  PROVIDER_REGISTRATION_SUBMITTED: 'ALERTS',
  PROVIDER_APPROVED: 'ALERTS',
  PROVIDER_REJECTED: 'ALERTS',
  PROVIDER_RESUBMISSION_REQUIRED: 'ALERTS',
  ORDER_CREATED: 'ORDERS',
  ORDER_ACCEPTED: 'ORDERS',
  ORDER_REJECTED: 'ORDERS',
  ORDER_STATUS_CHANGED: 'ORDERS',
  ORDER_COMPLETED: 'ORDERS',
  ORDER_CANCELLED: 'ORDERS',
  REVIEW_RECEIVED: 'ALERTS',
  REVIEW_REMINDER: 'ALERTS',
  MESSAGE_RECEIVED: 'MESSAGES',
  PROMOTION: 'PROMOTIONS',
  SYSTEM: 'ALERTS',
};

/** الكيانات التي قد يشير إليها الإشعار. */
export const NOTIFICATION_ENTITY_TYPES = [
  'ORDER',
  'PROVIDER',
  'REVIEW',
  'MESSAGE',
  'SYSTEM',
] as const;
export type NotificationEntityType = (typeof NOTIFICATION_ENTITY_TYPES)[number];

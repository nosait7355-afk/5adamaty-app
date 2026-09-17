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

/**
 * تبويبات شاشة الإشعارات: الكل / المكالمات / الرسائل.
 *
 * التطبيق دليل اتصال مباشر، والمكالمات تتم خارج التطبيق ولا تُسجَّل — فتبويب
 * «المكالمات» لا يطابقه أي نوع حاليًا ويظهر فارغًا. أنواع الإشعارات الأخرى
 * (التوثيق، التقييمات، الإعلانات العامة) تظهر في «الكل» فقط.
 */
export const NOTIFICATION_TABS = ['ALL', 'CALLS', 'MESSAGES'] as const;
export type NotificationTab = (typeof NOTIFICATION_TABS)[number];

export const NOTIFICATION_TAB_LABELS_AR: Record<NotificationTab, string> = {
  ALL: 'الكل',
  CALLS: 'المكالمات',
  MESSAGES: 'الرسائل',
};

/** تصنيف كل نوع إلى تبويبه — `null` يعني «الكل» فقط. */
export const NOTIFICATION_TYPE_TAB: Record<NotificationType, Exclude<NotificationTab, 'ALL'> | null> = {
  PROVIDER_REGISTRATION_SUBMITTED: null,
  PROVIDER_APPROVED: null,
  PROVIDER_REJECTED: null,
  PROVIDER_RESUBMISSION_REQUIRED: null,
  ORDER_CREATED: null,
  ORDER_ACCEPTED: null,
  ORDER_REJECTED: null,
  ORDER_STATUS_CHANGED: null,
  ORDER_COMPLETED: null,
  ORDER_CANCELLED: null,
  REVIEW_RECEIVED: null,
  REVIEW_REMINDER: null,
  MESSAGE_RECEIVED: 'MESSAGES',
  PROMOTION: null,
  SYSTEM: null,
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

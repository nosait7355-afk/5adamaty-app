export const USER_ROLES = ['CUSTOMER', 'PROVIDER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED', 'PENDING_REVIEW', 'REJECTED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const VERIFICATION_STATUSES = [
  /**
   * طلب لم يُرسَل بعد: أُنشئ الحساب في الخطوة 2/4 ليصير رفع المستندات
   * ممكنًا، والمعالج لم يكتمل. لا يظهر في طابور مراجعة الإدارة ولا في أي
   * نتيجة بحث — ولا يُحسب طلبًا حتى يضغط المزوّد «إرسال طلب التسجيل».
   */
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'RESUBMISSION_REQUIRED',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const ROLE_LABELS_AR: Record<UserRole, string> = {
  CUSTOMER: 'مستخدم',
  PROVIDER: 'مقدم خدمة',
  ADMIN: 'مدير النظام',
};

export const VERIFICATION_LABELS_AR: Record<VerificationStatus, string> = {
  DRAFT: 'مسودة لم تُرسَل',
  PENDING_REVIEW: 'قيد المراجعة',
  APPROVED: 'معتمد',
  REJECTED: 'مرفوض',
  RESUBMISSION_REQUIRED: 'مطلوب إعادة إرسال',
};

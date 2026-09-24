/** أسباب الإبلاغ عن مقدم خدمة — القائمة الظاهرة في نافذة «إبلاغ». */
export const REPORT_REASONS = [
  'INAPPROPRIATE_CONTENT',
  'FAKE_PROFILE',
  'FRAUD',
  'HARASSMENT',
  'OTHER',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS_AR: Record<ReportReason, string> = {
  INAPPROPRIATE_CONTENT: 'صور أو محتوى غير لائق',
  FAKE_PROFILE: 'ملف مزيّف أو بيانات غير صحيحة',
  FRAUD: 'احتيال أو نصب',
  HARASSMENT: 'إساءة أو إزعاج',
  OTHER: 'سبب آخر',
};

export const REPORT_STATUSES = ['OPEN', 'RESOLVED', 'DISMISSED'] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_STATUS_LABELS_AR: Record<ReportStatus, string> = {
  OPEN: 'جديد',
  RESOLVED: 'تمت المعالجة',
  DISMISSED: 'مرفوض',
};

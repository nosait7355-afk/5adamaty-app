import { redirect } from 'next/navigation';

/**
 * لوحة تحكم مقدم الخدمة القديمة.
 *
 * دُمج محتواها (المؤشرات، اكتمال الملف) في أعلى صفحة `/provider/profile`
 * بعد أن صار تبويب "الرئيسية" في شريط تنقّل مقدم الخدمة يعرض تصفّح
 * الخدمات (نفس صفحة العميل) بدل لوحة القيادة. هذا التحويل يحمي أي رابط
 * أو مفضلة قديمة تشير إلى هذا المسار.
 */
export default function ProviderDashboardRedirect() {
  redirect('/provider/profile');
}

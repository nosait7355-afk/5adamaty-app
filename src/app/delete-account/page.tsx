import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalSection } from '@/components/features/legal/legal-page';
import { APP_NAME_AR, SUPPORT_EMAIL } from '@/shared/constants/legal';
import { NATIVE_APP_NAME_AR } from '@/shared/constants/native-app';

export const metadata: Metadata = { title: 'حذف الحساب' };

/**
 * حذف الحساب — صفحة عامة بلا تسجيل دخول. يطلبها Google Play (Data safety)
 * كرابط ويب يشرح طريقة الحذف ويتيح طلبه دون تثبيت التطبيق.
 *
 * جوجل تشترط أن تذكر الصفحة اسم التطبيق كما يظهر في المتجر — فتُذكر
 * «خدمات الفيوم» (الحساب الآخر) بجانب «خدماتي الفيوم».
 */
export default function DeleteAccountPage() {
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`طلب حذف حساب — ${APP_NAME_AR}`)}`;

  return (
    <LegalPage title="حذف الحساب">
      <p className="text-body leading-7 text-ink-700">
        هذه الصفحة لحذف حسابك في تطبيق «{NATIVE_APP_NAME_AR}» وموقع «{APP_NAME_AR}» — حساب واحد
        يُستخدم في الاثنين، وحذفه يحذف بياناتك منهما معًا.
      </p>
      <LegalSection title="1. من داخل التطبيق أو الموقع (فوري)">
        <ol className="list-inside list-decimal">
          <li>
            سجّل الدخول إلى تطبيق «{NATIVE_APP_NAME_AR}» أو موقع «{APP_NAME_AR}» (<Link href="/login" className="text-brand-600 underline">من هنا</Link>).
          </li>
          <li>
            افتح <strong>الإعدادات ← حذف الحساب</strong>.
          </li>
          <li>أدخل كلمة المرور للتأكيد (أو بريدك الإلكتروني إن كان حسابك عبر جوجل).</li>
        </ol>
      </LegalSection>

      <LegalSection title="2. بدون الدخول إلى التطبيق">
        <p>
          أرسل طلبًا إلى{' '}
          <a href={mailto} className="text-brand-600 underline">
            {SUPPORT_EMAIL}
          </a>{' '}
          من البريد الإلكتروني المسجّل به، مع رقم الهاتف المرتبط بالحساب. ننفّذ الطلب خلال 7 أيام
          بعد التحقق من ملكية الحساب.
        </p>
      </LegalSection>

      <LegalSection title="3. ما الذي يُحذف">
        <ul className="list-inside list-disc">
          <li>بيانات الحساب: الاسم، رقم الهاتف، البريد الإلكتروني، المدينة، وكلمة المرور.</li>
          <li>ملف مقدم الخدمة وصوره ومستنداته المرفوعة.</li>
          <li>الإشعارات والجلسات والبلاغات المرتبطة بالحساب.</li>
        </ul>
        <p>يتم الحذف نهائيًا ولا يمكن استرجاع الحساب بعده.</p>
        <p>
          تبقى سجلات الأمان (معرّف الحساب، نوع الإجراء، عنوان IP) حتى سنتين كحد أقصى لأغراض الأمان
          ومنع الاحتيال، ثم تُحذف تلقائيًا.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/features/legal/legal-page';
import { APP_NAME_AR } from '@/shared/constants/legal';

export const metadata: Metadata = { title: 'سياسة الخصوصية' };

/** سياسة الخصوصية — صفحة ثابتة عامة (مطلوبة لنشر التطبيق على Google Play). */
export default function PrivacyPage() {
  return (
    <LegalPage title="سياسة الخصوصية">
      <LegalSection title="1. البيانات التي نجمعها">
        <p>
          <strong>من كل المستخدمين:</strong> الاسم، رقم الهاتف، البريد الإلكتروني، المدينة، وكلمة
          المرور (مخزّنة مشفّرة ولا يمكن لأحد قراءتها).
        </p>
        <p>
          <strong>من مقدمي الخدمات إضافةً لذلك:</strong> رقم الواتساب، المهنة، الوصف، مناطق
          التغطية، الصور، والمستندات المرفوعة (الهوية الشخصية إلزامية، وباقي المستندات اختيارية).
        </p>
      </LegalSection>

      <LegalSection title="2. كيف نستخدم البيانات">
        <ul className="list-inside list-disc">
          <li>إنشاء الحساب وتسجيل الدخول.</li>
          <li>عرض ملف مقدم الخدمة للمستخدمين.</li>
          <li>تمكين التواصل المباشر مع مقدم الخدمة.</li>
          <li>إرسال إشعارات تخص حسابك.</li>
        </ul>
        <p>لا نبيع بياناتك ولا نشاركها مع أي جهة إعلانية.</p>
      </LegalSection>

      <LegalSection title="3. ما يظهر لغيرك">
        <ul className="list-inside list-disc">
          <li>
            <strong>يظهر للمستخدمين:</strong> اسم مقدم الخدمة، مهنته، وصفه، مناطق تغطيته، وصوره.
          </li>
          <li>
            <strong>أرقام التواصل:</strong> لا تُعرض نصًّا، وتُستخدم فقط لفتح الاتصال أو واتساب عند
            ضغط مستخدم مسجّل الدخول على الزر.
          </li>
          <li>
            <strong>لا يظهر لأحد:</strong> المستندات، البريد الإلكتروني، وكلمة المرور. المستندات
            محفوظة بوصول مقيّد ولا يطّلع عليها إلا فريق الإدارة عند الحاجة.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. تخزين البيانات وحمايتها">
        <p>
          تُخزَّن البيانات على خوادم مؤمّنة، وتُرفع الملفات إلى خدمة تخزين سحابية بوصول مقيّد
          للمستندات الحسّاسة. الاتصال بالتطبيق مشفّر.
        </p>
      </LegalSection>

      <LegalSection title="5. حقوقك وحذف الحساب">
        <p>
          يمكنك تعديل بياناتك من داخل التطبيق، وطلب حذف حسابك وكل بياناتك في أي وقت بمراسلتنا على
          البريد أدناه من البريد المسجّل في حسابك.
        </p>
      </LegalSection>

      <LegalSection title="6. الأطفال">
        <p>«{APP_NAME_AR}» غير موجّه لمن هم دون 18 عامًا.</p>
      </LegalSection>

      <LegalSection title="7. تعديل السياسة">
        <p>قد نحدّث هذه السياسة، وسيظهر تاريخ آخر تحديث أعلى الصفحة.</p>
      </LegalSection>
    </LegalPage>
  );
}

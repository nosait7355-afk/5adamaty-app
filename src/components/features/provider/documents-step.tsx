'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  BadgeCheck,
  GraduationCap,
  Home,
  IdCard,
  ScrollText,
  ShieldCheck,
  User,
} from 'lucide-react';
import { UploadCard, type UploadedFileInfo } from '@/components/common/upload-card';
import { InfoAlert } from '@/components/common/info-alert';
import { ErrorState } from '@/components/common/states';
import { Skeleton } from '@/components/ui/skeleton';
import { saveProviderDocument } from '@/lib/upload-client';
import { useDocumentRequirements } from '@/lib/queries/catalog';
import type { DocumentRequirementDto } from '@/server/services/catalog.service';

/**
 * خطوة المستندات (3/4) — الصورة 21.
 *
 * ⚠️ القاعدة المحورية: **لا توجد أي قائمة مستندات ثابتة في هذا الملف**.
 * عدد البطاقات وتسمياتها وأوصافها وترتيبها وحالة `required` كلها تأتي من
 * `GET /professions/:id/document-requirements`، ويحرّرها Admin من لوحة
 * التحكم بلا نشر كود (PROJECT_PLAN — قواعد المستندات الديناميكية).
 *
 * الثابت الوحيد هنا هو **الأيقونة** لكل مفتاح معروف — تحسين بصري لا أكثر،
 * وأي مفتاح غير معروف يأخذ الأيقونة الافتراضية.
 */

const REQUIREMENT_ICONS: Record<string, React.ReactNode> = {
  NATIONAL_ID: <IdCard size={22} />,
  PERSONAL_PHOTO: <User size={22} />,
  PROFESSIONAL_CERT: <GraduationCap size={22} />,
  PRACTICE_LICENSE: <BadgeCheck size={22} />,
  ADDRESS_PROOF: <Home size={22} />,
};

export interface DocumentsStepProps {
  professionId: string;
  /** يُستدعى عند تغيّر اكتمال المستندات الإلزامية — يتحكم بزر «التالي». */
  onCompletionChange?: (isComplete: boolean) => void;
  /**
   * إذا كان `false` نحفظ في الذاكرة فقط بلا استدعاء الـAPI.
   * يُستخدم أثناء التسجيل قبل إنشاء ملف المزوّد (Phase 6).
   */
  persist?: boolean;
  onDocumentsChange?: (documents: Record<string, UploadedFileInfo>) => void;
}

export function DocumentsStep({
  professionId,
  onCompletionChange,
  persist = true,
  onDocumentsChange,
}: DocumentsStepProps) {
  const query = useDocumentRequirements(professionId);
  const [uploaded, setUploaded] = useState<Record<string, UploadedFileInfo>>({});

  /*
   * `useMemo` ضروري لا تحسين: `?? []` ينتج مصفوفة جديدة كل رسم، فتتغيّر
   * اعتماديات الـhooks أدناه في كل مرة ويعاد بناء الدوال بلا داع.
   */
  const requirements = useMemo<DocumentRequirementDto[]>(
    () => query.data?.requirements ?? [],
    [query.data]
  );

  const keyOf = (requirement: DocumentRequirementDto) =>
    `${requirement.key}:${requirement.customKey ?? ''}`;

  const missingRequired = useMemo(
    () => requirements.filter((item) => item.required && !uploaded[keyOf(item)]),
    [requirements, uploaded]
  );

  const handleUploaded = useCallback(
    async (requirement: DocumentRequirementDto, asset: UploadedFileInfo) => {
      if (persist) {
        await saveProviderDocument({
          requirementKey: requirement.key,
          ...(requirement.customKey ? { customKey: requirement.customKey } : {}),
          publicId: asset.publicId,
        });
      }

      setUploaded((previous) => {
        const next = { ...previous, [keyOf(requirement)]: asset };
        onDocumentsChange?.(next);

        const stillMissing = requirements.filter(
          (item) => item.required && !next[keyOf(item)]
        );
        onCompletionChange?.(stillMissing.length === 0);
        return next;
      });
    },
    [persist, requirements, onCompletionChange, onDocumentsChange]
  );

  const handleRemove = useCallback(
    (requirement: DocumentRequirementDto) => {
      setUploaded((previous) => {
        const next = { ...previous };
        delete next[keyOf(requirement)];
        onDocumentsChange?.(next);
        onCompletionChange?.(false);
        return next;
      });
    },
    [onCompletionChange, onDocumentsChange]
  );

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-label="جاري تحميل المستندات المطلوبة">
        {[0, 1, 2].map((index) => (
          <div key={index} className="rounded-card border border-border bg-surface p-4">
            <div className="flex justify-between gap-3">
              <div className="flex-1">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="mt-2 h-4 w-full" />
              </div>
              <Skeleton className="h-20 w-[136px]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        message="تعذّر تحميل المستندات المطلوبة"
        description="تحقق من اتصالك ثم حاول مرة أخرى."
        onRetry={() => query.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ترويسة القسم — نص الصورة 21 حرفيًا */}
      <div className="flex items-start gap-2">
        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
        <div>
          <h3 className="text-section font-bold text-ink-900">المستندات المطلوبة</h3>
          <p className="text-meta text-ink-400">
            جميع المستندات آمنة ولن يتم مشاركتها مع أي جهة أخرى
          </p>
        </div>
      </div>

      {/* البطاقات — مبنية بالكامل من قاعدة البيانات */}
      <div className="flex flex-col gap-3">
        {requirements.map((requirement) => (
          <UploadCard
            key={keyOf(requirement)}
            icon={REQUIREMENT_ICONS[requirement.key] ?? <ScrollText size={22} />}
            label={requirement.label}
            description={requirement.description}
            required={requirement.required}
            accept={requirement.accept}
            maxSizeMB={requirement.maxSizeMB}
            purpose="PROVIDER_DOCUMENT"
            onUploaded={(asset) => handleUploaded(requirement, asset)}
            onRemove={() => handleRemove(requirement)}
          />
        ))}
      </div>

      <InfoAlert tone="info">
        سيتم مراجعة مستنداتك خلال 24 ساعة عمل، وستصلك إشعارة بنتيجة المراجعة.
      </InfoAlert>

      {missingRequired.length > 0 && (
        <InfoAlert tone="warning" title="مستندات إلزامية ناقصة">
          {missingRequired.map((item) => item.label).join(' · ')}
        </InfoAlert>
      )}
    </div>
  );
}

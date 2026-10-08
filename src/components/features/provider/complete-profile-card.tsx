'use client';

import { CheckCircle2, ChevronLeft, Circle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';

export interface CompletionTask {
  key: string;
  label: string;
  /** معرّف الحقل الذي تقفز إليه المهمة. */
  targetId: string;
  done: boolean;
}

/**
 * مهام «كمّل ملفك» — نفس بنود `computeProfileCompletion` على الخادم التي
 * يستطيع المزوّد إكمالها من «ملفي»، فالقائمة والنسبة لا تتناقضان.
 */
export function buildCompletionTasks(profile: {
  bio: string;
  yearsOfExperience?: number;
  coverageAreas: string[];
  portfolio: unknown[];
  user: { addressLine?: string };
}): CompletionTask[] {
  return [
    {
      key: 'bio',
      label: 'اكتب وصف خدماتك',
      targetId: PROFILE_FIELD_IDS.bio,
      done: profile.bio.trim().length > 0,
    },
    {
      key: 'portfolio',
      label: 'أضف صورًا من أعمالك',
      targetId: PROFILE_FIELD_IDS.portfolio,
      done: profile.portfolio.length > 0,
    },
    {
      key: 'years',
      label: 'سنوات الخبرة',
      targetId: PROFILE_FIELD_IDS.years,
      done: profile.yearsOfExperience != null,
    },
    {
      key: 'address',
      label: 'العنوان التفصيلي',
      targetId: PROFILE_FIELD_IDS.address,
      done: Boolean(profile.user.addressLine),
    },
    {
      key: 'coverage',
      label: 'المناطق التي تغطيها',
      targetId: PROFILE_FIELD_IDS.coverage,
      done: profile.coverageAreas.length > 0,
    },
  ];
}

/** معرّفات ثابتة لحقول «ملفي» التي تقفز إليها المهام. */
export const PROFILE_FIELD_IDS = {
  bio: 'profile-bio',
  years: 'profile-years',
  address: 'profile-address',
  portfolio: 'profile-portfolio',
  coverage: 'profile-coverage',
} as const;

function jumpTo(targetId: string) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // الحقول النصية تُفتح للكتابة مباشرة؛ الأقسام (المعرض والمناطق) يكفي الوصول إليها
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    target.focus({ preventScroll: true });
  }
}

/** بطاقة «كمّل ملفك» — حلقة النسبة وقائمة بما ينقص، كل بند يقفز لحقله. */
export function CompleteProfileCard({
  completion,
  tasks,
}: {
  completion: number;
  tasks: CompletionTask[];
}) {
  const remaining = tasks.filter((task) => !task.done);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <CompletionRing value={completion} />
        <div className="min-w-0 flex-1">
          <h3 className="text-card-title font-bold text-ink-900">
            {remaining.length === 0 ? 'ملفك مكتمل' : 'كمّل ملفك'}
          </h3>
          <p className="text-meta text-ink-400">
            {remaining.length === 0
              ? 'أحسنت — ملفك يظهر للعملاء بكل تفاصيله.'
              : 'الملف المكتمل يظهر أعلى في البحث ويطمئن العميل قبل الاتصال.'}
          </p>
        </div>
      </div>

      {remaining.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-field border border-border">
          {tasks.map((task) => (
            <li key={task.key}>
              <button
                type="button"
                disabled={task.done}
                onClick={() => jumpTo(task.targetId)}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-3 text-start text-label',
                  task.done
                    ? 'cursor-default text-ink-400'
                    : 'font-semibold text-ink-900 transition-colors hover:bg-brand-50'
                )}
              >
                {task.done ? (
                  <CheckCircle2 size={20} className="shrink-0 text-success" aria-hidden="true" />
                ) : (
                  <Circle size={20} className="shrink-0 text-ink-300" aria-hidden="true" />
                )}
                <span className={cn('flex-1', task.done && 'line-through')}>{task.label}</span>
                {!task.done && (
                  <ChevronLeft size={18} className="shrink-0 text-brand-600" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** حلقة نسبة الاكتمال — الصورة 24. */
function CompletionRing({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      className="relative flex size-16 shrink-0 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(var(--color-brand-600) ${clamped * 3.6}deg, var(--color-border) 0deg)`,
      }}
      role="img"
      aria-label={`اكتمال الملف ${clamped}%`}
    >
      <span className="num flex size-12 items-center justify-center rounded-full bg-surface text-label font-extrabold text-brand-600">
        {clamped}%
      </span>
    </div>
  );
}

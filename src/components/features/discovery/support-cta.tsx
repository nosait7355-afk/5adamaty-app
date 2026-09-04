import { Headset } from 'lucide-react';
import { LinkButton } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export interface SupportCtaProps {
  className?: string;
}

/**
 * بطاقة الدعم — الصور 06، 13، 18.
 * رسم دعم + نص + زر «تواصل معنا» يقود لمركز المساعدة (يُبنى في Phase 9).
 */
export function SupportCta({ className }: SupportCtaProps) {
  return (
    <section
      className={cn(
        'flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-card',
        className
      )}
    >
      <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Headset size={28} strokeWidth={1.75} aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <h3 className="text-card-title font-bold text-ink-900">تحتاج مساعدة؟</h3>
        <p className="text-meta text-ink-400">فريق الدعم جاهز للرد على استفساراتك.</p>
      </div>

      <LinkButton href="/help" size="sm" variant="secondary">
        تواصل معنا
      </LinkButton>
    </section>
  );
}

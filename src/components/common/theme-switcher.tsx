'use client';

import type { ReactNode } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/native';
import { setThemeChoice, useThemeChoice } from '@/lib/theme';
import type { ThemeChoice } from '@/shared/theme';

const OPTIONS: { value: ThemeChoice; label: string; icon: ReactNode }[] = [
  { value: 'system', label: 'تلقائي', icon: <Monitor size={18} /> },
  { value: 'light', label: 'فاتح', icon: <Sun size={18} /> },
  { value: 'dark', label: 'داكن', icon: <Moon size={18} /> },
];

/**
 * «المظهر» في حسابي — أزرار مجزّأة: تلقائي (يتبع الهاتف) · فاتح · داكن.
 * التغيير فوري بلا حفظ ولا إعادة تحميل، ويبقى على هذا الجهاز.
 */
export function ThemeSwitcher({ className }: { className?: string }) {
  const choice = useThemeChoice();

  return (
    <fieldset className={cn('flex flex-col gap-3', className)}>
      <legend className="mb-3 flex w-full items-center justify-between gap-2">
        <span className="text-label font-bold text-ink-900">المظهر</span>
        {choice === 'system' && (
          <span className="text-badge text-ink-400">يتبع إعداد الهاتف</span>
        )}
      </legend>

      <div className="grid grid-cols-3 gap-1 rounded-field bg-bg p-1">
        {OPTIONS.map((option) => {
          const selected = option.value === choice;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                if (selected) return;
                void haptic('light');
                setThemeChoice(option.value);
              }}
              className={cn(
                'pressable flex items-center justify-center gap-1.5 rounded-[0.6rem] py-2.5 text-label font-semibold',
                selected ? 'bg-surface font-extrabold text-ink-900 shadow-card' : 'text-ink-600'
              )}
            >
              <span aria-hidden="true">{option.icon}</span>
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

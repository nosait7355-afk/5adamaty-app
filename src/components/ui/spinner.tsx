import { cn } from '@/lib/cn';

export interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

/** مؤشر التحميل الدائري — كما في شاشة Splash (الصورة 01). */
export function Spinner({ size = 24, className, label = 'جاري التحميل' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 10)) }}
      className={cn(
        'inline-block animate-spin-slow rounded-full border-current border-t-transparent align-middle',
        className
      )}
    />
  );
}

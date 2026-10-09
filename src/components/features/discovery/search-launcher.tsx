import Link from 'next/link';
import { Search } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * زر بشكل حقل بحث يفتح شاشة البحث الكاملة (`/search`) — نمط تطبيقات
 * التوصيل والخرائط: الكتابة تحدث في شاشة مخصّصة فيها الاقتراحات وعمليات
 * البحث السابقة، لا في حقل صغير وسط الرئيسية تغطّيه لوحة المفاتيح.
 */
export function SearchLauncher({
  placeholder = 'سبّاك، كهربائي، طبيب…',
  className,
}: {
  placeholder?: string;
  className?: string;
}) {
  return (
    <Link
      href="/search"
      className={cn(
        'pressable flex h-12 items-center gap-2.5 rounded-pill bg-bg px-4 text-body text-ink-400',
        'ring-1 ring-border',
        className
      )}
    >
      <Search size={20} className="shrink-0 text-ink-600" aria-hidden="true" />
      <span className="line-clamp-1">ابحث: {placeholder}</span>
    </Link>
  );
}

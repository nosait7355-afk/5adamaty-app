'use client';

import { ViewTransition, useEffect, useRef, type ReactNode } from 'react';
import { usePageTitleStore } from '@/lib/page-title';
import { cn } from '@/lib/cn';

export interface PageContainerProps {
  children: ReactNode;
  /** يضيف حشوًا سفليًا يساوي ارتفاع Bottom Nav حتى لا يغطّي آخر عنصر. */
  withBottomNav?: boolean;
  className?: string;
}

/**
 * حاوية الصفحة.
 *
 * Mobile-first: العرض الأقصى 520px ومتمركزة — على الشاشات الأكبر (تابلت/ويب)
 * تبقى بعمود واحد كما في التصميم، بلا أي تخطيط سطح مكتب.
 */
export function PageContainer({ children, withBottomNav = true, className }: PageContainerProps) {
  return (
    /*
     * حركة الانتقال بين الشاشات (المرحلة 3) — هنا لا في التخطيط: التخطيط
     * يبقى ثابتًا عبر التنقّل فلا يدخل ولا يخرج، أما محتوى الصفحة فيُركَّب
     * من جديد مع كل صفحة. الترويسة وشريط التنقّل خارج هذه الحاوية ومثبّتان
     * بـ`view-transition-name` (انظر globals.css)، فينزلق المحتوى وحده.
     *
     * `nav-forward` — رابط يتعمّق (بطاقة خدمة، تصنيف): انزلاق أفقي.
     * بلا نوع — الرجوع (المتصفح لا يحمل نوعًا للرجوع) وتبديل التبويبات:
     * تلاشٍ قصير بلا اتجاه، نمط «fade through» في Material.
     */
    <ViewTransition
      enter={{ 'nav-forward': 'nav-forward', default: 'fade-through' }}
      exit={{ 'nav-forward': 'nav-forward', default: 'fade-through' }}
      default="none"
    >
      <div
        className={cn(
          'mx-auto w-full max-w-[520px] px-page',
          withBottomNav && 'pb-[calc(var(--spacing-nav)+env(safe-area-inset-bottom,0px)+1rem)]',
          className
        )}
      >
        {children}
      </div>
    </ViewTransition>
  );
}

export interface PageTitleProps {
  title: string;
  subtitle?: string;
  className?: string;
}

/**
 * عنوان الشاشة الوسطي — 28px/800 مع وصف رمادي تحته.
 * نمط ثابت في الصور 07، 08، 09، 13، 15، 17، 18، 19–23، 25.
 */
export function PageTitle({ title, subtitle, className }: PageTitleProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const setPageTitle = usePageTitleStore((state) => state.set);

  /*
   * يسجّل العنوان للترويسة ويراقب ظهوره: حين يمرّ تحت الترويسة (هامش
   * علوي بارتفاعها التقريبي) تعرضه الترويسة صغيرًا. يُمسح عند مغادرة الصفحة
   * كي لا يظهر عنوانها في ترويسة الصفحة التالية.
   */
  useEffect(() => {
    setPageTitle({ title, visible: true });

    // المسح عند المغادرة لازم حتى بلا مراقب — وإلا بقي العنوان عالقًا
    const node = ref.current;
    const observer =
      node && typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            ([entry]) => setPageTitle({ visible: Boolean(entry?.isIntersecting) }),
            { rootMargin: '-64px 0px 0px 0px' }
          )
        : null;
    if (node) observer?.observe(node);

    return () => {
      observer?.disconnect();
      setPageTitle({ title: null, visible: true });
    };
  }, [title, setPageTitle]);

  return (
    <div className={cn('py-4 text-center', className)}>
      <h1 ref={ref} className="text-screen-title font-extrabold text-ink-900">
        {title}
      </h1>
      {subtitle && <p className="mt-1 text-body text-ink-400">{subtitle}</p>}
    </div>
  );
}

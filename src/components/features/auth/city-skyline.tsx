import { cn } from '@/lib/cn';

/**
 * رسم خطّي لمعالم الفيوم — يظهر أسفل شاشات Splash والدخول والتسجيل
 * (الصور 01، 03، 05) وخلف ترويسة اختيار نوع الحساب (الصورة 02).
 *
 * العناصر المرصودة في التصميم: نخيل · مبانٍ · برج ساعة · مسجد بقبة ومئذنة ·
 * قوارب شراعية · جسر · سحب وطيور. كله بلون `--brand-100` بخطوط رفيعة.
 *
 * زخرفي بحت: `aria-hidden` ولا يحمل أي معنى وظيفي.
 */
export function CitySkyline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 200"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="xMidYMax meet"
      className={cn('w-full text-brand-100', className)}
    >
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {/* سحب */}
        <path d="M90 34c6-10 20-10 26-2 5-7 16-6 19 2 7 0 11 5 11 9H84c0-5 3-9 6-9Z" />
        <path d="M604 28c5-9 18-9 23-2 5-6 14-5 17 2 6 0 10 4 10 8h-59c0-4 3-8 9-8Z" />
        {/* طيور */}
        <path d="M244 40c3-4 6-4 8 0M256 36c3-4 6-4 8 0" />
        <path d="M540 48c3-4 6-4 8 0M552 44c3-4 6-4 8 0" />

        {/* نخلة يمين */}
        <path d="M760 168V116" />
        <path d="M760 116c-12-12-26-14-34-8 10-2 22 2 30 10M760 116c12-12 26-14 34-8-10-2-22 2-30 10M760 114c-4-14-2-26 6-32-4 10-4 22-2 30M760 114c4-14 2-26-6-32 4 10 4 22 2 30" />

        {/* مبانٍ يمين */}
        <path d="M660 168v-58h56v58" />
        <path d="M672 122h10v10h-10zM694 122h10v10h-10zM672 142h10v10h-10zM694 142h10v10h-10z" />

        {/* المسجد — قبة ومئذنة */}
        <path d="M540 168v-52h84v52" />
        <path d="M582 116c-16 0-26-12-26-24 0-14 12-24 26-24s26 10 26 24c0 12-10 24-26 24Z" />
        <path d="M582 68V56M578 56h8" />
        <path d="M630 168V86h14v82" />
        <path d="M637 86V70M632 70h10M637 70V60" />
        <path d="M556 168v-26a26 26 0 0 1 52 0v26" />
        <path d="M566 152h10v16h-10zM588 152h10v16h-10z" />

        {/* برج الساعة — العلامة الأبرز في الفيوم */}
        <path d="M386 168V64h28v104" />
        <path d="M382 64h36" />
        <path d="M400 44v20M394 44h12" />
        <path d="M386 44l14-16 14 16" />
        <circle cx="400" cy="86" r="10" />
        <path d="M400 80v6l4 3" />
        <path d="M390 110h20M390 128h20M390 146h20" />

        {/* مبانٍ وسط */}
        <path d="M300 168v-64h62v64" />
        <path d="M312 116h12v14h-12zM338 116h12v14h-12zM312 140h12v14h-12zM338 140h12v14h-12z" />
        <path d="M300 104l31-16 31 16" />

        {/* مبانٍ يسار */}
        <path d="M150 168V96h58v72" />
        <path d="M162 110h12v12h-12zM186 110h12v12h-12zM162 132h12v12h-12zM186 132h12v12h-12z" />
        <path d="M226 168v-50h48v50" />
        <path d="M238 130h10v12h-10zM254 130h10v12h-10z" />

        {/* نخلة يسار */}
        <path d="M52 168V118" />
        <path d="M52 118c-12-12-26-14-34-8 10-2 22 2 30 10M52 118c12-12 26-14 34-8-10-2-22 2-30 10M52 116c-4-14-2-26 6-32-4 10-4 22-2 30M52 116c4-14 2-26-6-32 4 10 4 22 2 30" />

        {/* الجسر */}
        <path d="M690 168h110" />
        <path d="M700 168v-14M724 168v-14M748 168v-14M772 168v-14" />
        <path d="M690 154h110" />

        {/* خط الماء */}
        <path d="M0 168h800" strokeWidth="2" />

        {/* قارب شراعي كبير */}
        <path d="M452 168V102" />
        <path d="M452 104c22 10 34 30 36 50h-36" />
        <path d="M452 112c-16 8-26 22-28 42h28" />
        <path d="M432 178h48l-8 10h-32z" />

        {/* قارب صغير */}
        <path d="M112 176v-30" />
        <path d="M112 148c12 6 18 16 20 28h-20" />
        <path d="M98 178h34l-6 8h-22z" />

        {/* تموّجات الماء */}
        <path d="M180 184c8-5 16-5 24 0s16 5 24 0M560 186c8-5 16-5 24 0s16 5 24 0M300 190c8-5 16-5 24 0s16 5 24 0" />
      </g>
    </svg>
  );
}

/**
 * الموجة الزرقاء — تظهر أعلى وأسفل شاشتَي Splash واختيار نوع الحساب
 * (الصورتان 01 و02).
 */
export function BrandWave({
  position = 'bottom',
  className,
}: {
  position?: 'top' | 'bottom';
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 400 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn('w-full', position === 'top' && 'rotate-180', className)}
    >
      <path d="M0 60C60 20 140 96 220 62S340 22 400 44v56H0Z" className="fill-brand-500/25" />
      <path d="M0 74C70 40 150 100 230 74S350 44 400 62v38H0Z" className="fill-brand-600" />
    </svg>
  );
}

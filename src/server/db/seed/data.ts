import { buildDocumentRequirements, type DocumentRequirement } from '@/shared/constants/documents';

/**
 * بيانات البذر — مستخرجة من الصور المرجعية 06، 07، 08، 09.
 * كل المناطق نصية من محافظة الفيوم — لا إحداثيات (ARCHITECTURE §0.2).
 */

export interface SeedCategory {
  name: string;
  slug: string;
  description: string;
  icon: string;
  order: number;
}

/** التصنيفات الرئيسية التسعة — الصورة 08. */
export const SEED_CATEGORIES: SeedCategory[] = [
  {
    name: 'خدمات منزلية',
    slug: 'home-services',
    description: 'تنظيف، صيانة، مكافحة حشرات وعمالة منزلية',
    icon: 'home',
    order: 1,
  },
  {
    name: 'خدمات طبية',
    slug: 'medical-services',
    description: 'أطباء، تمريض، تحاليل وزيارات منزلية',
    icon: 'stethoscope',
    order: 2,
  },
  {
    name: 'خدمات قانونية',
    slug: 'legal-services',
    description: 'محاماة، استشارات، توثيق وشؤون قانونية',
    icon: 'scale',
    order: 3,
  },
  {
    name: 'خدمات سيارات',
    slug: 'car-services',
    description: 'صيانة، كهرباء، غسيل ونقل سيارات',
    icon: 'car',
    order: 4,
  },
  {
    name: 'خدمات تقنية',
    slug: 'tech-services',
    description: 'كمبيوتر، موبايلات، شبكات وبرمجة',
    icon: 'laptop',
    order: 5,
  },
  {
    /*
     * كان اسمه «سباكة وكهرباء» ويضمّ مهنتين فقط، بينما النجّار والنقّاش
     * متفرّقان في «خدمات منزلية». جُمعت المهن الحرفية الأربع هنا بقرار
     * منتج: العميل يبحث عن «حرفي» لا عن تصنيف إداري. الـslug لم يتغيّر
     * كي لا تنكسر الروابط ولا صفوف قاعدة البيانات المرتبطة به.
     */
    name: 'مهن حرفية',
    slug: 'plumbing-electric',
    description: 'سباك، كهربائي، نقاش ونجار',
    icon: 'wrench',
    order: 6,
  },
  {
    name: 'جمال وعناية',
    slug: 'beauty-care',
    description: 'صالونات، مكياج، عناية بالبشرة والشعر',
    icon: 'scissors',
    order: 7,
  },
  {
    name: 'تعليم وتدريب',
    slug: 'education-training',
    description: 'دروس خصوصية، لغات وتدريب مهني',
    icon: 'graduation-cap',
    order: 8,
  },
  {
    name: 'مناسبات وفعاليات',
    slug: 'events',
    description: 'تنظيم حفلات، ديكورات، تصوير وصوتيات',
    icon: 'party-popper',
    order: 9,
  },
  {
    name: 'عقارات',
    slug: 'real-estate',
    description: 'تسويق عقاري، وساطة وبيع وإيجار',
    icon: 'building-2',
    order: 10,
  },
  {
    name: 'توصيل',
    slug: 'delivery',
    description: 'دليفري وتوصيل طلبات وطرود داخل الفيوم',
    icon: 'package',
    order: 11,
  },
];

export interface SeedProfession {
  categorySlug: string;
  name: string;
  slug: string;
  icon: string;
  professionKind: 'CRAFT' | 'REGULATED';
  requiresQualification: boolean;
  requiresLicense: boolean;
  order: number;
}

/**
 * المهن — الصورة 07، موزّعة على القالبين.
 *
 * الحرفية:  بطاقة (Required) + صورة شخصية (Required) + إثبات عنوان (Optional)
 * المنظَّمة: ما سبق + المؤهل (Required) + الترخيص (Required عند الحاجة)
 */
export const SEED_PROFESSIONS: SeedProfession[] = [
  /* ---- مهن حرفية (CRAFT) ---- */
  { categorySlug: 'plumbing-electric', name: 'سبّاك', slug: 'plumber', icon: 'wrench', professionKind: 'CRAFT', requiresQualification: false, requiresLicense: false, order: 1 },
  { categorySlug: 'plumbing-electric', name: 'كهربائي', slug: 'electrician', icon: 'zap', professionKind: 'CRAFT', requiresQualification: false, requiresLicense: false, order: 2 },
  { categorySlug: 'plumbing-electric', name: 'نقّاش', slug: 'painter', icon: 'paint-roller', professionKind: 'CRAFT', requiresQualification: false, requiresLicense: false, order: 3 },
  { categorySlug: 'home-services', name: 'فني تكييف', slug: 'ac-technician', icon: 'air-vent', professionKind: 'CRAFT', requiresQualification: false, requiresLicense: false, order: 4 },
  { categorySlug: 'plumbing-electric', name: 'نجّار', slug: 'carpenter', icon: 'hammer', professionKind: 'CRAFT', requiresQualification: false, requiresLicense: false, order: 4 },
  { categorySlug: 'home-services', name: 'عامل نظافة', slug: 'cleaner', icon: 'sparkles', professionKind: 'CRAFT', requiresQualification: false, requiresLicense: false, order: 6 },
  { categorySlug: 'home-services', name: 'مكافحة حشرات', slug: 'pest-control', icon: 'bug', professionKind: 'CRAFT', requiresQualification: false, requiresLicense: false, order: 7 },
  { categorySlug: 'home-services', name: 'فني أجهزة منزلية', slug: 'appliance-technician', icon: 'washing-machine', professionKind: 'CRAFT', requiresQualification: false, requiresLicense: false, order: 8 },
  { categorySlug: 'home-services', name: 'نقل عفش', slug: 'moving', icon: 'truck', professionKind: 'CRAFT', requiresQualification: false, requiresLicense: false, order: 9 },
  { categorySlug: 'car-services', name: 'ميكانيكي سيارات', slug: 'car-mechanic', icon: 'car', professionKind: 'CRAFT', requiresQualification: false, requiresLicense: false, order: 10 },
  { categorySlug: 'tech-services', name: 'فني كمبيوتر', slug: 'computer-technician', icon: 'laptop', professionKind: 'CRAFT', requiresQualification: false, requiresLicense: false, order: 11 },
  { categorySlug: 'beauty-care', name: 'مصفّف شعر', slug: 'hairdresser', icon: 'scissors', professionKind: 'CRAFT', requiresQualification: false, requiresLicense: false, order: 12 },

  /* ---- مهن منظَّمة (REGULATED) بمؤهل وترخيص ---- */
  { categorySlug: 'medical-services', name: 'طبيب', slug: 'doctor', icon: 'stethoscope', professionKind: 'REGULATED', requiresQualification: true, requiresLicense: true, order: 13 },
  { categorySlug: 'medical-services', name: 'صيدلي', slug: 'pharmacist', icon: 'pill', professionKind: 'REGULATED', requiresQualification: true, requiresLicense: true, order: 14 },
  { categorySlug: 'medical-services', name: 'أخصائي علاج طبيعي', slug: 'physiotherapist', icon: 'activity', professionKind: 'REGULATED', requiresQualification: true, requiresLicense: true, order: 15 },
  { categorySlug: 'legal-services', name: 'محامٍ', slug: 'lawyer', icon: 'scale', professionKind: 'REGULATED', requiresQualification: true, requiresLicense: true, order: 16 },
  { categorySlug: 'legal-services', name: 'محاسب قانوني', slug: 'accountant', icon: 'calculator', professionKind: 'REGULATED', requiresQualification: true, requiresLicense: true, order: 17 },

  /* ---- مهنة منظَّمة بمؤهل بلا ترخيص — تثبت أن الرخصة تختفي تلقائيًا ---- */
  { categorySlug: 'education-training', name: 'مدرّس خصوصي', slug: 'private-tutor', icon: 'graduation-cap', professionKind: 'REGULATED', requiresQualification: true, requiresLicense: false, order: 18 },

  /* ---- مناسبات وفعاليات — كانت بلا مهن ---- */
  { categorySlug: 'events', name: 'منظّم مناسبات', slug: 'event-planner', icon: 'party-popper', professionKind: 'CRAFT', requiresQualification: false, requiresLicense: false, order: 19 },
  { categorySlug: 'events', name: 'مصوّر فوتوغرافي', slug: 'photographer', icon: 'camera', professionKind: 'CRAFT', requiresQualification: false, requiresLicense: false, order: 20 },

  /* ---- إضافات لاحقة ---- */
  { categorySlug: 'car-services', name: 'سائق', slug: 'driver', icon: 'car-taxi-front', professionKind: 'CRAFT', requiresQualification: false, requiresLicense: false, order: 21 },
  { categorySlug: 'real-estate', name: 'تسويق عقارات', slug: 'real-estate-marketing', icon: 'building-2', professionKind: 'CRAFT', requiresQualification: false, requiresLicense: false, order: 22 },
  { categorySlug: 'delivery', name: 'دليفري', slug: 'delivery-courier', icon: 'bike', professionKind: 'CRAFT', requiresQualification: false, requiresLicense: false, order: 23 },
];

/** يبني قائمة المستندات لمهنة من مفاتيح تحكّمها. */
export function requirementsFor(profession: SeedProfession): DocumentRequirement[] {
  return buildDocumentRequirements({
    requiresQualification: profession.requiresQualification,
    requiresLicense: profession.requiresLicense,
  });
}

/** مناطق التغطية الشائعة — نص فقط. */
export const SEED_AREAS = [
  'حي الجامعة',
  'الحوّاتم',
  'دار الرماد',
  'حي السلام',
  'حي النصر',
  'حي الترعة',
  'الحوامي',
  'شارع البحر',
] as const;

export interface SeedProvider {
  displayName: string;
  professionSlug: string;
  years: number;
  bio: string;
  areas: string[];
  ratingAvg: number;
  ratingCount: number;
  completedOrders: number;
  approved: boolean;
}

/** مقدمو خدمات — أسماء من الصور 06 و09 و10. */
export const SEED_PROVIDERS: SeedProvider[] = [
  { displayName: 'شركة النقاء للتنظيف', professionSlug: 'cleaner', years: 10, bio: 'نوفر خدمات تنظيف احترافية بأعلى معايير الجودة وباستخدام مواد آمنة وفعّالة.', areas: ['الحوّاتم', 'حي الجامعة'], ratingAvg: 4.8, ratingCount: 128, completedOrders: 540, approved: true },
  { displayName: 'صيانة الأجهزة المنزلية', professionSlug: 'appliance-technician', years: 7, bio: 'صيانة غسالات وثلاجات وتكييفات وأفران بضمان على الخدمة.', areas: ['شارع البحر', 'حي النصر'], ratingAvg: 4.7, ratingCount: 96, completedOrders: 310, approved: true },
  { displayName: 'مكافحة الحشرات والنمل الأبيض', professionSlug: 'pest-control', years: 5, bio: 'رش حشرات ونمل أبيض وفئران بمواد مصرّح بها وآمنة على الأسرة.', areas: ['دار الرماد'], ratingAvg: 4.9, ratingCount: 74, completedOrders: 220, approved: true },
  { displayName: 'نجار وديكورات', professionSlug: 'carpenter', years: 8, bio: 'تركيب أبواب ومطابخ وغرف نوم وديكورات خشبية بجودة عالية.', areas: ['حي الجامعة', 'الحوامي'], ratingAvg: 4.6, ratingCount: 58, completedOrders: 180, approved: true },
  { displayName: 'كهربائي الفيوم', professionSlug: 'electrician', years: 12, bio: 'كهربائي تمديدات ولوحات كهرباء وصيانة أعطال بسرعة واحترافية.', areas: ['حي السلام', 'حي الترعة'], ratingAvg: 4.8, ratingCount: 62, completedOrders: 275, approved: true },
  { displayName: 'أبو خالد للسباكة', professionSlug: 'plumber', years: 15, bio: 'سبّاك صحي وكشف تسربات وتركيب سخانات وأدوات صحية.', areas: ['دار الرماد', 'حي النصر'], ratingAvg: 4.7, ratingCount: 75, completedOrders: 410, approved: true },
  { displayName: 'د. أحمد محمد', professionSlug: 'doctor', years: 14, bio: 'استشاري باطنة — كشف وزيارات منزلية ومتابعة الأمراض المزمنة.', areas: ['الحوّاتم', 'حي الجامعة'], ratingAvg: 4.9, ratingCount: 128, completedOrders: 620, approved: true },
  { displayName: 'أ/ محمد رضوان', professionSlug: 'lawyer', years: 18, bio: 'محامٍ بالنقض — قضايا مدنية وتجارية وأحوال شخصية واستشارات.', areas: ['شارع البحر'], ratingAvg: 4.8, ratingCount: 96, completedOrders: 240, approved: true },
  { displayName: 'أبو محمد للصيانة والتكييف', professionSlug: 'ac-technician', years: 9, bio: 'تركيب وصيانة وتنظيف التكييفات بجميع أنواعها.', areas: ['دار الرماد'], ratingAvg: 4.7, ratingCount: 96, completedOrders: 330, approved: true },
  { displayName: 'المحامي أحمد صلاح', professionSlug: 'lawyer', years: 11, bio: 'استشارات قانونية وصياغة عقود وتوثيق.', areas: ['حي الجامعة'], ratingAvg: 5, ratingCount: 57, completedOrders: 150, approved: true },
  { displayName: 'السبّاك المتخصص', professionSlug: 'plumber', years: 6, bio: 'إصلاح تسريبات وتركيب فلاتر ومواسير.', areas: ['حي الترعة'], ratingAvg: 4.6, ratingCount: 72, completedOrders: 190, approved: true },
  { displayName: 'دهانات وديكور الفيوم', professionSlug: 'painter', years: 10, bio: 'دهانات داخلية وخارجية وورق حائط وديكورات جبس.', areas: ['الحوامي', 'حي السلام'], ratingAvg: 4.7, ratingCount: 76, completedOrders: 210, approved: true },
  { displayName: 'نقل عفش الأمانة', professionSlug: 'moving', years: 8, bio: 'نقل عفش وفك وتركيب بعمالة مدرّبة وسيارات مغلقة.', areas: ['حي الجامعة', 'الحوّاتم', 'دار الرماد'], ratingAvg: 4.5, ratingCount: 44, completedOrders: 120, approved: true },
  { displayName: 'مركز الفيوم للكمبيوتر', professionSlug: 'computer-technician', years: 7, bio: 'صيانة أجهزة وشبكات وتركيب أنظمة تشغيل.', areas: ['شارع البحر'], ratingAvg: 4.4, ratingCount: 38, completedOrders: 95, approved: true },
  { displayName: 'صيدلية د. منى', professionSlug: 'pharmacist', years: 9, bio: 'استشارات دوائية وتوصيل أدوية.', areas: ['حي النصر'], ratingAvg: 4.8, ratingCount: 51, completedOrders: 300, approved: true },
  { displayName: 'مركز العلاج الطبيعي', professionSlug: 'physiotherapist', years: 6, bio: 'جلسات علاج طبيعي منزلية وتأهيل بعد الإصابات.', areas: ['حي الجامعة'], ratingAvg: 4.9, ratingCount: 63, completedOrders: 175, approved: true },
  { displayName: 'مكتب المحاسب القانوني', professionSlug: 'accountant', years: 13, bio: 'إعداد قوائم مالية وإقرارات ضريبية ومراجعة حسابات.', areas: ['شارع البحر'], ratingAvg: 4.6, ratingCount: 29, completedOrders: 80, approved: true },
  { displayName: 'أ/ سمير للدروس الخصوصية', professionSlug: 'private-tutor', years: 10, bio: 'دروس رياضيات وفيزياء لطلاب الثانوية العامة.', areas: ['حي السلام', 'حي الجامعة'], ratingAvg: 4.7, ratingCount: 88, completedOrders: 400, approved: true },
  { displayName: 'صالون ليان', professionSlug: 'hairdresser', years: 5, bio: 'قص وصبغة وعناية بالشعر ومكياج مناسبات.', areas: ['حي الترعة'], ratingAvg: 4.5, ratingCount: 41, completedOrders: 260, approved: true },
  { displayName: 'ورشة الفيوم للسيارات', professionSlug: 'car-mechanic', years: 16, bio: 'صيانة دورية وكهرباء سيارات وتشخيص أعطال بالكمبيوتر.', areas: ['دار الرماد'], ratingAvg: 4.6, ratingCount: 67, completedOrders: 340, approved: true },

  /* ---- مزوّدان قيد المراجعة — لاختبار أنهما لا يظهران في البحث ---- */
  { displayName: 'مزوّد قيد المراجعة', professionSlug: 'plumber', years: 3, bio: 'مزوّد جديد لم تتم مراجعته بعد.', areas: ['حي الجامعة'], ratingAvg: 0, ratingCount: 0, completedOrders: 0, approved: false },
  { displayName: 'طبيب قيد المراجعة', professionSlug: 'doctor', years: 4, bio: 'طبيب جديد في انتظار اعتماد المستندات.', areas: ['الحوّاتم'], ratingAvg: 0, ratingCount: 0, completedOrders: 0, approved: false },
];

/** الأسئلة الشائعة — الصورة 18. */
export const SEED_FAQS = [
  {
    question: 'كيف يمكنني تتبع حالة طلبي؟',
    answer:
      'يمكنك متابعة حالة طلبك من خلال الذهاب إلى قسم «طلباتي» ثم اختيار الطلب للعرض على جميع التفاصيل والحالة الحالية.',
    topic: 'ORDERS' as const,
    order: 1,
  },
  {
    question: 'ما طرق الدفع المتاحة؟',
    answer:
      'الدفع كاش مباشرة لمقدم الخدمة بعد إتمام الخدمة. التطبيق لا يوفر أي خدمة دفع إلكترونية، ولا يتم تحصيل أي مبالغ داخل التطبيق.',
    topic: 'PAYMENT' as const,
    order: 2,
  },
  {
    question: 'هل يمكنني إلغاء أو تعديل الطلب؟',
    answer:
      'يمكنك إلغاء الطلب طالما لم يبدأ مقدم الخدمة التنفيذ. بعد بدء التنفيذ يمكنك التواصل مع مقدم الخدمة مباشرة.',
    topic: 'ORDERS' as const,
    order: 3,
  },
  {
    question: 'متى يتم دفع قيمة الخدمة؟',
    answer:
      'يتم الدفع بعد تنفيذ الخدمة مباشرة ونقدًا لمقدم الخدمة خارج التطبيق، ويؤكد مقدم الخدمة استلام المبلغ عند إغلاق الطلب.',
    topic: 'PAYMENT' as const,
    order: 4,
  },
  {
    question: 'هل يمكنني تقييم مقدم الخدمة؟',
    answer:
      'نعم، بعد اكتمال الخدمة يمكنك تقييم مقدم الخدمة من 1 إلى 5 نجوم مع إضافة تعليق اختياري.',
    topic: 'PROVIDERS' as const,
    order: 5,
  },
  {
    question: 'كيف أصبح مقدم خدمة؟',
    answer:
      'اختر «مقدم خدمة» عند إنشاء الحساب، ثم أكمل خطوات التسجيل الأربع وارفع المستندات المطلوبة لمهنتك. تتم المراجعة خلال 24 إلى 48 ساعة عمل.',
    topic: 'ACCOUNT' as const,
    order: 6,
  },
];

/** الإعدادات العامة. */
export const SEED_SETTINGS = [
  // يجب أن يطابق `SUPPORT_PHONE` في shared/constants/legal.ts
  { key: 'support_phone', value: '+201001191006', description: 'رقم الدعم الظاهر في مركز المساعدة' },
  // يجب أن يطابق `SUPPORT_EMAIL` في shared/constants/legal.ts
  { key: 'support_email', value: 'nosait7355@gmail.com', description: 'بريد الدعم' },
  { key: 'review_sla_hours', value: 48, description: 'المدة المتوقعة لمراجعة طلبات مقدمي الخدمة' },
  { key: 'max_order_attachments', value: 5, description: 'أقصى عدد صور مرفقة بالطلب' },
  {
    key: 'payment_notice_ar',
    value: 'لا يوجد دفع أونلاين. يتم الدفع مباشرة بينك وبين مقدم الخدمة خارج التطبيق.',
    description: 'نص تنبيه الدفع الظاهر في شاشات الطلب',
  },
];

# PROJECT_PLAN.md — خطة تنفيذ «خدماتي الفيوم» (10 مراحل)

> المراجع الملزمة: [`UI_ANALYSIS.md`](UI_ANALYSIS.md) · [`ARCHITECTURE.md`](ARCHITECTURE.md)
## قواعد عابرة لكل المراحل (Global Constraints)

**المصادقة:** ❌ لا OTP (SMS أو بريد) · ❌ لا Social Login (Google / Facebook / Apple) — الدخول برقم هاتف أو بريد + كلمة مرور فقط.

**الدفع — NON-NEGOTIABLE:** ❌ لا Online Payment · لا Payment Gateway · لا Visa/Mastercard · لا Stripe · لا PayPal · لا Paymob · لا Fawry · لا Wallet Payment · لا Card Input · لا Checkout · لا Payment Transactions · لا أي Collection أو Service أو SDK مالي.
✅ المسموح فقط: عرض قيمة الخدمة المتفق عليها · `paymentMethod` بقيمة ثابتة واحدة `CASH_ON_DELIVERY_OFFLINE` · **علامة حالة** `cashReceivedConfirmed` تسجّل تأكيد المزوّد استلام المبلغ عند الإكمال. الدفع يتم مباشرة بين العميل ومقدم الخدمة **خارج التطبيق**.

**الخرائط والموقع — NON-NEGOTIABLE:** ❌ لا Google Maps · لا Mapbox · لا OpenStreetMap · لا Maps SDK/API · لا GPS · لا Live Location · لا Location Tracking · لا ETA · لا Route · لا Distance calculation · لا تتبّع لأي طرف · لا حقول `lat`/`lng`/`coordinates`/`GeoJSON` · لا فهرس `2dsphere` · لا `navigator.geolocation`.
✅ المسموح فقط: عنوان **نصي** — المحافظة / المركز / المنطقة / الشارع / العنوان التفصيلي / أقرب معلم، مختارًا من قائمة ثابتة لمناطق الفيوم.

**البيانات:** ❌ لا صور داخل MongoDB (Cloudinary فقط + metadata) · ❌ لا أسرار في الـFrontend.

**الواجهة:** ✅ RTL و Arabic-first · ✅ Mobile-first · ✅ **الصور الـ29 هي Design Specification نهائية** — تُنفَّذ بأكبر تطابق عملي في Layout وColors وTypography وSpacing وCards وButtons وIcons وRadius وNavigation وRTL وResponsive · ❌ ممنوع إضافة أي Feature أو Screen غير موجود في الصور إلا إذا كان ضروريًا لتشغيل Feature موجودة فعلًا فيها (القائمة المبرَّرة في `UI_ANALYSIS.md §0.1`).

**التنفيذ:** القاعدتان الماليّة والجغرافية تُفحصان آليًا في CI (قاعدة ESLint مخصّصة + فحص كلمات محظورة) ويفشل البناء عند أي مخالفة.

> **لا تبدأ مرحلة قبل اعتماد `PHASE_XX_REVIEW.md` للمرحلة السابقة.**

> **قائمة ما قبل الإنتاج مُلزِمة:** كل بند مؤجَّل يُسجَّل في [`PRE_PRODUCTION_CHECKLIST.md`](PRE_PRODUCTION_CHECKLIST.md)، ولا يُنشر التطبيق قبل اجتيازها كاملة — وعلى رأسها اختبار الرفع الحقيقي إلى Cloudinary، وقاعدة «بيانات التطوير والمراجعة لا تصل الإنتاج».

## جدول المراحل

| Phase | العنوان | الناتج الرئيسي |
|---|---|---|
| 1 | الأساس والمعمارية + Design System | مشروع يعمل + مكتبة مكوّنات مطابقة للصور |
| 2 | قاعدة البيانات وأساس الـBackend | كل الـModels + الاتصال + Seed + Middleware |
| 3 | المصادقة والحسابات | تسجيل/دخول/خروج/إعادة تعيين + Splash/Role Select |
| 4 | Cloudinary والمستندات الديناميكية | رفع آمن + محرّك متطلبات المهن |
| 5 | الكتالوج والاكتشاف | التصنيفات/المهن/الخدمات/البحث/الفلاتر/ملف المزوّد |
| 6 | تسجيل مقدم الخدمة والتوثيق | 4 خطوات + PENDING_REVIEW + مراجعة الإدارة |
| 7 | دورة حياة الطلب — جانب العميل | إنشاء الطلب + طلباتي + التفاصيل + الإلغاء |
| 8 | دورة حياة الطلب — جانب المزوّد | Dashboard + قبول/رفض + تحديث الحالة + الإكمال + تأكيد الكاش |
| 9 | الإشعارات والتقييمات والمراسلة والحساب | 4 أنظمة + عناويني + المفضلة + مركز المساعدة |
| 10 | لوحة الإدارة + التصلّب + Android/PWA والنشر | AAB + PWA + تقوية أمنية وأداء |

---

## Phase 1 — Foundation & Architecture + Design System

**الهدف:** مشروع Next.js 15 + TypeScript يعمل بـRTL كامل، مع Design Tokens ومكتبة مكوّنات مستخرجة حرفيًا من الصور، وبنية مجلدات ومعمارية جاهزة للبناء عليها.

**Features:** تهيئة المشروع · Theme/Tokens · RTL · خط Cairo · Routing Groups · Layouts · State (Zustand + TanStack Query) · API client · معالجة الأخطاء · Logger · Env validation · Skeletons/Empty/Error · Storybook-like صفحة `/_design` لعرض المكوّنات.

**Screens:** لا شاشات وظيفية — لكن تُنفَّذ Shells: `AppHeader`, `BackHeader`, `BottomNav` (Customer + Provider), `PageContainer`, وصفحة معاينة المكوّنات.

**Backend:** هيكل `src/server` + `withErrorHandler` + `env.ts` + `logger.ts` + `AppError` + `/api/v1/health`.

**Database:** لا شيء (اتصال Atlas في Phase 2).

**API:** `GET /api/v1/health` فقط.

**Frontend:** Tokens في `globals.css` + Tailwind preset · مكوّنات `ui/` (Button 4 variants، Input، Select، Textarea، Checkbox، Radio، Chip، Card، Badge، Modal، Sheet، Toast، Skeleton، Spinner) · `common/` (EmptyState، ErrorState، InfoAlert، Stepper، StatusBadge، OrderTimeline، StatusStepperH، Pagination) · دوال `format.ts` (أرقام Latin، تاريخ عربي، `ج.م`).

**Security:** Security headers + CSP أولية · **تعطيل `geolocation` صراحةً في `Permissions-Policy`** · `.env.example` بلا قيم حقيقية · `.gitignore` · **إعداد فحص CI للكلمات المحظورة** (stripe, paymob, fawry, checkout, payment gateway, googlemaps, mapbox, leaflet, geolocation, 2dsphere…) يفشل البناء عند أي مطابقة.

**Testing:** Vitest يعمل · اختبارات وحدة لـ`format.ts` و`Button`/`StatusBadge` · فحص أن `BottomNav` يرسم 5 عناصر بالترتيب الصحيح RTL.

**Acceptance Criteria:**
1. `npm run dev` يعمل بلا أخطاء و`npm run build` ينجح.
2. `dir="rtl"` فعّال، ولا يوجد `margin-left/right` صريح في المكوّنات (logical only).
3. ألوان وقياسات Tokens مطابقة لجدول UI_ANALYSIS §1.1–1.3.
4. صفحة `/_design` تعرض كل المكوّنات في حالاتها (default/hover/disabled/error).
5. لا تحذيرات TypeScript ولا ESLint errors.

**Dependencies:** لا شيء.
**Definition of Done:** بناء ناجح + typecheck + lint نظيفان + اختبارات خضراء + مراجعة بصرية للمكوّنات مقابل الصور + `PHASE_01_REVIEW.md`.

---

## Phase 2 — Database & Backend Foundation

**الهدف:** كل نماذج MongoDB Atlas بفهارس وتحقق وعلاقات، مع Middleware chain وطبقة Repositories/Services، وبيانات بذرية واقعية للفيوم.

**Features:** اتصال Atlas مع Connection caching · كل الـModels (§3 من ARCHITECTURE) · Indexes · Enums موحّدة · Seed script · Repositories + Services · Middleware (`withAuth` هيكليًا، `withRole`، `withValidation`، `withRateLimit`) · معيار الاستجابة الموحّد.

**Screens:** لا شيء.

**Backend/Database:** **15 Collection**: `users` · `serviceProviders` · `categories` · `professions` · `services` · `serviceRequests` · `providerDocuments` · `reviews` · `favorites` · `addresses` · `notifications` · `messages/threads` · `settings` · `auditLogs` · `faqs` · + `sanitizeFilter` + projections آمنة.
**تحقق سلبي إلزامي:** لا وجود لأي Collection مالية (`payments`/`transactions`/`invoices`/`wallets`) ولا أي حقل إحداثيات أو فهرس `2dsphere` في أي Model.

**API:** `/api/v1/categories`، `/api/v1/professions` (قراءة فقط) للتحقق من المسار الكامل Request→Service→Repo→Mongo.

**Frontend:** ربط `api-client.ts` + `query-keys.ts` واختبار جلب التصنيفات.

**Security:** استبعاد `passwordHash`/`refreshTokenHashes` بـprojection افتراضي · Zod `.strict()` على كل مدخل · حظر مفاتيح `$`/`.`.

**Testing:** اختبارات Models على `mongodb-memory-server` (required fields، enums، unique indexes) · اختبار Seed · اختبار API للتصنيفات.

**Acceptance Criteria:** كل Index يُنشأ فعليًا (تحقق بـ`getIndexes`) · Seed يولّد ≥9 تصنيفات و≥14 مهنة موزّعة على القالبين (`CRAFT` و`REGULATED`) بـ`documentRequirements` صحيحة، و≥20 مزوّدًا و≥40 خدمة في مناطق الفيوم النصية · لا استعلام يعيد `passwordHash` · صفر Collection مالية وصفر حقل جغرافي.

**Dependencies:** Phase 1.
**Definition of Done:** الاتصال بـAtlas ناجح + كل الاختبارات خضراء + `PHASE_02_REVIEW.md`.

---

## Phase 3 — Authentication & Accounts

**الهدف:** مصادقة كاملة آمنة بالهاتف/البريد + كلمة المرور، وشاشات الدخول من Splash حتى Home.

**Features:** تسجيل عميل · تسجيل الدخول · تحديث التوكن · تسجيل الخروج (وكل الأجهزة) · نسيت/إعادة تعيين كلمة المرور بالبريد · «تذكرني» · حماية المسارات حسب الدور · Session bootstrap في Splash.

**Screens:** 01 Splash · 02 Role Select · 03 Login (+ Tabs الهاتف/البريد ومفتاح +20 من 04) · 05 Register · Forgot/Reset Password (مشتقّتان — يبرّرهما رابط «نسيت كلمة المرور؟» في الشاشة 03).
> **لا Onboarding** — لا توجد لها صورة، والانتقال من Splash يذهب مباشرة إلى Role Select.

**Backend:** argon2id · JWT Access/Refresh + Rotation + كشف إعادة الاستخدام · قفل الحساب بعد 5 محاولات · إرسال بريد إعادة التعيين.

**API:** `/auth/register` · `/auth/login` · `/auth/refresh` · `/auth/logout` · `/auth/forgot-password` · `/auth/reset-password` · `GET /auth/me`.

**Frontend:** RHF + Zod (نفس الـschemas) · رسائل خطأ عربية تحت الحقول · حالات Loading/Disabled للأزرار · Route guards + إعادة توجيه حسب الدور والحالة (Provider غير معتمد → `pending-review`).

**Security:** httpOnly cookies · CSRF عبر SameSite + فحص Origin · Rate limit 5/دقيقة على auth · رسالة موحّدة عند فشل الدخول (لا تكشف وجود الحساب) · **تأكيد عدم وجود أي مسار OTP أو Social**.

**Testing:** وحدة: hashing، JWT، rotation · API: تسجيل/دخول/refresh/logout/إعادة تعيين + حالات الفشل + القفل + rate limit · E2E: تسجيل عميل ← دخول ← وصول للرئيسية ← خروج.

**Acceptance Criteria:** لا توكن في localStorage · لا يمكن الوصول لأي صفحة محمية بدون جلسة · إعادة استخدام refresh token يُبطل كل الجلسات · Splash يوجّه للوجهة الصحيحة في الحالات الأربع.

**Dependencies:** Phase 1، 2.
**Definition of Done:** كل ما سبق + مطابقة بصرية للشاشات 01–05 + `PHASE_03_REVIEW.md`.

---

## Phase 4 — Cloudinary & Dynamic Profession Requirements

**الهدف:** خط رفع آمن كامل، ومحرّك المستندات الديناميكية الذي يجعل شاشة المستندات تتغيّر تلقائيًا حسب المهنة.

**Features:** Signed Upload · حفظ metadata فقط · `ImageUploader` (اختيار/معاينة/تقدّم/حذف/إعادة محاولة) · **محرّك المستندات الديناميكية** · Signed URL مؤقّت للمستندات · حذف الأصول اليتيمة.

**محرّك المستندات الديناميكية — التفصيل:**
- مفاتيح تحكم على مستوى المهنة: `professionKind` (`CRAFT` | `REGULATED`) · `requiresQualification` · `requiresLicense`.
- قائمة `documentRequirements` لكل عنصر: `key` · `label` · `description` · **`required` (Required أم Optional)** · `order` · `accept` · `maxSizeMB`.
- **قاعدة الاتساق المفروضة على السيرفر:** `NATIONAL_ID` و`PERSONAL_PHOTO` دائمًا Required · `ADDRESS_PROOF` دائمًا Optional · `PROFESSIONAL_CERT` يظهر Required فقط عند `requiresQualification=true` (ويختفي تمامًا خلاف ذلك) · `PRACTICE_LICENSE` يظهر Required فقط عند `requiresLicense=true` (ويختفي تمامًا خلاف ذلك). أي تعارض يُرفض بـ`422`.
- **المهن الحرفية** (سبّاك، كهربائي، نقّاش، فني تكييف، نجّار، فني أجهزة، نقل عفش، مكافحة حشرات): بطاقة الرقم القومي **Required** + صورة شخصية **Required** + إثبات العنوان **Optional**.
- **المهن المنظَّمة** (طبيب، محامٍ، صيدلي، محاسب، مهندس): ما سبق **إضافةً** إلى المؤهل/الشهادة المهنية **Required** وترخيص مزاولة المهنة **Required عند الحاجة**.
- **كل ذلك يُحرَّر من لوحة Admin بدون تعديل أي كود أو إعادة نشر**؛ ولا توجد أي قائمة مستندات ثابتة (hard-coded) في الواجهة أو الـService.

**Screens:** مكوّن الرفع مدمجًا في: 11 (مرفقات الطلب حتى 5) · 21 (المستندات) · 16 (تغيير الصورة الشخصية) · معرض المزوّد.

**Backend:** `POST /uploads/signature` · `POST /provider/documents` · `GET /provider/documents/:id/url` · `GET /professions/:id/document-requirements` · فحص MIME بالتوقيع السحري + الحجم ≤5MB + allowlist الصيغ.

**Database:** `providerDocuments` + `MediaRef` في باقي الـModels + `professions.documentRequirements`.

**Frontend:** الشاشة 21 تُبنى ديناميكيًا من الـAPI: عدد البطاقات وتسمياتها و`*` الإلزامية كلها من قاعدة البيانات.

**Security:** `API_SECRET` على السيرفر فقط · المستندات `type=authenticated` · منع IDOR على المستندات (المالك أو ADMIN فقط) · رفض الملفات التنفيذية/SVG · حد معدل للتوقيع.

**Testing:** وحدة: توليد التوقيع، فحص MIME/الحجم، **قاعدة الاتساق** بكل فروعها · API: رفض غير المصرّح، رفض >5MB، رفض MIME خاطئ، منع قراءة مستند مستخدم آخر (404)، رفض `requirementKey` غير مذكور في إعدادات المهنة · اختبار أن «سبّاك» تُرجع 3 متطلبات (2 Required + 1 Optional) و«طبيب» تُرجع 5 (4 Required + 1 Optional) و«مدرّس خصوصي» (`requiresLicense=false`) تُرجع 4 بلا `PRACTICE_LICENSE`.

**Acceptance Criteria:** لا ملف يمرّ عبر سيرفر التطبيق · لا Base64 في MongoDB · تغيير إعدادات المهنة من لوحة Admin يغيّر شاشة المستندات فورًا بلا نشر كود · صفر قائمة مستندات ثابتة في الكود · التحقق من اكتمال المستندات `Required` يتم على السيرفر لا الواجهة وحدها.

**Dependencies:** Phase 2، 3.
**Definition of Done:** ما سبق + `PHASE_04_REVIEW.md`.

---

## Phase 5 — Catalog & Discovery

**الهدف:** كل رحلة اكتشاف العميل: الرئيسية، التصنيفات، المهن، الخدمات، الفلاتر، البحث، وملف مقدم الخدمة.

**Features:** Home بأقسامها الخمسة · هرمية Category←Profession · قوائم الخدمات مع فلترة (المنطقة، السعر، التقييم) وترتيب (الأعلى تقييمًا، الأقل سعرًا، الأحدث) · بحث موحّد بـText index + Debounce · ملف المزوّد بتبويباته الأربعة · Infinite scroll · Skeletons.

**Screens:** 06 Home · 07 + 08 التصنيفات (موحّدتان) · 09 الخدمات داخل التصنيف · 10 ملف مقدم الخدمة · شاشة البحث (مشتقة).

**Backend/API:** `GET /categories`، `/professions`، `/providers` (مع كل الفلاتر والترتيب والصفحات)، `/providers/:id`، `/services`، `/services/:id`، `/search`، `/providers/:id/reviews`.

**Database:** Text indexes + compound indexes للفلترة والترتيب · فلترة صارمة `verification.status = APPROVED && isActive` في الـRepository.

**Frontend:** `ServiceCard`، `ProviderMiniCard`، `CategoryCard`، `FilterBar`، `ProfileTabs`، `PromoBanner` — كلها مطابقة للصور · صور Cloudinary بمقاسات محسّنة.

**Security:** المزوّدون غير المعتمدين غير قابلين للاستعلام إطلاقًا · لا تسريب لهاتف/بريد المزوّد في القوائم العامة · حد معدل على البحث.

**Testing:** API: كل مجموعة فلاتر، الترتيب، الصفحات، استبعاد غير المعتمدين · وحدة: بناء الاستعلام من الفلاتر · E2E: Home ← تصنيف ← خدمة ← ملف المزوّد.

**Acceptance Criteria:** أول صفحة من أي قائمة ≤ 400ms على Atlas (بعد الفهارس) · لا Layout shift · كل قائمة لها Empty/Error/Loading.

**Dependencies:** Phase 2، 4.
**Definition of Done:** ما سبق + مقارنة بصرية بالصور 06–10 + `PHASE_05_REVIEW.md`.

---

## Phase 6 — Provider Registration & Verification

**الهدف:** رحلة تسجيل مقدم الخدمة الأربع خطوات مع المستندات الديناميكية، وحالة `PENDING_REVIEW`، وأدوات مراجعة الإدارة.

**Features:** Wizard 4 خطوات بحفظ تلقائي للمسودة (draft) · تحقق لكل خطوة · شاشة المراجعة بأزرار «تعديل» · إرسال الطلب + توليد `SRV-YYYY-NNNNNN` · شاشة قيد المراجعة بخطواتها الأربع · قرارات الإدارة (APPROVED / REJECTED / RESUBMISSION_REQUIRED) + إشعارات.

**Screens:** 19، 20، 21، 22، 23 · شاشة إدارة أولية للتوثيق (Admin) بعرض المستندات عبر Signed URLs.

**Backend/API:** `POST /auth/register-provider` (متعدد الخطوات) · `GET/PATCH /provider/profile` · `PATCH /admin/providers/:id/verification` · حساب `profileCompletion`.

**Database:** `serviceProviders.verification` + `providerDocuments` + `auditLogs` لكل قرار.

**Security:** `verification.status` و`isVerifiedBadge` غير قابلين للتعديل إلا من ADMIN · مستندات مزوّد غير مرئية لمزوّد آخر · تسجيل كل قرار في `auditLogs`.

**Testing:** API: كل خطوة، الرفض عند نقص مستند إلزامي حسب المهنة، منع استقبال الطلبات قبل الاعتماد · E2E: تسجيل مزوّد كامل ← قيد المراجعة ← اعتماد ← ظهوره في نتائج البحث.

**Acceptance Criteria:** مزوّد `PENDING_REVIEW` لا يظهر في أي بحث ولا يمكنه قبول طلب (يُختبر على مستوى الـAPI لا الـUI فقط) · مستندات مهنة السبّاك ≠ مستندات مهنة الطبيب.

**Dependencies:** Phase 3، 4، 5.
**Definition of Done:** ما سبق + `PHASE_06_REVIEW.md`.

---

## Phase 7 — Order Lifecycle (Customer Side)

**الهدف:** إنشاء الطلب ومتابعته وإلغاؤه من جانب العميل، مع State Machine محكمة.

**Features:** Wizard الطلب 4 خطوات كما في الـStepper الظاهر بالصور 11 و12: `تفاصيل الطلب ← تأكيد الطلب ← اختيار الوقت ← تم الإرسال`.
> **اختيار الوقت مؤكَّد من التصميم** (وليس إضافة من عندي): الخطوة 3 مسمّاة «اختيار الوقت» في الـStepper بالصورتين 11 و12، وفي الصورة 11 حقل `وقت الخدمة (اختياري) — اختر الوقت المفضل`، وفي الصورة 12 صف `الوقت المفضل: من 10:00 ص إلى 12:00 م`. القاعدة: **التاريخ إلزامي والوقت اختياري**. الصور تغطي الخطوتين 1 و4 فقط، والخطوتان 2 و3 تُبنيان من نفس الـDesign System بلا عناصر جديدة.

· مرفقات حتى 5 صور · توليد `orderNumber` تسلسلي · طلباتي بـTabs وعدّادات · تفاصيل الطلب مع Timeline · إلغاء الطلب (مسموح في NEW/ACCEPTED فقط) · «طلب مرة أخرى» · «مشاركة الطلب» · أزرار اتصال/واتساب (Deep links).

**Screens:** 11، 12، 13، 14.

**Backend/API:** `POST /orders` · `GET /orders` · `GET /orders/:id` · `POST /orders/:id/cancel` · `order-state-machine.ts` + `statusHistory` + إشعار الطرف الآخر داخل معاملة.

**Security:** IDOR: العميل يرى طلباته فقط (وإلا 404) · `agreedPrice`/`status` غير قابلين للتعديل من العميل · **تأكيد عدم وجود أي حقل أو مسار دفع** — `paymentMethod` قيمة ثابتة واحدة.

**Testing:** وحدة: جدول الانتقالات كاملًا (المسموح والممنوع) · API: إنشاء، قوائم بالحالة، إلغاء مسموح/ممنوع، IDOR · E2E: من ملف المزوّد إلى «تم إرسال طلبك بنجاح» ثم ظهوره في طلباتي.

**Acceptance Criteria:** أي انتقال غير مسموح يعيد 409 · لا يمكن إلغاء طلب بعد IN_PROGRESS · Timeline يطابق `statusHistory` حرفيًا · التنبيهات الصفراء الخاصة بالدفع الكاش ظاهرة في 11، 12، 14.

**Dependencies:** Phase 5، 6.
**Definition of Done:** ما سبق + `PHASE_07_REVIEW.md`.

---

## Phase 8 — Order Lifecycle (Provider Side)

**الهدف:** لوحة تحكم المزوّد وإدارة الطلبات حتى الإكمال وتأكيد استلام المبلغ نقدًا.

**Features:** Dashboard بالإحصاءات والأرباح (تقرير للطلبات المكتملة كاش) واكتمال الملف · طلباتي بـ6 تبويبات وبحث وفلترة · قبول/رفض الطلب · تحديث الحالة (قيد التنفيذ / في الطريق / سأصل لاحقًا) · إكمال الطلب · **تأكيد استلام المبلغ** كشرط للإكمال · إدارة الخدمات ومناطق التغطية.

**Screens:** 24، 25، 26، 27، 28، 29.

**Backend/API:** `GET /provider/dashboard` · `PATCH /orders/:id/status` · `POST /orders/:id/complete` (يتطلب `cashReceivedConfirmed=true`) · CRUD `/provider/services`.

**Database:** تحديث `completedOrders` و`customersCount` بـ`$inc` عند الإكمال · Aggregation للأرباح والإحصاءات.

**Security:** المزوّد يرى/يعدّل طلباته فقط · التحقق من `verification.status === APPROVED` قبل أي إجراء · منع الإكمال بدون تأكيد الاستلام (على مستوى الـService لا الـUI).

**Testing:** وحدة: State Machine من جانب المزوّد + شرط الكاش · API: قبول/رفض/تحديث/إكمال + منع مزوّد آخر + منع غير المعتمد · E2E: طلب جديد ← قبول ← قيد التنفيذ ← في الطريق ← إكمال مع تأكيد الاستلام.

**Acceptance Criteria:** `POST /complete` بدون `cashReceivedConfirmed` يعيد 422 · لا يوجد أي كيان `Transaction` أو `Payment` في الكود · «في الطريق» بلا أي استدعاء موقع/GPS.

**Dependencies:** Phase 6، 7.
**Definition of Done:** ما سبق + `PHASE_08_REVIEW.md`.

---

## Phase 9 — Notifications, Reviews, Messaging & Account

**الهدف:** استكمال الأنظمة المساندة التي تربط الطرفين وتغلق الحلقة.

**Features:**
- **الإشعارات:** 10+ أنواع (تسجيل مزوّد، اعتماد/رفض، طلب جديد، قبول/رفض، تغيير حالة، إكمال، تقييم جديد، رسالة، عرض، نظام) · مقروء/غير مقروء · تجميع زمني · تبويبات · إعدادات · Deep links · Push عبر Capacitor (Phase 10).
- **التقييمات:** تقييم 1–5 + تعليق اختياري، **فقط لطلب COMPLETED يخص العميل ولم يُقيَّم من قبل** · تحديث `ratingAvg`/`ratingCount` ذريًا · عرضها في ملف المزوّد.
- **المراسلة:** Threads مرتبطة بالطلب + رسائل + غير مقروء + Polling (أو SSE).
- **الحساب:** عناويني (CRUD + افتراضي) · المفضلة · تعديل الملف · مركز المساعدة (FAQ + قنوات + تقييم الإفادة) · الإعدادات · تسجيل الخروج.

**Screens:** 15، 16، 17، 18 · شاشة كتابة التقييم (مشتقة) · المفضلة (مشتقة) · المحادثة (مشتقة).

**Backend/API:** `/notifications*` · `/orders/:id/review` · `/providers/:id/reviews` · `/threads*` · `/me/addresses*` · `/me/favorites*` · `/me/profile` · `/faqs*` · `/support/contact`.

**Security:** منع التقييم المكرر أو غير المرتبط بطلب مكتمل (فهرس فريد على `orderId`) · منع قراءة إشعارات/عناوين/رسائل مستخدم آخر · تنقية نص التعليقات والرسائل.

**Testing:** API: منع تقييم طلب غير مكتمل/لعميل آخر/مكرر · صحة حساب `ratingAvg` · IDOR على العناوين والإشعارات والرسائل · E2E: إكمال طلب ← إشعار للعميل ← كتابة تقييم ← ظهوره في ملف المزوّد.

**Acceptance Criteria:** كل انتقال حالة في Phase 7/8 يولّد الإشعار الصحيح للطرف الصحيح · «وسائل الدفع» في شاشة 16 عنصر معلوماتي فقط بلا أي بوابة.

**Dependencies:** Phase 7، 8.
**Definition of Done:** ما سبق + `PHASE_09_REVIEW.md`.

---

## Phase 10 — Admin Panel, Hardening, Android/PWA & Release

**الهدف:** لوحة إدارة كاملة، وتصلّب أمني وأدائي، وبناء Android AAB ونسخة PWA جاهزة للنشر.

**Features:**
- **Admin (Web responsive):** Dashboard · إدارة المستخدمين/العملاء/المزوّدين · **توثيق المزوّدين** مع عرض المستندات · **إدارة التصنيفات والمهن ومتطلبات المستندات** · الخدمات · الطلبات · التقييمات (إخفاء/حذف) · الإشعارات العامة · الإعدادات · `auditLogs`.
- **الأداء:** مراجعة `explain()` لكل استعلام · Bundle analysis · Lighthouse ≥90 (Performance/Accessibility/Best Practices) على الموبايل · Cloudinary transformations نهائية.
- **الأمان:** CSP نهائية · تدقيق شامل لـIDOR وPrivilege Escalation وNoSQL Injection ورفع الملفات · `npm audit` · مراجعة السجلات من التسريب.
- **Android:** Capacitor · Splash + Adaptive Icon من `logo.png` · StatusBar · Back button · Push Notifications · **AAB موقّع** + Play Store listing.
- **PWA:** manifest + Service Worker + safe-area لـiPhone + اختبار على 320/375/414/768.
- **📧 توصيل البريد (مُرحَّل من Phase 3 بقرار معتمد):** اختيار المزوّد (Resend / SendGrid / SMTP) وتنفيذ `sendViaProvider` في `src/server/lib/email.ts` + إضافة مفاتيحه في `env.ts` + جعلها إلزامية في الإنتاج + اختبار وصول بريد إعادة تعيين كلمة المرور فعليًا.
  > **حاجز إطلاق (Release Blocker):** بدونه لا يستطيع أي مستخدم استعادة حسابه. منطق إعادة التعيين نفسه مكتمل ومختبَر منذ Phase 3 — الناقص التوصيل فقط.
- **التوثيق:** README تشغيل ونشر · `.env.example` · دليل الإدارة.

**Screens:** كل شاشات Admin + مراجعة نهائية للشاشات الـ29 مقابل صورها المرجعية.

**Testing:** API لكل مسارات Admin + RBAC · E2E للرحلتين الكاملتين (عميل ومزوّد) + رحلة توثيق إدارية · اختبار Responsive على 5 مقاسات · اختبار البناء على جهاز/محاكي Android.

**Acceptance Criteria:**
1. AAB يُبنى ويُثبَّت ويعمل على Android بلا شاشات بيضاء.
2. PWA تعمل على Safari/iPhone مع احترام الـsafe areas.
3. Lighthouse Mobile ≥90 في Performance وAccessibility.
4. صفر ثغرات حرجة/عالية في التدقيق الأمني.
5. **الشاشات الـ29 كلها مربوطة فعليًا بالـBackend وقاعدة البيانات — لا صفحة ثابتة واحدة.**
6. **فحص سلبي نهائي يمرّ:** صفر نتائج في الكود و`package.json` لـ OTP · Google/Facebook/Apple Login · Stripe/PayPal/Paymob/Fawry/Visa/Mastercard · Payment Gateway/Checkout/Card Input · Wallet · payments/transactions/invoices · Google Maps/Mapbox/OpenStreetMap/Leaflet/Maps SDK · GPS/geolocation/Live Location/Tracking/ETA/Route/Distance · `lat`/`lng`/`coordinates`/`2dsphere`.
7. مراجعة بصرية نهائية للشاشات الـ29 واحدة واحدة مقابل صورها المرجعية.
8. **بريد إعادة تعيين كلمة المرور يصل فعليًا** إلى صندوق بريد حقيقي (حاجز إطلاق).

**Dependencies:** كل المراحل السابقة.
**Definition of Done:** كل ما سبق + `PHASE_10_REVIEW.md` + تقرير نهائي بحالة المشروع.

---

## بروتوكول المراجعة بعد كل مرحلة (إلزامي)

بعد كل Phase أنفّذ بالترتيب: تشغيل المشروع → `npm run typecheck` → `npm run lint` → `npm test` → `npm run build` → مراجعة UI مقابل الصور المرجعية → اختبار Responsive → مراجعة أمنية → مراجعة Database/API → مطابقة Acceptance Criteria → إصلاح كل ما يُكتشف → إعادة الاختبارات — ثم أُنشئ `PHASE_XX_REVIEW.md` يحتوي:
**What was implemented · Files changed · Tests executed · Test results · Build result · UI review · Security review · Issues found · Issues fixed · Remaining issues · Phase status.**
ولا أنتقل للمرحلة التالية إلا بعد موافقتك.

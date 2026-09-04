# PHASE_01_REVIEW.md — مراجعة المرحلة الأولى

> **الحالة النهائية: ✅ مكتملة (COMPLETED)**
> التاريخ: 2026-09-03 · المراجع: `PROJECT_PLAN.md § Phase 1`

---

## 1. What was implemented

### 1.1 أساس المشروع
- **Next.js 16.3.4** (App Router + Turbopack) · **React 19** · **TypeScript 5.7 strict**
  مع `noUncheckedIndexedAccess` و`noImplicitOverride` و`noFallthroughCasesInSwitch`.
- **Tailwind CSS 4** بإعداد CSS-first (`@theme`) بلا ملف `tailwind.config`.
- **TanStack Query v5** مهيّأ بـ`staleTime: 60s` و`refetchOnWindowFocus: false` (تقليل الطلبات).
- **Zod** جاهز للتحقق المشترك بين الواجهة والسيرفر.
- بنية المجلدات كاملة كما في `ARCHITECTURE.md §2`: `app/` · `components/` · `server/` · `shared/` · `lib/` · `styles/`.

### 1.2 نظام التصميم (Design Tokens)
كل القيم مستخرجة من الصور المرجعية الـ29 ومكتوبة في `src/styles/globals.css`:
- **28 لون** بما فيها `--color-brand-600: #1156e0` و`--color-bg: #f7f9fc` وألوان الحالات الست.
- **7 مقاسات خط** (28px عنوان شاشة ← 12px شارة) بخط **Cairo** (self-hosted عبر `next/font`).
- **Radius**: بطاقة 16px · حقل/زر 12px · pill.
- **الأبعاد**: حقل/زر 56px · Bottom Nav 72px · هيدر 90px · padding الصفحة 16px.
- **ظلال**: بطاقة · بطاقة hover · زر أساسي · شريط تنقّل.

### 1.3 مكتبة المكوّنات (20 مكوّنًا)
| المجموعة | المكوّنات |
|---|---|
| `ui/` | Button (7 أنواع × 3 مقاسات × loading/disabled) · Input (مع 👁 كلمة المرور) · Textarea · Select · Checkbox · Radio · Field (label + `*` + عدّاد + خطأ) · Card · SectionHeader · Badge · Chip · NotificationDot · Spinner · Skeleton (+ ServiceCard/OrderCard/List) |
| `common/` | InfoAlert (5 نغمات) · EmptyState (عادي + compact) · ErrorState · OrderStatusBadge · VerificationBadge · Stepper · OrderTimeline |
| `layout/` | AppHeader · BackHeader · BottomNav (عميل + مزوّد) · PageContainer · PageTitle · BrandMark |

### 1.4 RTL و Arabic-first
- `<html lang="ar" dir="rtl">` + `viewportFit: 'cover'` لاحترام safe areas على iPhone.
- **صفر خاصية `margin-left/right` أو `padding-left/right`** في المكوّنات — logical properties فقط (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`).
- أداة `.num` بـ`unicode-bidi: plaintext` لمنع قلب الأرقام داخل النص العربي.
- `BottomNav` يرسم من ثوابت مرتّبة بترتيب القراءة العربية — العنصر الأول يظهر يمينًا تلقائيًا.

### 1.5 دوال التنسيق (`src/lib/format.ts`)
18 دالة تنفّذ القاعدة المستخرجة من الصور: **أرقام لاتينية داخل نص عربي** عبر `ar-EG-u-nu-latn`.
تشمل: `formatPrice` (`150 ج.م`) · `formatPriceFrom` (`بيدأ من 150 ج.م`) · `formatRating` (`4.8`) · `formatPhone` (`010 1234 5678`) · `toE164Egypt` · `formatRelativeTime` (`منذ 10 دقائق` / `أمس`) · `pluralizeAr` + `pluralWordAr` (مفرد/مثنى/جمع) · `formatAddress` (نصي بحت).

### 1.6 أساس السيرفر
- `env.ts` — تحقق Zod عند الإقلاع، يفشل البناء عند نقص متغيّر إلزامي.
- `errors.ts` — `AppError` بفصل **رسالة المستخدم العربية** عن **رسالة السجل التقنية** + 10 مُنشئات مختصرة.
- `logger.ts` — سجل منظّم بتنقيح إجباري: مسح كامل لكلمات المرور والتوكنات، وتقنيع جزئي للهواتف والبُرد.
- `api-response.ts` — شكل استجابة موحّد `{success, data, meta}` / `{success, error}`.
- `with-error-handler.ts` — يلتقط Zod و`AppError` وأي عطل، ويضيف `X-Request-Id` لكل استجابة.
- `GET /api/v1/health` يعمل ويعيد الشكل الموحّد.

### 1.7 الأمن
رؤوس أمنية على كل استجابة عبر `next.config.ts`، **تم التحقق منها فعليًا** بـ`curl`:
```
Permissions-Policy: geolocation=(), camera=(self), microphone=(), payment=(), usb=(), ...
Content-Security-Policy: default-src 'self'; ... frame-ancestors 'none'; object-src 'none'
X-Content-Type-Options: nosniff · X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin · HSTS: max-age=63072000
```
- `img-src` مقصور على `res.cloudinary.com` · `remotePatterns` كذلك.
- `.env.example` بلا قيم حقيقية · `.gitignore` يستبعد كل ملفات env والـkeystore.

### 1.8 حارس القيود الآلي (`scripts/check-constraints.mjs`)
سكربت يفحص 44 ملفًا ضد **10 قواعد** في 4 فئات ويفشل البناء عند أي مخالفة:
| الفئة | القواعد |
|---|---|
| الدفع | `PAYMENT_SDK` · `PAYMENT_CARD` · `PAYMENT_ENTITY` |
| الخرائط والموقع | `MAPS_SDK` · `GEOLOCATION_API` · `GEO_FIELDS` · `TRACKING` |
| المصادقة | `OTP` · `SOCIAL_LOGIN` |
| الأسرار | `PUBLIC_SECRET` |

---

## 2. Files changed

**ملفات جديدة (44):**
```
package.json · tsconfig.json · next.config.ts · postcss.config.mjs
eslint.config.mjs · vitest.config.mts · .prettierrc.json · .env.example · .gitignore
scripts/check-constraints.mjs
public/logo.png

src/styles/globals.css
src/app/layout.tsx · providers.tsx · page.tsx · error.tsx · not-found.tsx
src/app/design-system/page.tsx
src/app/api/v1/health/route.ts

src/lib/cn.ts · format.ts · api-client.ts · query-keys.ts
src/shared/constants/roles.ts · order-status.ts · fayoum-areas.ts · navigation.ts
src/server/lib/env.ts · errors.ts · logger.ts · api-response.ts
src/server/middleware/with-error-handler.ts

src/components/ui/    button · spinner · field · input · textarea · select · checkbox · card · badge · skeleton
src/components/common/ info-alert · states · status-badge · stepper · order-timeline
src/components/layout/ brand-mark · app-header · back-header · bottom-nav · page-container

tests/setup.ts · tests/unit/format.test.ts · components.test.tsx · server.test.ts
```

---

## 3. Tests executed & results

```
Test Files  3 passed (3)
     Tests  60 passed (60)
  Duration  4.16s
```

| الملف | العدد | التغطية |
|---|---|---|
| `format.test.ts` | 28 | الأرقام اللاتينية · الأسعار · الهواتف · E.164 · التواريخ · الوقت النسبي · التعددية العربية · العنوان النصي |
| `components.test.tsx` | 21 | Button (loading/disabled/type) · Input (تبديل كلمة المرور، aria-invalid) · Field (`*`، خطأ، عدّاد) · **BottomNav (ترتيب RTL للدورين، aria-current، الشارات)** · StatusBadge (الحالات السبع) · Stepper (aria-current، ✓ للمنجز) |
| `server.test.ts` | 11 | تنقيح السجل (مسح/تقنيع/تداخل/عمق) · AppError (فصل الرسائل، الأكواد، أخطاء الحقول) · **اختبارات القيود** (طريقة الدفع الوحيدة، المناطق نصية بحتة) |

**اختبارات انحدار مضافة بعد اكتشاف أخطاء فعلية:** 5 (تفاصيلها في §7).

---

## 4. Build result

```
✓ Compiled successfully
✓ TypeScript — 0 errors
✓ Generating static pages (4/4)

Route (app)
┌ ○ /                 (Static)
├ ○ /_not-found       (Static)
├ ƒ /api/v1/health    (Dynamic)
└ ○ /design-system    (Static)
```

| الفحص | النتيجة |
|---|---|
| `tsc --noEmit` | ✅ PASS — 0 أخطاء |
| `eslint . --max-warnings=0` | ✅ PASS — 0 أخطاء، 0 تحذيرات |
| `check:constraints` | ✅ PASS — 44 ملف، 0 مخالفة |
| `vitest run` | ✅ PASS — 60/60 |
| `next build` | ✅ PASS |
| `npm audit` | ✅ **0 vulnerabilities** |

---

## 5. UI review

تمت المراجعة البصرية الفعلية في المتصفح على `/design-system` عند **320px · 375px · 414px**.

| البند | النتيجة |
|---|---|
| `dir="rtl"` · `lang="ar"` | ✅ مؤكّد برمجيًا |
| خط Cairo محمَّل | ✅ `Cairo, "IBM Plex Sans Arabic", system-ui…` |
| Tokens تُحلّ صحيحة | ✅ `--color-brand-600 = #1156e0` · `--radius-card = 1rem` · `--spacing-control = 3.5rem` |
| خلفية الصفحة | ✅ `rgb(247,249,252)` = `#F7F9FC` |
| **تجاوز أفقي** | ✅ **0px عند كل المقاسات** · صفر عنصر أعرض من المنفذ |
| ترتيب Bottom Nav (عميل) | ✅ التصنيفات · الإشعارات · الرئيسية · طلباتي · حسابي — من اليمين |
| ترتيب Bottom Nav (مزوّد) | ✅ الإشعارات · طلباتي · الرئيسية · الرسائل · حسابي |
| **اتجاه Stepper** | ✅ الخطوة 1 يمينًا والخطوة 4 يسارًا — مطابق للصور 11، 12، 19–22 |
| ألوان StatusBadge | ✅ جديد أزرق · قيد التنفيذ برتقالي · في الطريق بنفسجي · مكتمل أخضر · مرفوض/ملغي أحمر |
| اتجاه الحقول | ✅ Label يمينًا · `*` حمراء · أيقونة يمينًا · 👁/⌄ يسارًا · عدّاد يسارًا |
| OrderTimeline | ✅ ✓ أخضر للمنجز · ◉ أزرق للحالي · خط منقّط للقادم · التاريخ يسارًا |
| صفحة 404 | ✅ تعرض «الصفحة غير موجودة» بنفس نظام التصميم |

**أخطاء الـconsole:** الـ404 الوحيدة هي استباق Next لروابط `/home` · `/categories` · `/orders` · `/account` · `/notifications` — وهي مسارات تُبنى في المراحل 3 و5 و7 و9. **ليست عيبًا**؛ كل الأصول (الخطوط، الشعار، CSS، JS) تُحمَّل بـ200.

---

## 6. Security review

| البند | النتيجة |
|---|---|
| `geolocation=()` في `Permissions-Policy` | ✅ مؤكّد بـ`curl` على استجابة حية |
| `payment=()` في `Permissions-Policy` | ✅ مؤكّد |
| CSP مع `frame-ancestors 'none'` و`object-src 'none'` | ✅ مؤكّد |
| `img-src` مقصور على Cloudinary | ✅ |
| صفر سرّ خلف `NEXT_PUBLIC_` | ✅ يفحصه الحارس آليًا |
| تنقيح السجل | ✅ 5 اختبارات وحدة |
| فصل رسالة المستخدم عن رسالة السجل | ✅ اختبار يؤكد عدم تسرّب `MongoServerError` للعميل |
| `react/no-danger` مفعّلة كخطأ | ✅ |
| ثغرات الاعتماديات | ✅ **0** |

### قرار أمني اتُّخذ أثناء التنفيذ
`npm` حذّر أن **Next.js 15.1.3 يحمل ثغرة CVE-2025-66478**. بما أن المشروع Production-Ready، **رقّيت إلى Next 16.3.4** (أحدث مستقر ومُرقَّع) بدل البقاء على النسخة المصابة، ورقّيت معها ESLint 10 وVitest 4 وVite 8 لإزالة ثغرات `vite-node`. النتيجة: **0 ثغرات**.
> ⚠️ هذا انحراف عن `ARCHITECTURE.md §1` الذي ذكر Next 15. **يجب تحديث الملف** — مُدرج ضمن المتبقيات.

---

## 7. Issues found → Issues fixed

جميعها اكتُشفت أثناء المراجعة و**أُصلحت داخل هذه المرحلة**:

### 🔴 (1) تكرار الرقم في نص الخبرة — اكتشفه اختبار وحدة
`formatExperience(10)` أنتجت `"+10 10 سنوات خبرة"` لأن `pluralizeAr` تُعيد الرقم أصلًا.
**الإصلاح:** فصل `pluralWordAr` (المعدود بلا رقم) عن `pluralizeAr` (رقم + معدود)، وتصحيح قاعدة المفرد/المثنى: لا يُسبقان برقم («دقيقتين» لا «2 دقيقتين»).
**الاختبار:** 3 اختبارات انحدار.

### 🔴 (2) شارة حمراء فوق كل عناصر التنقّل الخمسة — اكتشفتها المراجعة البصرية
`NotificationDot` كانت ترسم نقطة صمّاء عندما يكون `count === undefined`، و`BottomNav` تمرّر `undefined` لكل عنصر بلا عدّاد.
**الإصلاح:** لا يُعرض شيء ما لم يُطلب صراحةً (`count > 0` أو `dot` صريح).
**التحقق:** الـHTML المُولَّد يحوي الآن **0** نقطة صمّاء و**4** عدّادات فقط (الجرس + عنصرَي التنقّل).
**الاختبار:** اختباران انحدار.

### 🟠 (3) صفحة معاينة التصميم غير قابلة للتوجيه
`src/app/_design/` — Next يعامل البادئة `_` كمجلد **خاص** مستبعد من التوجيه، فلم يظهر المسار في مخرجات البناء.
**الإصلاح:** أُعيدت التسمية إلى `design-system/` وتحدّث الرابط. المسار الآن ظاهر في جدول المسارات.

### 🟠 (4) تداخل نص الترويسة عند 320px
«الفيوم» كانت تتداخل مع «خدماتي الفيوم» في الترويسة على أضيق شاشة.
**الإصلاح:** الكتلة النصية للعلامة تُخفى تحت 380px (يبقى الشعار)، و`min-w-0` + `truncate` على منتقي المنطقة.
**التحقق:** لقطات عند 320 و414 — لا تداخل، و0px تجاوز أفقي.

### 🟠 (5) ثغرة في حارس القيود نفسه
اختبرت الحارس بملف مخالفات مصطنع فرصد 3 من 4 فقط: `"pk_live_stripe_test"` أفلت لأن `\b` **لا تحدّ عند الشرطة السفلية**.
**الإصلاح:** استُبدلت بـ`(?<![a-z0-9])…(?![a-z0-9])`.
**التحقق:** إعادة الاختبار ترصد **6 من 6** فئات (دفع · خرائط · geolocation · إحداثيات · OTP · سرّ مكشوف).

### 🟡 (6) إخفاق ESLint في الإقلاع
`FlatCompat` + `eslint-config-next@16` تعارضا (`Converting circular structure to JSON`)، ثم `eslint-plugin-react` المضمّن تعارض مع ESLint 10 في دالة كشف نسخة React.
**الإصلاح:** استيراد flat config مباشرة من `eslint-config-next/*` + تثبيت `settings.react.version = '19.0'` لتجاوز الكشف التلقائي.

### 🟡 (7) خطآن رصدهما ESLint بعد تشغيله
- `react-hooks/purity`: استدعاء `Date.now()` أثناء الرسم في صفحة المعاينة → استُبدل بتاريخين ثابتين.
- `no-unused-vars`: متغيّر `cause` غير مستخدم في `api-client.ts` → أُزيل.

### 🟡 (8) تحذير إعداد Vitest
`vitest.config.ts` بصيغة ESM داخل حزمة CommonJS → أُعيدت التسمية إلى `.mts`.

---

## 8. Remaining issues (تُعالَج في مراحل لاحقة)

| # | البند | الجهة |
|---|---|---|
| 1 | **تحديث `ARCHITECTURE.md`**: Next 15 → **16.3.4**، ESLint 10، Vitest 4، Vite 8 | فورًا قبل Phase 2 |
| 2 | CSP تحوي `'unsafe-inline'` لـ`script-src` (يتطلبه runtime الخاص بـNext) — تُشدَّد إلى nonce-based | Phase 10 |
| 3 | `/design-system` مكشوفة للعامة — تُقيَّد بـADMIN أو تُحذف قبل الإطلاق | Phase 10 |
| 4 | روابط Bottom Nav تشير لمسارات غير موجودة بعد (404 على الاستباق) | تُحل تلقائيًا في المراحل 3، 5، 7، 9 |
| 5 | `env.ts` يجعل `MONGODB_URI` و`JWT_*` و`CLOUDINARY_*` اختيارية | تصبح إلزامية في المراحل 2، 3، 4 |
| 6 | Rate limiting و`withAuth`/`withRole`/`withValidation` هياكل فقط | Phase 2 و3 |

### ✅ قرار تصميمي — مُغلق
**زر الرجوع في يسار الترويسة بسهم يشير لليسار**، كما هو مرسوم في كل الصور المرجعية.
عُرض البديل (نقله يمينًا ليطابق عُرف RTL على أندرويد وiOS) و**اعتمد صاحب المشروع الإبقاء على التصميم كما هو**.
القرار موثّق في `src/components/layout/back-header.tsx` ولا يُغيَّر بلا قرار جديد.

---

## 9. Acceptance Criteria — التحقق

| # | المعيار | النتيجة |
|---|---|---|
| 1 | `npm run dev` يعمل و`npm run build` ينجح | ✅ |
| 2 | `dir="rtl"` فعّال · صفر `margin-left/right` صريح في المكوّنات | ✅ |
| 3 | ألوان وقياسات Tokens مطابقة لـ`UI_ANALYSIS §1.1–1.3` | ✅ مؤكّدة برمجيًا في المتصفح |
| 4 | صفحة معاينة تعرض كل المكوّنات في حالاتها | ✅ `/design-system` |
| 5 | صفر تحذيرات TypeScript وصفر أخطاء ESLint | ✅ |

**Definition of Done:** بناء ناجح ✅ · typecheck ولint نظيفان ✅ · اختبارات خضراء (60/60) ✅ · مراجعة بصرية مقابل الصور ✅ · مراجعة أمنية ✅ · فحص القيود ✅ · تقرير المراجعة ✅

---

## 10. كيفية التشغيل

```bash
npm install
cp .env.example .env.local
npm run dev            # http://localhost:3000
npm run verify         # typecheck + lint + constraints + test + build
```
معاينة نظام التصميم: `http://localhost:3000/design-system`

# خدماتي الفيوم (Khadamaty Elfayoum)

منصة خدمات محلية تربط العملاء بمقدمي الخدمات في محافظة الفيوم — Next.js (App Router) + MongoDB + Cloudinary، عربي RTL أولًا.

**قيود تصميم غير قابلة للتفاوض** (مفروضة آليًا عبر `npm run check:constraints`):
- لا دفع إلكتروني داخل التطبيق — الدفع نقدًا مباشرة بين العميل ومقدم الخدمة خارج المنصة.
- لا خرائط ولا GPS ولا تتبّع موقع.
- لا OTP ولا تسجيل دخول اجتماعي — بريد/هاتف + كلمة مرور فقط، وتوثيق مقدمي الخدمة يدوي من الإدارة.

## المتطلبات

- Node.js ≥ 20
- حساب MongoDB Atlas (أو قاعدة تطوير محلية مؤقتة — انظر أدناه)
- حساب Cloudinary (لرفع المستندات والصور)
- (اختياري) حساب Resend لتفعيل إرسال بريد إعادة تعيين كلمة المرور فعليًا

## الإعداد

```bash
npm install
cp .env.example .env.local
```

املأ `.env.local` بالقيم الحقيقية. راجع التعليقات داخل الملف نفسه — كل مجموعة متغيرات موثّقة بالمرحلة التي تصبح فيها إلزامية.

## التشغيل محليًا

### الخيار أ — Atlas حقيقي

اضبط `MONGODB_URI` في `.env.local` على رابط Atlas، ثم:

```bash
npm run db:seed   # بيانات تطويرية واقعية للفيوم — لا تُشغَّل على الإنتاج أبدًا
npm run dev
```

### الخيار ب — قاعدة بيانات مؤقتة في الذاكرة (بلا Atlas)

مفيد للمعاينة السريعة بلا حساب سحابي. في نافذة طرفية:

```bash
npm run db:dev
```

يطبع رابط الاتصال ويُبقي العملية حيّة. في نافذة أخرى:

```bash
MONGODB_URI=mongodb://127.0.0.1:27077/ MONGODB_DB_NAME=khadamaty_dev npm run db:seed
MONGODB_URI=mongodb://127.0.0.1:27077/ MONGODB_DB_NAME=khadamaty_dev npm run dev
```

⚠️ البيانات مؤقتة وتزول عند إيقاف عملية `db:dev` — لا يوجد ملف قرص دائم لهذا الخيار.

## الأوامر

| الأمر | الوصف |
|---|---|
| `npm run dev` | خادم التطوير (Turbopack) |
| `npm run build` / `npm run start` | بناء وتشغيل نسخة الإنتاج |
| `npm run lint` | ESLint، صفر تحذيرات مسموحة |
| `npm run typecheck` | فحص أنواع TypeScript بلا بناء |
| `npm run test` / `npm run test:watch` | Vitest |
| `npm run check:constraints` | فحص آلي: لا دفع/خرائط/OTP، لا أسرار مكشوفة |
| `npm run check:cloudinary` | تحقق فعلي من صحة إعداد Cloudinary |
| `npm run verify` | يُشغّل كل ما سبق بالتسلسل — يُنصح به قبل أي Pull Request |

## البنية

- `src/app` — صفحات ومسارات API (Next.js App Router)، مقسّمة حسب المساحة: عميل، مزوّد (`/provider`)، إدارة (`/admin`)
- `src/server` — منطق الخادم: `services/` (قواعد العمل)، `repositories/` (الوصول لقاعدة البيانات)، `middleware/`، `db/models`
- `src/shared` — Zod schemas وثوابت مشتركة بين العميل والخادم
- `src/components` — مكوّنات واجهة، مقسّمة `ui/` (عناصر أساسية) و`common/` و`features/` و`layout/`
- `src/lib` — عملاء API وTanStack Query hooks على جانب العميل
- `src/proxy.ts` — حارس المسارات على مستوى الحافة (اصطلاح Next 16 لما كان يُسمّى middleware) — توجيه وCSP فقط، **لا** تفويضًا حقيقيًا (ذلك في كل route عبر `requireRole`/`requireAuth`)
- `scripts/` — سكربتات تطوير مستقلة (بذر، فحص قيود، فحص Cloudinary، قاعدة بيانات مؤقتة)
- `tests/` — Vitest: `tests/api` (تكامل عبر route handlers فعلية) و`tests/unit` (مكوّنات)

## الأمان

- مصادقة JWT بكوكيز `httpOnly`، وتجزئة كلمات المرور بـargon2id
- كل مدخلات الكتابة تُتحقّق بـZod `.strict()` — يمنع Mass assignment
- `mongoose.set('sanitizeFilter', true)` عامّ — يمنع حقن NoSQL عبر عوامل الاستعلام
- CSP قائم على nonce لكل طلب (`src/proxy.ts`) — بلا `unsafe-inline` في `script-src`
- كل إجراء إداري حسّاس يُسجَّل في سجل تدقيق (`/admin/audit-logs`)
- روابط المستندات المرفوعة موقّتة وموقّعة — لا تُخزَّن في التخزين المحلي للمتصفح
- `npm run check:constraints` يفشل الـbuild إذا وُجد سرّ مكسوف أو مخالفة للقيود المعمارية

## البريد الإلكتروني (Resend)

يُستخدم البريد **فقط** لإعادة تعيين كلمة المرور. بلا `RESEND_API_KEY`/`RESEND_FROM_EMAIL` يعمل النظام في وضع «تسجيل فقط» (رابط إعادة التعيين يظهر في سجلات الخادم — مفيد للتطوير). لتفعيل الإرسال الفعلي أضِف المتغيرين في `.env.local` أو بيئة الإنتاج — بلا أي تعديل كود. التفاصيل في `src/server/lib/email.ts`.

## تطبيق أندرويد (Capacitor)

`android/` غلاف WebView أصلي حول التطبيق المنشور — وليس تصديرًا ساكنًا (`next export`)، لأن التطبيق يعتمد على SSR ومسارات API. اضبط `server.url` في `capacitor.config.ts` على رابط الإنتاج الفعلي، ثم:

```bash
npx cap sync android
npx cap open android   # يفتح Android Studio لبناء AAB موقّع
```

يتطلب بناء AAB فعليًا JDK وAndroid SDK مثبَّتين (`ANDROID_HOME`) — غير متاحين في بيئة هذا التطوير، والبناء لم يُختبر فعليًا لهذا السبب. التفاصيل والحالة في `PHASE_10_REVIEW.md`.

## PWA

`manifest.webmanifest` (يُولَّد من `src/app/manifest.ts`) وservice worker خفيف (`public/sw.js`) يخزّن غلاف التطبيق فقط — لا استجابات API أبدًا. صفحة أوفلاين بسيطة عند `public/offline.html`.

## قبل الإنتاج

راجع `PRE_PRODUCTION_CHECKLIST.md` — يشمل بنودًا لم تُختبر فعليًا في بيئة التطوير (رفع Cloudinary حيّ، بيانات البذر التجريبية) ويجب التحقق منها يدويًا قبل أول نشر.

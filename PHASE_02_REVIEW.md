# PHASE_02_REVIEW.md — مراجعة المرحلة الثانية

> **الحالة النهائية: ✅ مكتملة (COMPLETED)**
> التاريخ: 2026-09-03 · المرجع: `PROJECT_PLAN.md § Phase 2`

---

## 1. What was implemented

### 1.1 اتصال MongoDB Atlas
`src/server/db/mongoose.ts` — اتصال مخزّن عبر `globalThis` يمنع استنزاف تجمّع اتصالات Atlas مع Hot Reload و serverless. يتبنّى أي اتصال قائم (اختبارات/سكربتات) بدل فتح ثانٍ. مفعّل عليه:
- `sanitizeFilter: true` — يجرّد مُعاملات `$` من كل استعلام (حماية حقن NoSQL على مستوى Mongoose كله).
- `strictQuery: true` · حدود تجمّع مناسبة لـ Atlas M0/M10 · `autoIndex` معطّل في الإنتاج.

### 1.2 المجموعات الـ15
| # | Collection | أبرز ما فيها |
|---|---|---|
| 1 | `users` | `passwordHash` و`refreshTokens` بـ`select: false` · قفل بعد المحاولات الفاشلة · هاتف E.164 مصري |
| 2 | `serviceProviders` | حالة التوثيق · `isActive` افتراضيًا `false` · فهرس نصي · عدّادات مشتقة |
| 3 | `categories` | slug فريد · عدّاد خدمات |
| 4 | `professions` | **مفاتيح التحكم الثلاثة + قائمة المستندات + فرض الاتساق** |
| 5 | `services` | أسعار للعرض · فهرس نصي · مناطق نصية |
| 6 | `serviceRequests` | `paymentMethod` بقيمة واحدة · `cashReceivedConfirmed` · `statusHistory` · عنوان نصي |
| 7 | `providerDocuments` | يفرض `accessMode: authenticated` · فهرس فريد لكل متطلّب |
| 8 | `reviews` | **فهرس فريد على `orderId`** يمنع التقييم المكرر على مستوى القاعدة |
| 9 | `favorites` | مزوّد أو خدمة — أحدهما بالضبط |
| 10 | `addresses` | نصي بحت · عنوان افتراضي واحد بـ`partialFilterExpression` |
| 11 | `notifications` | 15 نوعًا · TTL 180 يومًا · `actionUrl` داخلي فقط |
| 12 | `messages/threads` | مرتبطة بطلب · مشاركان بالضبط · منع الإرسال للنفس |
| 13 | `settings` | مفتاح فريد |
| 14 | `auditLogs` | 8 إجراءات · TTL سنتان |
| 15 | `faqs` | 6 مواضيع · فهرس نصي |

**الفهارس:** 40+ فهرسًا مركّبًا مطابقًا لأنماط الاستعلام المخططة في Phase 5 و7 و8، وكلها **تُنشأ فعليًا** ويتحقق منها اختبار مستقل عبر `collection.indexes()`.

### 1.3 محرّك المستندات الديناميكية
`src/shared/constants/documents.ts` + `profession.model.ts`:
- ثلاثة مفاتيح تحكم: `professionKind` · `requiresQualification` · `requiresLicense`.
- `buildDocumentRequirements()` يبني القائمة من المفاتيح.
- `validateRequirementsConsistency()` يرصد 6 أنواع مخالفات.
- **`pre('validate')` يفرض القاعدة على مستوى قاعدة البيانات** — فلا يستطيع أي مسار (Admin أو seed أو سكربت) حفظ مهنة غير متسقة.
- `GET /professions/:id/document-requirements` هو المصدر الوحيد للواجهة — **صفر قائمة ثابتة في الكود**.

### 1.4 المخططات والتحقق
`src/shared/schemas/` — كل مخطط `.strict()`:
- `egyptPhoneSchema` يطبّع كل الصيغ إلى E.164 · `passwordSchema` (8+ حرف + رقم، حد أعلى 128 لمنع DoS على التجزئة).
- `textAddressSchema` يقبل مناطق الفيوم فقط و**يرفض أي حقل إحداثيات**.
- `paginationSchema` بحد أقصى 50 لكل صفحة.

### 1.5 الطبقات الوسيطة
- `with-validation.ts` — `validateBody/Query/Params` + **`assertNoOperatorKeys`** يرفض مفاتيح `$` و`.` و`__proto__` بعمق 8 مستويات.
- `with-rate-limit.ts` — 4 قواعد (auth 5/د · write 30/د · read 120/د · upload 20/د) مع تنظيف دوري.
- `with-auth.ts` — `requireAuth` / `requireRole` / **`assertOwnership`** (يرمي **404 لا 403** لمنع كشف وجود المورد).

### 1.6 المستودعات والخدمات والـAPI
`catalog.repository.ts` → `catalog.service.ts` → 4 مسارات:
`GET /categories` · `GET /categories/:slug` · `GET /professions` · `GET /professions/:id/document-requirements`
الخدمات تحوّل إلى **DTO نظيف** — لا `_id` ولا `__v` ولا حقول داخلية.

### 1.7 البذر
`seed/data.ts` + `seed/seed.ts` + `scripts/seed.mts`:
9 تصنيفات · 18 مهنة (12 حرفية + 6 منظَّمة) · 22 مستخدمًا ومزوّدًا · 40 خدمة · 6 أسئلة · 5 إعدادات.
يستخدم `create()` لا `insertMany()` للمهن **عمدًا** حتى يعمل hook فرض الاتساق.

### 1.8 الربط بالواجهة
`src/lib/queries/catalog.ts` (3 hooks) + صفحة `/design-system/data` التي تثبت المسار الكامل:
**MongoDB → Repository → Service → API → TanStack Query → UI**

---

## 2. Files changed

**جديد (30):**
```
src/server/db/mongoose.ts
src/server/db/models/  shared · user · service-provider · category · profession · service
                       service-request · provider-document · review · favorite · address
                       notification · message · misc · index          (15 ملفًا)
src/server/db/seed/    data.ts · seed.ts
src/server/repositories/catalog.repository.ts
src/server/services/catalog.service.ts
src/server/middleware/  with-validation · with-rate-limit · with-auth
src/shared/constants/   documents.ts · notifications.ts
src/shared/schemas/     common.schema.ts · catalog.schema.ts
src/app/api/v1/         categories/route · categories/[slug]/route
                        professions/route · professions/[id]/document-requirements/route
src/lib/queries/catalog.ts
src/components/common/file-hint.tsx
src/app/design-system/data/page.tsx
scripts/seed.mts · scripts/dev-db.mjs
tests/helpers/db.ts · tests/db/models.test.ts · tests/db/seed.test.ts
tests/api/catalog.test.ts · tests/unit/validation.test.ts
```

**معدّل (5):** `package.json` (mongoose · mongodb-memory-server · tsx · dotenv + سكربتان) · `vitest.config.mts` (مهلات) · `eslint.config.mjs` (`.mts` في استثناء console) · `.gitignore` · `tests/helpers/db.ts`

---

## 3. Tests executed & results

```
Test Files  7 passed (7)
     Tests  179 passed (179)
```

| الملف | العدد | التغطية |
|---|---|---|
| `db/models.test.ts` | 48 | المجموعات الـ15 · **التحقق السلبي** (صفر مجموعة مالية، صفر حقل إحداثيات، صفر فهرس 2dsphere، طريقة دفع واحدة) · `passwordHash` لا يخرج · محرّك المستندات (6 حالات) · قواعد الطلب · MediaRef يرفض غير Cloudinary |
| `db/seed.test.ts` | 14 | معايير القبول · القالبان · مناطق الفيوم فقط · المزوّدون غير المعتمدين بلا خدمات · **الفهارس تُنشأ فعليًا** |
| `api/catalog.test.ts` | 19 | الشكل الموحّد · `X-Request-Id` · DTO نظيف · رفض strict · 404 · **المستندات الديناميكية لخمس مهن** · تحديد المعدّل (429) |
| `unit/validation.test.ts` | 41 | **حقن NoSQL** (6) · strict · الهاتف · كلمة المرور · العنوان النصي · الترقيم · **حُرّاس التفويض وIDOR** (5) · قاعدة الاتساق (6) |
| `unit/format.test.ts` | 31 | (Phase 1) |
| `unit/components.test.tsx` | 21 | (Phase 1) |
| `unit/server.test.ts` | 11 | (Phase 1) |

### تحقق حيّ على قاعدة بيانات حقيقية
بُذرت قاعدة فعلية وشُغّل الخادم واختُبرت المسارات بـ`curl`:
```
سبّاك        | مؤهل: false | ترخيص: false | 3 مستندات (2 مطلوب + 1 اختياري)
كهربائي      | مؤهل: false | ترخيص: false | 3 مستندات
طبيب         | مؤهل: true  | ترخيص: true  | 5 مستندات (4 مطلوب + 1 اختياري)
محامٍ        | مؤهل: true  | ترخيص: true  | 5 مستندات
مدرّس خصوصي  | مؤهل: true  | ترخيص: false | 4 مستندات — بلا رخصة مزاولة
```

---

## 4. Build result

| الفحص | النتيجة |
|---|---|
| `tsc --noEmit` | ✅ PASS — 0 أخطاء |
| `eslint --max-warnings=0` | ✅ PASS — 0 أخطاء، 0 تحذيرات |
| `check:constraints` | ✅ PASS — **79 ملفًا، 0 مخالفة** |
| `vitest run` | ✅ PASS — 179/179 |
| `next build` | ✅ PASS — 9 مسارات |
| `npm audit` | ✅ **0 vulnerabilities** |

---

## 5. UI review

مراجعة بصرية على `/design-system/data` عند 375px ببيانات حقيقية:

| البند | النتيجة |
|---|---|
| التصنيفات التسعة من قاعدة البيانات | ✅ بعدّاداتها الصحيحة |
| **صيغة المثنى العربية** | ✅ «خدمتان» لا «2 خدمات» |
| تسلسل التصنيف ← المهنة | ✅ اختيار التصنيف يعيد بناء قائمة المهن |
| **المستندات الديناميكية** | ✅ اختيار «طبيب» يعرض 5 مستندات مع شارتَي «يتطلب مؤهلًا» و«يتطلب ترخيصًا» |
| Skeletons أثناء التحميل | ✅ بأبعاد العناصر الحقيقية |
| تجاوز أفقي | ✅ **0px** · صفر عنصر أعرض من المنفذ |

**أخطاء الـconsole:** 404 على `/home` · `/categories` · `/orders` · `/account` · `/notifications` — استباق Next لروابط التنقّل التي تُبنى في المراحل 3 و5 و7 و9. لا علاقة لها بـPhase 2.

---

## 6. Security review

| البند | النتيجة |
|---|---|
| `passwordHash` بـ`select: false` | ✅ لا يخرج في `find` ولا `lean` — يُطلب صراحةً فقط |
| `refreshTokens` بـ`select: false` | ✅ |
| حقن NoSQL — طبقتان | ✅ `sanitizeFilter` في Mongoose + `assertNoOperatorKeys` قبل Zod |
| Mass-assignment | ✅ كل مخطط `.strict()` — `role` و`status` لا يمرّان |
| تلويث الـprototype | ✅ `__proto__` و`constructor` مرفوضان |
| IDOR | ✅ `assertOwnership` يرمي **404 لا 403** |
| المستندات الحسّاسة | ✅ يُرفض حفظها بوضع `public` |
| MediaRef | ✅ يرفض أي رابط من خارج `res.cloudinary.com` |
| `actionUrl` في الإشعارات | ✅ مسارات داخلية فقط (منع تصيّد) |
| تحديد المعدّل | ✅ 4 قواعد + اختبار 429 حيّ |
| التقييم المكرر | ✅ فهرس فريد على مستوى القاعدة |
| ثغرات الاعتماديات | ✅ **0** |

### التحقق السلبي (اختبارات آلية)
- صفر مجموعة `payments`/`transactions`/`invoices`/`wallets`.
- صفر حقل `lat`/`lng`/`latitude`/`longitude`/`coordinates`/`location`/`geo` في أي Schema.
- صفر فهرس `2dsphere` أو `2d` في أي مجموعة (يُفحص على قاعدة حيّة).
- `paymentMethod.enumValues` = `['CASH_ON_DELIVERY_OFFLINE']` — قيمة واحدة لا غير.
- كل مناطق التغطية المبذورة من قائمة الفيوم النصية.

---

## 7. Issues found → Issues fixed

### 🔴 (1) Mongoose 9 غيّر واجهة الـmiddleware — 31 اختبارًا فاشلًا
document hooks لم تعد تتلقى `next` callback؛ الصيغة الآن async ترمي الخطأ. كل الـ8 hooks كانت تستدعي `next()` فتفشل بـ`next is not a function`.
**الإصلاح:** تحويل الثمانية إلى `async function` ترمي `Error`.
**النتيجة:** 47/48 ثم 48/48.

### 🔴 (2) `connectToDatabase` تعطّل كل اختبارات الـAPI — 13 اختبارًا فاشلًا
كانت تطالب بـ`MONGODB_URI` رغم أن mongoose متصل فعلًا بقاعدة الاختبار في الذاكرة، فأعادت كل المسارات 500.
**الإصلاح:** تتبنّى الاتصال القائم عند `readyState === 1` (وتنتظره عند 2). سلوك صحيح للإنتاج أيضًا — يمنع فتح اتصال ثانٍ.
**النتيجة:** 19/19.

### 🟠 (3) `safeStringSchema.max` غير موجودة — تعطّل استيراد الوحدة
`.refine()` تُنتج ZodEffects التي لا تملك `.max()`، فانهار ملف الاختبار كله عند الاستيراد.
**الإصلاح:** تحويلها إلى دالة مصنع `safeString(max)` تطبّق الحد **قبل** التنقية.

### 🟠 (4) خطأ اتجاه ثنائي (BiDi) في نص قيود الملف — رصدته المراجعة البصرية
`JPG, PNG حتى 5MB` كان يُعرض `JPG, PNG 5 حتىMB` لأن محرك BiDi يعيد ترتيب المقاطع اللاتينية داخل الجملة العربية.
**الإصلاح:** مكوّن `FileHint` يعزل كل مقطع لاتيني بعنصر `<bdi>`.
**لماذا مكوّن لا إصلاح موضعي:** هذا النص يظهر في 5 بطاقات في شاشة المستندات (Phase 4)؛ المكوّن يمنع تكرار الخطأ.
**التحقق:** الصفحة الحيّة تعرض `JPG، PNG، WEBP، PDF حتى 5MB` صحيحًا مع 10 عناصر `<bdi>`.

### 🟡 (5) `--experimental-strip-types` لا يحلّ مسار `@/*`
سكربت البذر فشل بـ`Cannot find package '@/server'`.
**الإصلاح:** استخدام `tsx` الذي يحترم `tsconfig.paths`.

### 🟡 (6) خطأ في الاختبار نفسه
اختبار تفرّد رقم الطلب استدعى `baseOrder()` مرتين فأنشأ تصنيفًا مكررًا وفشل بالسبب الخطأ.
**الإصلاح:** بناء الحمولة مرة واحدة وإعادة استخدامها، مع تأكيد رسالة الخطأ الصحيحة.

### 🟡 (7) 3 مشاكل lint
`.mts` غير مشمول في استثناء `no-console` · توجيه `eslint-disable` زائد · استيراد غير مستخدم.

---

## 8. Remaining issues (مراحل لاحقة)

| # | البند | الجهة |
|---|---|---|
| 1 | `getSession` تُرجع `null` — الجلسة تُستخرج من JWT | Phase 3 |
| 2 | `MONGODB_URI` اختياري في `env.ts` — يصبح إلزاميًا | Phase 3 |
| 3 | تحديد المعدّل في الذاكرة — يُستبدل بـRedis للنشر متعدد النسخ | Phase 10 |
| 4 | `includeInactive` في `/categories` معطّل حتى يوجد حارس ADMIN | Phase 6 |
| 5 | كلمات مرور البذر نصوص وهمية — التجزئة argon2id | Phase 3 |
| 6 | لا يوجد Atlas حقيقي بعد — التطوير على `npm run db:dev` | عند توفير الرابط |

### ⚠️ ما تحتاج توفيره قبل الإنتاج
المشروع يعمل حاليًا على **قاعدة بيانات مؤقتة في الذاكرة** (`npm run db:dev`) لأنه لا يوجد رابط Atlas. للانتقال للتطوير الحقيقي:
1. أنشئ عنقودًا على MongoDB Atlas (M0 مجاني يكفي للتطوير).
2. ضع الرابط في `.env.local` تحت `MONGODB_URI`.
3. شغّل `npm run db:seed`.
لا يعطّل هذا أي شيء في Phase 2 — كل الاختبارات تعمل بلا Atlas.

---

## 9. Acceptance Criteria — التحقق

| # | المعيار | النتيجة |
|---|---|---|
| 1 | كل Index يُنشأ فعليًا (تحقق بـ`getIndexes`) | ✅ اختبار مستقل يفحص 6 مجموعات |
| 2 | Seed ≥9 تصنيفات | ✅ **9** |
| 3 | Seed ≥14 مهنة على القالبين | ✅ **18** (12 حرفية + 6 منظَّمة) |
| 4 | Seed ≥20 مزوّدًا | ✅ **22** |
| 5 | Seed ≥40 خدمة في مناطق الفيوم | ✅ **40** — كلها من القائمة النصية |
| 6 | لا استعلام يعيد `passwordHash` | ✅ 3 اختبارات (find · lean · seed) |
| 7 | صفر مجموعة مالية وصفر حقل جغرافي | ✅ 4 اختبارات تحقق سلبي |

**Definition of Done:** الاتصال ناجح ✅ · كل الاختبارات خضراء (179/179) ✅ · بناء نظيف ✅ · مراجعة أمنية ✅ · فحص القيود ✅ · تحقق حيّ على قاعدة حقيقية ✅ · تقرير المراجعة ✅

---

## 10. كيفية التشغيل

```bash
npm install
```

**للتطوير بلا Atlas** (قاعدة مؤقتة في الذاكرة):
```bash
npm run db:dev
```
ثم في نافذة أخرى، ضع `MONGODB_URI=mongodb://127.0.0.1:27077/` في `.env.local` و:
```bash
npm run db:seed && npm run dev
```

**سلسلة الفحص الكاملة:**
```bash
npm run verify
```

صفحة تحقّق البيانات: `http://localhost:3000/design-system/data`

# ARCHITECTURE.md — معمارية «خدماتي الفيوم»

## 0. قواعد ملزمة عابرة للمعمارية (NON-NEGOTIABLE)

**0.1 الدفع — لا دفع إلكتروني نهائيًا.** ممنوع في الكود والمعمارية: Online Payment · Payment Gateway · Visa/Mastercard · Stripe · PayPal · Paymob · Fawry · Wallet Payment · Card Input · Checkout · Payment Transactions · أي Collection أو Model أو Service أو endpoint باسم `payments` / `transactions` / `invoices` / `wallets` · أي SDK أو مكتبة دفع في `package.json`.
المسموح فقط: حقل `agreedPrice` للعرض، و`paymentMethod` بقيمة واحدة ثابتة `CASH_ON_DELIVERY_OFFLINE`، و**علامة حالة** `cashReceivedConfirmed: Boolean` تسجّل أن المزوّد أكّد استلام المبلغ نقدًا — بلا أي حركة مالية داخل النظام. الدفع يتم مباشرة بين العميل ومقدم الخدمة **خارج التطبيق**.

**0.2 الخرائط والموقع — لا مكوّن جغرافي نهائيًا.** ممنوع: Google Maps · Mapbox · OpenStreetMap · أي Maps SDK/API · GPS · Live Location · Location Tracking · ETA · Route · Distance calculation · أي تتبّع لأي طرف · أي حقل `lat`/`lng`/`coordinates`/`GeoJSON` · أي فهرس `2dsphere` · أي استدعاء لـ`navigator.geolocation` (مُعطَّل صراحةً عبر `Permissions-Policy: geolocation=()`).
المسموح فقط: عنوان **نصي** — `governorate` / `city` / `area` / `line` / `landmark` / `postalCode`، والاختيار من **قائمة ثابتة لمناطق الفيوم** في `src/shared/constants/fayoum-areas.ts`.

هاتان القاعدتان تُفحصان آليًا في CI عبر قاعدة ESLint مخصّصة + فحص `grep` على الكلمات المحظورة، ويفشل البناء عند أي مخالفة.

---

## 1. الملخص التقني

| البند | الاختيار |
|---|---|
| اللغة | TypeScript 5.7 (strict + `noUncheckedIndexedAccess`) — Frontend + Backend |
| Framework | **Next.js 16.3.4 (App Router + Turbopack)** — SSR/RSC + API Routes (Node runtime) |
| UI | React 19 + Tailwind CSS 4 (CSS-first `@theme`، RTL logical properties) + lucide-react |
| الخطوط | Cairo (self-hosted عبر `next/font/google`) |
| State | Zustand (UI/session) + TanStack Query v5 (server state, cache, pagination) |
| Forms | React Hook Form + Zod (نفس الـschema يُعاد استخدامه في الـAPI) |
| Database | **MongoDB Atlas** + Mongoose 8 |
| Media | **Cloudinary** — رفع موقّع (Signed Upload) من المتصفح، والسيرفر لا يمرّر الملفات |
| Auth | JWT (Access 15د + Refresh 30ي) في **httpOnly / Secure / SameSite=Lax cookies** + argon2id |
| Android | **Capacitor 6** يغلّف نفس الـWeb build → AAB لـ Google Play |
| iPhone | **PWA Responsive** (نفس الكود) — لا App Store |
| Testing | Vitest 4 + Vite 8 + Testing Library (unit) · `next-test-api-route-handler` (API) · Playwright (E2E) · mongodb-memory-server |
| Lint/Format | ESLint 10 (flat config من `eslint-config-next/*`) + Prettier 3 |
| حارس القيود | `scripts/check-constraints.mjs` — 10 قواعد تفشل البناء عند أي مخالفة للقسم §0 |
| CI | GitHub Actions: typecheck → lint → test → build |
| Hosting | Web: Vercel أو VPS (Node 20) · DB: MongoDB Atlas · Media: Cloudinary |

**لماذا Next.js + Capacitor بدلًا من React Native؟** الصور كلها Mobile Web Layout قابل للتنفيذ 1:1 بـCSS، والمطلوب نسختان (Android APK/AAB + iPhone Web) من **قاعدة كود واحدة** مع Backend في نفس المشروع. Capacitor يعطي تطبيق Android حقيقي قابل للنشر على Google Play مع Native Splash/StatusBar/Push.

---

## 2. بنية المشروع

```
khadamaty-elfayoum/
├─ src/
│  ├─ app/
│  │  ├─ (auth)/            login · register · register/provider · forgot-password · reset-password
│  │  ├─ (customer)/        home · search · categories · categories/[slug] · providers/[id]
│  │  │                     request/[providerId] · orders · orders/[id] · orders/[id]/review
│  │  │                     notifications · account · account/addresses · account/favorites · help
│  │  ├─ (provider)/        dashboard · orders · orders/[id] · orders/[id]/status
│  │  │                     orders/[id]/complete · profile · services · reviews · pending-review
│  │  ├─ (admin)/           dashboard · providers · providers/[id] · categories · professions
│  │  │                     orders · users · reviews · settings
│  │  ├─ api/               ← كل الـREST endpoints
│  │  ├─ onboarding/ · role-select/ · layout.tsx (dir=rtl) · not-found.tsx · error.tsx
│  ├─ components/
│  │  ├─ ui/                Button · Input · Select · Textarea · Checkbox · Radio · Chip
│  │  │                     Card · Badge · Modal · Sheet · Toast · Skeleton · Spinner
│  │  ├─ layout/            AppHeader · BackHeader · BottomNav · PageContainer · SafeArea
│  │  ├─ common/            EmptyState · ErrorState · InfoAlert · Stepper · StatusBadge
│  │  │                     OrderTimeline · StatusStepperH · Pagination · ImageUploader
│  │  └─ features/          home/ · categories/ · providers/ · orders/ · notifications/
│  │                        account/ · provider-register/ · provider-dashboard/ · admin/
│  ├─ server/
│  │  ├─ db/                mongoose.ts (cached connection) · models/*.ts · indexes.ts · seed/
│  │  ├─ services/          auth · users · providers · categories · professions · services
│  │  │                     orders · reviews · notifications · favorites · addresses · documents
│  │  ├─ repositories/      طبقة الوصول للبيانات (تعزل Mongoose عن الـservices)
│  │  ├─ middleware/        withAuth · withRole · withValidation · withRateLimit · withErrorHandler
│  │  ├─ lib/               jwt.ts · password.ts · cloudinary.ts · logger.ts · errors.ts · env.ts
│  │  └─ policies/          order-state-machine.ts · access-control.ts (IDOR guards)
│  ├─ shared/               schemas/ (Zod) · types/ · constants/ (enums, statuses, fayoum-areas)
│  ├─ lib/                  api-client.ts · query-keys.ts · format.ts (أرقام/تواريخ/عملة)
│  └─ styles/               globals.css (tokens) · tailwind preset
├─ android/                 ← Capacitor (يُولَّد)
├─ public/                  logo.png · icons · illustrations · manifest.webmanifest
├─ tests/                   unit/ · api/ · e2e/
├─ .env.example · capacitor.config.ts · next.config.ts · tailwind.config.ts
└─ UI_ANALYSIS.md · ARCHITECTURE.md · PROJECT_PLAN.md · PHASE_XX_REVIEW.md
```

---

## 3. نموذج البيانات (MongoDB Atlas) — **15 Collection**

| # | Collection | الغرض |
|---|---|---|
| 1 | `users` | كل المستخدمين بأدوارهم الثلاثة |
| 2 | `serviceProviders` | ملف مقدم الخدمة + حالة التوثيق |
| 3 | `categories` | التصنيفات الرئيسية |
| 4 | `professions` | المهن + **إعدادات المستندات الديناميكية** |
| 5 | `services` | خدمات المزوّدين وأسعارها |
| 6 | `serviceRequests` | الطلبات ودورة حياتها |
| 7 | `providerDocuments` | المستندات المرفوعة وحالة مراجعتها |
| 8 | `reviews` | التقييمات |
| 9 | `favorites` | المفضلة |
| 10 | `addresses` | عناوين العميل (نصية) |
| 11 | `notifications` | الإشعارات |
| 12 | `messages/threads` | المراسلة (`threads` + `messages` كوحدة واحدة) |
| 13 | `settings` | إعدادات عامة يديرها Admin |
| 14 | `auditLogs` | سجل الإجراءات الحسّاسة |
| 15 | `faqs` | الأسئلة الشائعة لمركز المساعدة |

### الاصطلاحات العامة
- `timestamps: true` على كل Collection · `_id` من نوع ObjectId · Soft delete عبر `deletedAt` حيث يلزم.
- **لا تُخزَّن أي صورة كـBinary/Base64 في MongoDB** — فقط `{ publicId, url, format, bytes, width, height }`.
- كل Enum معرّف مرة واحدة في `src/shared/constants` ومستخدم في Mongoose + Zod معًا.

### 3.1 `users`
```
{ _id, role: 'CUSTOMER'|'PROVIDER'|'ADMIN',
  fullName, phone (E.164, unique sparse), email (lowercase, unique sparse),
  passwordHash, avatar: MediaRef?,
  status: 'ACTIVE'|'SUSPENDED'|'PENDING_REVIEW'|'REJECTED',
  phoneVerified: false, emailVerified: false,      // بدون OTP — التوثيق يدوي من Admin
  gender?: 'MALE'|'FEMALE', birthDate?,
  governorate, city, area,                          // نص فقط — لا إحداثيات
  lastLoginAt, failedLoginAttempts, lockedUntil,
  refreshTokenHashes: [{ hash, ua, createdAt, expiresAt }] }
Indexes: {phone:1} unique sparse · {email:1} unique sparse · {role:1,status:1} · {area:1}
Rule: كل استعلام يخرج للـclient يمرّ عبر projection يستبعد passwordHash و refreshTokenHashes.
```

### 3.2 `serviceProviders` (1—1 مع user دوره PROVIDER)
```
{ userId (unique, ref users), accountType: 'INDIVIDUAL'|'COMPANY',
  displayName, categoryId, professionId, yearsOfExperience,
  bio (≤300), highlights: [String] (≤200 لكل عنصر),
  coverageAreas: [String],                          // مناطق الفيوم نصًا
  priceMode: 'RANGE'|'LATER', priceMin?, priceMax?, currency: 'EGP',
  gallery: [MediaRef] (≤12),
  verification: { status: 'PENDING_REVIEW'|'APPROVED'|'REJECTED'|'RESUBMISSION_REQUIRED',
                  submittedAt, reviewedAt, reviewedBy, rejectionReason?, requestNumber },
  isVerifiedBadge: Boolean, isActive: Boolean,
  ratingAvg: 0, ratingCount: 0, completedOrders: 0, customersCount: 0,
  avgResponseMinutes?, memberSince, profileCompletion: 0..100 }
Indexes: {userId:1} unique · {categoryId:1, professionId:1, isActive:1}
        · {coverageAreas:1} · {ratingAvg:-1} · {'verification.status':1}
        · Text index على displayName + bio
```

### 3.3 `categories` / `professions`
```
categories:  { name, slug (unique), description, icon, color, order, isActive, servicesCount }

professions: { categoryId, name, slug, icon, isActive, order, servicesCount,

  // ── مفاتيح التحكم عالية المستوى (يضبطها Admin) ──
  professionKind: 'CRAFT' | 'REGULATED',   // حرفية | منظَّمة — للتصنيف والتقارير فقط
  requiresQualification: Boolean,          // هل المهنة تحتاج مؤهل/شهادة مهنية؟
  requiresLicense: Boolean,                // هل المهنة تحتاج ترخيص مزاولة؟

  // ── القائمة الفعلية التي تُبنى منها شاشة المستندات ──
  documentRequirements: [
    { key: 'NATIONAL_ID' | 'PERSONAL_PHOTO' | 'PROFESSIONAL_CERT'
         | 'PRACTICE_LICENSE' | 'ADDRESS_PROOF' | 'CUSTOM',
      customKey?,                          // إلزامي عند key='CUSTOM'
      label,                               // نص عربي يظهر في الواجهة
      description,                         // النص الثانوي تحت العنوان
      required: Boolean,                   // Required أم Optional
      order: Number,                       // ترتيب الظهور
      accept: ['image/jpeg','image/png','application/pdf'],
      maxSizeMB: 5,
      isActive: Boolean }
  ] }

Indexes: categories{slug:1} unique · professions{slug:1} unique
        · professions{categoryId:1,isActive:1} · professions{professionKind:1}
```

### محرّك المستندات الديناميكية

شاشة المستندات (3/4) **لا تحتوي أي قائمة ثابتة في الكود** — تُبنى بالكامل من `documentRequirements` الخاصة بالمهنة المختارة، ويحرّرها Admin من لوحة التحكم **بدون تعديل الكود أو إعادة نشر**.

**قاعدة الاتساق (تُفرض في `professions.service.ts` عند الحفظ):**

| الإعداد | الأثر الإلزامي على القائمة |
|---|---|
| دائمًا | `NATIONAL_ID` موجود و`required = true` |
| دائمًا | `PERSONAL_PHOTO` موجود و`required = true` |
| دائمًا | `ADDRESS_PROOF` موجود و`required = false` (Optional) |
| `requiresQualification = true` | `PROFESSIONAL_CERT` موجود و`required = true` |
| `requiresQualification = false` | `PROFESSIONAL_CERT` **غير موجود** في القائمة إطلاقًا |
| `requiresLicense = true` | `PRACTICE_LICENSE` موجود و`required = true` |
| `requiresLicense = false` | `PRACTICE_LICENSE` **غير موجود** في القائمة إطلاقًا |

أي محاولة حفظ تخالف هذا الجدول تُرفض بـ`422 INCONSISTENT_PROFESSION_CONFIG`. ويستطيع Admin إضافة مستندات `CUSTOM` إضافية وتحديد `required` لها بحرية.

**القالبان الجاهزان في الـSeed:**

*مهن حرفية* — `professionKind: 'CRAFT'`, `requiresQualification: false`, `requiresLicense: false`
(سبّاك · كهربائي · نقّاش · فني تكييف · نجّار · فني أجهزة منزلية · نقل عفش · مكافحة حشرات · عامل نظافة):
```
NATIONAL_ID (بطاقة الرقم القومي)    → Required
PERSONAL_PHOTO (صورة شخصية)         → Required
ADDRESS_PROOF (إثبات العنوان)       → Optional
```

*مهن منظَّمة* — `professionKind: 'REGULATED'`, `requiresQualification: true`, `requiresLicense: true`
(طبيب · محامٍ · صيدلي · محاسب قانوني · مهندس استشاري):
```
NATIONAL_ID (بطاقة الرقم القومي)         → Required
PERSONAL_PHOTO (صورة شخصية)              → Required
PROFESSIONAL_CERT (المؤهل/الشهادة المهنية) → Required
PRACTICE_LICENSE (ترخيص مزاولة المهنة)    → Required
ADDRESS_PROOF (إثبات العنوان)            → Optional
```
> مهنة منظَّمة بلا ترخيص مطلوب (مثل مدرّس خصوصي) تُضبط بـ`requiresQualification: true`, `requiresLicense: false` فيختفي `PRACTICE_LICENSE` تلقائيًا.

**فرض القاعدة على السيرفر:** عند `POST /provider/documents` وعند إرسال طلب التسجيل، يتحقق الـService من أن **كل** المستندات `required` للمهنة مرفوعة، ويرفض أي `requirementKey` غير موجود في إعدادات تلك المهنة. لا يُعتمد إطلاقًا على تحقق الواجهة وحده.

### 3.4 `services`
```
{ providerId, categoryId, professionId, title, description,
  priceFrom, priceTo?, currency: 'EGP', images: [MediaRef],
  areas: [String], isActive, ordersCount, ratingAvg, ratingCount }
Indexes: {providerId:1,isActive:1} · {categoryId:1,professionId:1,isActive:1}
        · {priceFrom:1} · {ratingAvg:-1} · Text index على title+description
```

### 3.5 `serviceRequests` (الطلبات)
```
{ orderNumber (unique, e.g. 10245), customerId, providerId, serviceId?,
  categoryId, professionId, serviceType, details (≤500), notes?,
  address: { governorate, city, area, line, landmark?, addressId? },   // نص فقط — لا إحداثيات
  scheduledDate, preferredTimeFrom?, preferredTimeTo?,
  agreedPrice?, currency: 'EGP',
  paymentMethod: 'CASH_ON_DELIVERY_OFFLINE',        // القيمة الوحيدة الممكنة
  cashReceivedConfirmed: Boolean, cashConfirmedAt?,
  attachments: [MediaRef] (≤5),
  status: 'NEW'|'ACCEPTED'|'IN_PROGRESS'|'ON_THE_WAY'|'COMPLETED'|'REJECTED'|'CANCELLED',
  statusHistory: [{ from, to, byUserId, byRole, note?, at }],
  cancelledBy?: 'CUSTOMER'|'PROVIDER'|'ADMIN', cancellationReason?,
  reviewId?, completedAt? }
Indexes: {orderNumber:1} unique · {customerId:1,status:1,createdAt:-1}
        · {providerId:1,status:1,createdAt:-1} · {status:1,createdAt:-1}
```

### 3.6 `providerDocuments`
```
{ providerId, requirementKey, label, media: MediaRef (Cloudinary private/authenticated),
  status: 'PENDING'|'APPROVED'|'REJECTED', reviewedBy?, reviewedAt?, rejectionReason? }
Indexes: {providerId:1, requirementKey:1} unique
Access: القراءة مقصورة على مالك المستند + ADMIN. الـURL لا يُسلَّم مباشرة —
        endpoint يولّد Signed URL قصير العمر (5 دقائق) بعد فحص الصلاحية.
```

### 3.7 باقي الـCollections
```
reviews      { orderId (unique), customerId, providerId, rating 1..5, comment? (≤500),
               isVisible, adminNote? }        Indexes: {providerId:1,createdAt:-1} · {orderId:1} unique
favorites    { userId, providerId? , serviceId? }   Index: {userId:1, providerId:1} unique
addresses    { userId, label, type:'HOME'|'WORK'|'FAMILY'|'OTHER', governorate, city, area,
               line, landmark?, postalCode?, contactName, contactPhone, isDefault }
notifications{ userId, type, title, body, entityType, entityId, isRead, readAt, actionUrl }
               Indexes: {userId:1,isRead:1,createdAt:-1} · TTL بعد 180 يومًا
messages     { threadId, orderId, senderId, receiverId, body, attachments[], isRead }
threads      { orderId (unique), participants:[userId], lastMessageAt, unread:{userId:count} }
settings     { key (unique), value, updatedBy }      // إعدادات عامة يديرها Admin
auditLogs    { actorId, action, entityType, entityId, before?, after?, ip, ua }
faqs         { question, answer, topic, order, isActive, helpfulYes, helpfulNo }
```

---

## 4. الـState Machine للطلبات

```
NEW ──accept(PROVIDER)──▶ ACCEPTED ──start(PROVIDER)──▶ IN_PROGRESS ─┐
 │                            │                              │        │
 │                            └──onTheWay(PROVIDER)──▶ ON_THE_WAY ────┤
 │                                                                    │
 │                                          complete(PROVIDER + cashReceived=true)
 │                                                                    ▼
 ├──reject(PROVIDER)──▶ REJECTED                                 COMPLETED ──▶ review(CUSTOMER)
 └──cancel(CUSTOMER|ADMIN, allowed in NEW/ACCEPTED)──▶ CANCELLED
```
قواعد ملزمة في `order-state-machine.ts`:
- الانتقال مسموح فقط إذا `(from, to, actorRole)` موجود في جدول الانتقالات — وإلا `409 INVALID_TRANSITION`.
- `COMPLETED` مستحيل بدون `cashReceivedConfirmed === true` (شاشة 29).
- `ON_THE_WAY` مجرّد **علامة حالة يدوية** يضغطها المزوّد — لا GPS ولا ETA ولا مسار ولا مسافة ولا تتبّع من أي نوع (§0.2).
- `cashReceivedConfirmed` **علامة حالة فقط** ولا تُنشئ أي سجل مالي — لا يوجد Collection أو Service للمعاملات (§0.1).
- كل انتقال يكتب `statusHistory` + `auditLog` + يُنشئ Notification للطرف الآخر — في **معاملة واحدة**.
- `CANCELLED` من العميل ممنوع بعد `IN_PROGRESS`.

## 5. State Machine لتوثيق المزوّد
```
PENDING_REVIEW ──▶ APPROVED (isActive=true، يبدأ استقبال الطلبات)
               ──▶ REJECTED (+ سبب)
               ──▶ RESUBMISSION_REQUIRED ──(رفع مستندات جديدة)──▶ PENDING_REVIEW
```
المزوّد غير `APPROVED` **لا يظهر في أي بحث/قائمة ولا يستقبل طلبات** (فلترة على مستوى الـrepository لا الـUI).

---

## 6. الـAPI

REST تحت `/api/v1/*` · JSON · استجابة موحّدة:
```json
{ "success": true, "data": {...}, "meta": { "page":1, "limit":20, "total":134 } }
{ "success": false, "error": { "code":"VALIDATION_ERROR", "message":"...", "fields":{...} } }
```

| المجموعة | المسارات |
|---|---|
| Auth | `POST /auth/register` · `/auth/register-provider` · `/auth/login` · `/auth/refresh` · `/auth/logout` · `/auth/forgot-password` · `/auth/reset-password` · `GET /auth/me` |
| Catalog | `GET /categories` · `/categories/:slug` · `/professions?categoryId=` · `GET /professions/:id/document-requirements` |
| Discovery | `GET /providers` (فلترة: category, profession, area, minRating, priceMin/Max, sort, q, page) · `GET /providers/:id` · `GET /services` · `GET /services/:id` · `GET /search?q=` |
| Orders | `POST /orders` · `GET /orders` (حسب الدور) · `GET /orders/:id` · `PATCH /orders/:id/status` · `POST /orders/:id/cancel` · `POST /orders/:id/complete` |
| Reviews | `POST /orders/:id/review` · `GET /providers/:id/reviews` |
| Documents | `POST /uploads/signature` (توقيع Cloudinary) · `POST /provider/documents` (حفظ metadata) · `GET /provider/documents/:id/url` (Signed URL مؤقّت) |
| Account | `GET/PATCH /me/profile` · `GET/POST/PATCH/DELETE /me/addresses` · `GET/POST/DELETE /me/favorites` |
| Notifications | `GET /notifications` · `PATCH /notifications/:id/read` · `PATCH /notifications/read-all` |
| Messages | `GET /threads` · `GET /threads/:id/messages` · `POST /threads/:id/messages` |
| Provider | `GET /provider/dashboard` · `GET/PATCH /provider/profile` · CRUD `/provider/services` |
| Admin | `GET/PATCH /admin/providers/:id/verification` · CRUD `/admin/categories` · `/admin/professions` (+ documentRequirements) · `/admin/orders` · `/admin/users` · `/admin/reviews` · `/admin/settings` |
| Help | `GET /faqs` · `POST /faqs/:id/feedback` · `POST /support/contact` |

كل Handler يمرّ عبر السلسلة: `withErrorHandler → withRateLimit → withAuth → withRole → withValidation(Zod) → service`.

---

## 7. المصادقة والأمان

**Authentication**
- تسجيل الدخول بـ**رقم هاتف أو بريد + كلمة مرور**، أو عبر **جوجل** (`/api/v1/auth/google`،
  Google Identity Services + تحقق JWKS في السيرفر — لا OTP في أي من المسارين). قرار
  تحديث لاحق: واجهتا الدخول والتسجيل تُظهران زر جوجل افتراضيًا وتُخفيان نموذج
  الهاتف/كلمة المرور خلف رابط ثانوي (لا يزال يعمل بالكامل في الـbackend).
- Hash: **argon2id** (m=19MiB, t=2, p=1). سياسة كلمة المرور: ≥8 أحرف + حرف + رقم.
- Access JWT 15 دقيقة + Refresh 30 يومًا بـ**Rotation** وكشف إعادة الاستخدام (يُبطل كل الجلسات).
- Cookies: `httpOnly; Secure; SameSite=Lax; Path=/`. لا يُخزَّن أي token في localStorage.
- Reset Password: توكن عشوائي 32 بايت، يُخزَّن **مُجزّأً**، صالح 30 دقيقة، مرة واحدة، يُرسل بالبريد.
- Brute-force: قفل الحساب 15 دقيقة بعد 5 محاولات + Rate limit على IP.

**Authorization**
- RBAC: `CUSTOMER` / `PROVIDER` / `ADMIN` + Ownership check في كل endpoint يخص مورد.
- **منع IDOR**: أي `GET/PATCH /orders/:id` يتحقق أن `customerId` أو `providerId` = المستخدم الحالي، وإلا `404` (وليس 403 — لتفادي تسريب الوجود).
- المستندات: `providerDocuments` لا تُقرأ إلا من صاحبها أو ADMIN، وعبر Signed URL مؤقّت.
- منع Privilege Escalation: `role` و`verification.status` و`isVerifiedBadge` غير قابلة للتعديل من endpoints المستخدم — mass-assignment مقطوع عبر Zod `.strict()` وwhitelist صريح.

**Input & Injection**
- كل Body/Query/Params عبر Zod `.strict()`؛ رفض أي مفتاح غير معرّف.
- NoSQL Injection: `mongoose.set('sanitizeFilter', true)` + رفض المفاتيح التي تبدأ بـ`$` أو تحوي `.`.
- XSS: React يهرب افتراضيًا؛ ممنوع `dangerouslySetInnerHTML`؛ تنقية أي نص حر عند العرض.
- Rate limiting: 5/دقيقة للـauth · 30/دقيقة للكتابة · 120/دقيقة للقراءة (Upstash Redis أو in-memory في التطوير).

**Headers / Transport**
- CSP، `X-Content-Type-Options: nosniff`، `Referrer-Policy: strict-origin-when-cross-origin`، `Permissions-Policy` (تعطيل geolocation صراحةً)، HSTS.
- CORS: Allowlist صارم (نطاق الويب + `capacitor://localhost` + `https://localhost` لأندرويد).
- CSRF: SameSite=Lax + فحص `Origin` على كل طلب Mutating.

**Secrets**
- كل الأسرار في `.env` مع تحقق عبر Zod عند الإقلاع (`env.ts`) — يفشل الـboot إن نقص شيء.
- **`CLOUDINARY_API_SECRET` و`MONGODB_URI` و`JWT_*` على السيرفر فقط.** المتاح للمتصفح فقط `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`.

---

## 8. Cloudinary — معمارية الرفع الآمن

```
1) المتصفح → POST /api/v1/uploads/signature  { purpose, contentType, sizeBytes }
2) السيرفر: يتحقق من الجلسة والدور + MIME من allowlist + الحجم ≤ 5MB
             + يحدد folder وaccess_mode ثم يوقّع بـ API_SECRET (لا يغادر السيرفر)
3) المتصفح → POST مباشرة إلى Cloudinary بالتوقيع (لا تمرّ الملفات عبر السيرفر)
4) المتصفح → POST metadata فقط إلى السيرفر { publicId, format, bytes, w, h, signature }
5) السيرفر: يتحقق من التوقيع/الـpublicId، ثم يحفظ MediaRef في MongoDB
```
- المجلدات: `khadamaty/avatars/`, `khadamaty/providers/{id}/gallery/`, `khadamaty/services/`, `khadamaty/orders/{id}/attachments/`, `khadamaty/documents/{providerId}/`.
- **المستندات** تُرفع بـ`type=authenticated` (خاصة) وتُقرأ عبر Signed URL صلاحيته 5 دقائق.
- `allowed_formats: jpg,png,webp,pdf` · `max_file_size: 5MB` · فحص MIME من التوقيع السحري لا من الامتداد.
- Transformations للأداء: `f_auto,q_auto,dpr_auto` + مقاسات محددة (`w_120` للبطاقات، `w_400` للـprofile، `w_800` للمعرض) عبر `next/image` مع `remotePatterns` مقصورة على `res.cloudinary.com`.
- عند حذف كيان → حذف أصوله من Cloudinary (Job) لتفادي الملفات اليتيمة.

---

## 9. الأداء
- RSC للصفحات القابلة للـcache (التصنيفات/المهن) + `revalidate` مناسب؛ TanStack Query للبيانات الشخصية.
- Pagination على كل القوائم (`limit=20`, cursor-based للطلبات والإشعارات).
- Debounce 350ms للبحث + `staleTime` مناسب + إلغاء الطلبات السابقة.
- Skeletons بأبعاد العناصر الحقيقية لتفادي Layout Shift.
- `next/image` + lazy + `sizes` صحيحة + blur placeholder.
- Compound indexes مطابقة لأنماط الاستعلام (القسم 3)؛ مراجعة `explain()` لكل استعلام قوائم.
- Code splitting لكل مسار + `dynamic()` للمكوّنات الثقيلة (المعرض، الرسوم البيانية).
- عدّادات مشتقة (`ratingAvg`, `completedOrders`, `servicesCount`) تُحدَّث بـ`$inc` بدل `count()` عند كل قراءة.

## 10. أخطاء وسجلّات
- `AppError` موحّد بـ`code` + `httpStatus` + رسالة عربية للمستخدم ورسالة تقنية للسجل.
- Logger منظّم (pino) بـ`requestId` لكل طلب، مع **تنقيح** كلمات المرور والتوكنات وأرقام الهواتف الكاملة من السجلات.
- `error.tsx` و`not-found.tsx` لكل segment بنفس الـDesign System.

## 11. النشر
- **Web/PWA:** Vercel أو VPS Node 20 خلف Nginx (HTTPS إجباري). `manifest.webmanifest` + Service Worker (offline shell + cache للأصول).
- **Android:** `next build` (وضع Static/Hybrid المناسب) → `npx cap sync android` → Android Studio → **AAB موقّع** لـ Google Play. Splash + Adaptive Icon من `logo.png`. `minSdk 24`, `targetSdk 35`.
- **iPhone:** PWA — «إضافة إلى الشاشة الرئيسية»، دعم `viewport-fit=cover` و`env(safe-area-inset-*)`.
- **DB:** MongoDB Atlas M0/M10، IP Allowlist، مستخدم بأقل صلاحية، نسخ احتياطي يومي.
- **البيئات:** `development` / `staging` / `production` بقواعد بيانات ومجلدات Cloudinary منفصلة.

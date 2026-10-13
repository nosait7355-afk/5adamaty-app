# تطبيق «خدمات الفيوم» (`com.khadamat.fayoum`)

تطبيق أندرويد مستقل عن «خدماتي الفيوم» (`../android`) ويُنشر من حساب Google Play آخر.

- **الواجهة** محمَّلة داخل الـAPK: نفس صفحات `src/app` ومكوّناتها، تُبنى بـVite
  كتطبيق صفحة واحدة. `next/link` و`next/navigation` و`next/image` تُستبدل ببدائل
  في `src/shims/` (انظر `vite.config.ts`).
- **البيانات** من الـAPI على Vercel، بتوكن في `Authorization: Bearer`
  (`src/session/`، والعقد في `../src/server/lib/session-transport.ts`).
- **توكن التحديث** في التخزين الآمن (Android Keystore)، وتوكن الوصول في الذاكرة.
- **لوحة الإدارة** ليست في التطبيق — على الموقع فقط.

## الأوامر (من جذر المستودع)

```bash
npm run mobile:dev     # المتصفح على :5173 — مع `npm run dev` على :3000 (mobile/.env.development.local)
npm run mobile:build   # dist/ للإنتاج — يكلّم https://5adamaty-app.vercel.app
npm run mobile:sync    # بناء + نسخ إلى android/
npm run mobile:open    # فتح Android Studio
```

⚠️ لا تشغّل `npm install` داخل `mobile/` — الحزم في الجذر، و`package.json` هنا يعرّف
إضافات Capacitor لـ`cap sync` فقط.

## قبل النشر

1. **الخادم:** انشر الـcommit الذي يضيف مصادقة التوكن وCORS على Vercel، وإلا يفشل
   كل طلب من التطبيق.
2. **مفتاح التوقيع:** keystore جديد خاص بهذا التطبيق (لا يُعاد استخدام مفتاح «خدماتي الفيوم»).
3. **جوجل:** عميل OAuth أندرويد بالمعرّف `com.khadamat.fayoum` وبصمة SHA-1 من
   Play App Signing في الحساب الجديد. لو العميل في مشروع Google Cloud آخر، أضف
   Web Client ID الخاص به في `GOOGLE_EXTRA_CLIENT_IDS` على Vercel.
4. **الهوية البصرية:** `../assets/splash.png` يحمل اسم «خدماتي الفيوم» — يحتاج نسخة بالاسم الجديد.
5. **Play Console:** رابط الخصوصية `/privacy` ورابط الحذف `/delete-account` (يذكران التطبيق بالاسم).

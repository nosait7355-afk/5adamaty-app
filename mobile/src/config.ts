/**
 * خادم الـAPI الذي يكلّمه التطبيق. الواجهة على الجهاز، والبيانات من هنا.
 *
 * يُضبط وقت البناء بـ`VITE_API_ORIGIN` (`mobile/.env.local` للتطوير مع
 * `next dev`: `http://localhost:3000`). بلا قيمة: خادم الإنتاج.
 */
export const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN || 'https://5adamaty-app.vercel.app').replace(
  /\/+$/,
  ''
);

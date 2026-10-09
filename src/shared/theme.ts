/**
 * المظهر: تلقائي (يتبع الهاتف) أو فاتح أو داكن — اختيار يحفظه الجهاز.
 *
 * الوضع المطبَّق فعلًا يُكتب في `data-theme` على `<html>` («light»/«dark»)،
 * وكل ألوان الوضع الليلي في globals.css معلّقة على `:root[data-theme='dark']`.
 *
 * ⚠️ لماذا سكربت مضمَّن في `<head>`؟ ليُطبَّق الاختيار **قبل أول رسم**: لو
 * انتظرنا React لظهرت الصفحة فاتحة لحظة ثم انقلبت داكنة عند من اختار
 * الداكن. والسكربت المضمَّن يمنعه الـCSP ما لم يحمل الـnonce — وقراءة الـnonce
 * في التخطيط (`headers()`) تعيد حجب كل تنقّل (انظر layout.tsx). الحل: نصّه
 * ثابت لا يتغيّر، فيُسمح به في الـCSP **ببصمته** (`sha256-…`) في proxy.ts.
 * اختبار `tests/unit/theme.test.ts` يتحقق أن البصمة تطابق النص — أي تعديل
 * على السكربت بلا تحديث البصمة يفشل الاختبار بدل أن يُحجب السكربت بصمت.
 *
 * السكربت يتابع أيضًا تغيّر وضع الهاتف (للتلقائي) والتغيير من تبويب آخر.
 */

export const THEME_STORAGE_KEY = 'khadamaty:theme';

export type ThemeChoice = 'system' | 'light' | 'dark';

export const THEME_SCRIPT =
  "(function(){try{var k='khadamaty:theme',r=document.documentElement,m=window.matchMedia('(prefers-color-scheme: dark)');function a(){var c=localStorage.getItem(k);r.setAttribute('data-theme',c==='dark'||(c!=='light'&&m.matches)?'dark':'light');}a();m.addEventListener('change',a);window.addEventListener('storage',function(e){if(e.key===k)a();});}catch(e){}})();";

/** sha256 لـ`THEME_SCRIPT` بترميز base64 — يُحدَّث مع أي تعديل على النص. */
export const THEME_SCRIPT_HASH = 'VI+uv58PqU+vhMRKDh1SQGRngcPjeqaUR/5CG1B6v04=';

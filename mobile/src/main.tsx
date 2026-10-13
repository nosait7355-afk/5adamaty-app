import '@fontsource/cairo/arabic-400.css';
import '@fontsource/cairo/arabic-600.css';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-800.css';
// الأرقام والنصوص اللاتينية (البريد، الأسعار) بنفس الأوزان
import '@fontsource/cairo/latin-400.css';
import '@fontsource/cairo/latin-600.css';
import '@fontsource/cairo/latin-700.css';
import '@fontsource/cairo/latin-800.css';
import './app.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setApiTransport } from '@/lib/api-client';
import { App } from './app';
import { API_ORIGIN } from './config';
import { createNativeTransport } from './session/native-transport';

// قبل أي استعلام: كل طلبات الصفحات تذهب للخادم بتوكن الجهاز لا بالكوكيز
setApiTransport(createNativeTransport(API_ORIGIN));

const root = document.getElementById('root');
if (!root) throw new Error('#root غير موجود في index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);

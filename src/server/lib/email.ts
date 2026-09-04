import { Resend } from 'resend';
import { getEnv, isProduction } from './env';
import { logger } from './logger';

/**
 * إرسال البريد عبر Resend.
 *
 * جاهز للتفعيل بمفتاح واحد (قرار Phase 10 المعتمد): بإضافة `RESEND_API_KEY`
 * و`RESEND_FROM_EMAIL` في متغيرات البيئة يبدأ الإرسال الفعلي فورًا بلا أي
 * تعديل كود. بدونهما — كما في هذا السجل التطويري — تُكتب الرسالة في اللوج
 * فقط (فيظهر رابط إعادة التعيين للمطوّر)، وفي الإنتاج يُسجَّل تحذير ولا
 * يُرسل شيء.
 *
 * منطق إعادة التعيين نفسه مكتمل ومختبَر منذ Phase 3 (توكن مُجزّأ، صلاحية
 * 30 دقيقة، استخدام واحد، إبطال كل الجلسات). هذا الملف مسؤول عن التوصيل فقط.
 *
 * ملاحظة على النطاق: البريد يُستخدم **فقط** لإعادة تعيين كلمة المرور.
 * لا يوجد بريد تحقق ولا كود OTP (PROJECT_PLAN — المصادقة).
 */

export interface EmailMessage {
  to: string;
  subject: string;
  /** نص عادي — لا HTML، تفاديًا لأي حقن في قوالب البريد. */
  text: string;
}

export interface EmailResult {
  delivered: boolean;
  /** true عندما يُسجَّل فقط بلا إرسال فعلي (لا يوجد مزوّد). */
  loggedOnly: boolean;
}

let resendClient: Resend | null = null;

/**
 * نقطة التوصيل الوحيدة.
 * تعيد `null` عندما لا يوجد مفتاح Resend مُعدّ — فيسقط `sendEmail` لوضع
 * التسجيل فقط تلقائيًا (انظر التعليق أعلى الملف).
 */
async function sendViaProvider(message: EmailMessage): Promise<EmailResult | null> {
  const env = getEnv();
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) return null;

  resendClient ??= new Resend(env.RESEND_API_KEY);

  const { error } = await resendClient.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });

  if (error) {
    logger.error('فشل إرسال البريد عبر Resend', { to: message.to, error });
    return { delivered: false, loggedOnly: false };
  }

  return { delivered: true, loggedOnly: false };
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const delivered = await sendViaProvider(message);
  if (delivered) return delivered;

  if (isProduction) {
    logger.warn(
      'لم يُرسل البريد — لا يوجد مزوّد بريد مُعدّ (بند Phase 10: حاجز إطلاق)',
      { to: message.to, subject: message.subject }
    );
    return { delivered: false, loggedOnly: true };
  }

  logger.info('[بريد — تطوير فقط]', {
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
  return { delivered: false, loggedOnly: true };
}

/** بريد إعادة تعيين كلمة المرور. */
export async function sendPasswordResetEmail(params: {
  to: string;
  fullName: string;
  token: string;
}): Promise<EmailResult> {
  const env = getEnv();
  const link = `${env.APP_URL}/reset-password?token=${encodeURIComponent(params.token)}`;

  return sendEmail({
    to: params.to,
    subject: 'إعادة تعيين كلمة المرور — خدماتي الفيوم',
    text: [
      `مرحبًا ${params.fullName}،`,
      '',
      'تلقّينا طلبًا لإعادة تعيين كلمة المرور الخاصة بحسابك في «خدماتي الفيوم».',
      '',
      'لإعادة التعيين افتح الرابط التالي:',
      link,
      '',
      'الرابط صالح لمدة 30 دقيقة ويُستخدم مرة واحدة فقط.',
      'إذا لم تطلب ذلك، تجاهل هذه الرسالة ولن يتغيّر شيء في حسابك.',
      '',
      'فريق خدماتي الفيوم',
    ].join('\n'),
  });
}

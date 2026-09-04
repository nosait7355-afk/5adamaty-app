'use client';

import { useState } from 'react';
import {
  ChevronDown,
  CreditCard,
  Headset,
  Mail,
  MessageSquare,
  Phone,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  Wrench,
} from 'lucide-react';
import { BackHeader } from '@/components/layout/back-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageContainer, PageTitle } from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoAlert } from '@/components/common/info-alert';
import { EmptyState, ErrorState } from '@/components/common/states';
import { SearchBox } from '@/components/features/discovery/search-box';
import { ApiClientError } from '@/lib/api-client';
import { useDebouncedValue } from '@/lib/queries/discovery';
import { useContactSupport, useFaqFeedback, useFaqs } from '@/lib/queries/account';
import { cn } from '@/lib/cn';

/**
 * مركز المساعدة — الصورة 18.
 *
 * بحث · 4 قنوات تواصل · Accordion للأسئلة الشائعة · مواضيع المساعدة ·
 * بانر دعم · «مفيد 🙂 / غير مفيد 🙁» أسفل كل إجابة.
 *
 * قنوات التواصل روابط نظام (`tel:` / `mailto:` / `wa.me`) لا تكاملات.
 */

const SUPPORT_PHONE = '+201012345678';
const SUPPORT_EMAIL = 'support@khadamaty-elfayoum.com';

const TOPICS = [
  { icon: <Wrench size={22} />, label: 'الطلبات والخدمات' },
  { icon: <CreditCard size={22} />, label: 'الدفع والأسعار' },
  { icon: <UserRound size={22} />, label: 'الحساب والبيانات' },
  { icon: <ShieldCheck size={22} />, label: 'التوثيق والأمان' },
  { icon: <MessageSquare size={22} />, label: 'الشكاوى والاقتراحات' },
];

export default function HelpPage() {
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term.trim());
  const faqs = useFaqs(debounced || undefined);

  const [openId, setOpenId] = useState<string | null>(null);
  const [voted, setVoted] = useState<Record<string, boolean>>({});
  const feedback = useFaqFeedback();

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [contactError, setContactError] = useState('');
  const contact = useContactSupport();

  const sendContact = async () => {
    setContactError('');
    try {
      await contact.mutateAsync({ subject, message });
      setSubject('');
      setMessage('');
    } catch (error) {
      setContactError(
        error instanceof ApiClientError ? error.message : 'تعذّر إرسال رسالتك. حاول مرة أخرى.'
      );
    }
  };

  const vote = (id: string, helpful: boolean) => {
    if (voted[id] !== undefined) return;
    setVoted((current) => ({ ...current, [id]: helpful }));
    void feedback.mutateAsync({ id, helpful });
  };

  return (
    <>
      <BackHeader />

      <PageContainer className="flex flex-col gap-5">
        <PageTitle title="مركز المساعدة" subtitle="كيف يمكننا مساعدتك؟" />

        <SearchBox
          value={term}
          onValueChange={setTerm}
          placeholder="ابحث عن سؤالك…"
        />

        {/* ---- قنوات التواصل الأربع ---- */}
        <section aria-label="قنوات التواصل">
          <div className="grid grid-cols-2 gap-2">
            <ChannelTile
              href={`mailto:${SUPPORT_EMAIL}`}
              icon={<Mail size={22} />}
              label="راسلنا"
              hint="بريد إلكتروني"
            />
            <ChannelTile
              href={`tel:${SUPPORT_PHONE}`}
              icon={<Phone size={22} />}
              label="اتصل بنا"
              hint="من 9ص إلى 9م"
            />
            <ChannelTile href="#contact" icon={<Headset size={22} />} label="محادثة مباشرة" hint="نموذج الدعم" />
            <ChannelTile
              href={`https://wa.me/${SUPPORT_PHONE.replace(/\D/g, '')}`}
              icon={<MessageSquare size={22} />}
              label="واتساب"
              hint="رد سريع"
              external
            />
          </div>
        </section>

        {/* ---- الأسئلة الشائعة ---- */}
        <section aria-label="الأسئلة الشائعة">
          <h2 className="mb-3 text-section font-bold text-ink-900">الأسئلة الشائعة</h2>

          {faqs.isPending ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-field" />
              ))}
            </div>
          ) : faqs.isError ? (
            <ErrorState onRetry={() => void faqs.refetch()} />
          ) : faqs.data.length === 0 ? (
            <EmptyState
              message="لا توجد نتائج"
              description={debounced ? `لم نجد سؤالًا يطابق «${debounced}».` : undefined}
              compact
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {faqs.data.map((faq) => {
                const isOpen = openId === faq.id;

                return (
                  <li key={faq.id}>
                    <Card className="p-0">
                      <button
                        type="button"
                        onClick={() => setOpenId(isOpen ? null : faq.id)}
                        aria-expanded={isOpen}
                        className="flex w-full items-center justify-between gap-3 p-4 text-start"
                      >
                        <span className="text-label font-bold text-ink-900">{faq.question}</span>
                        <ChevronDown
                          size={18}
                          className={cn('shrink-0 text-ink-400 transition-transform', isOpen && 'rotate-180')}
                          aria-hidden="true"
                        />
                      </button>

                      {isOpen && (
                        <div className="border-t border-border p-4">
                          <p className="text-meta leading-6 text-ink-600">{faq.answer}</p>

                          <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
                            <span className="text-badge text-ink-400">هل كانت مفيدة؟</span>
                            <button
                              type="button"
                              onClick={() => vote(faq.id, true)}
                              disabled={voted[faq.id] !== undefined}
                              aria-label="مفيد"
                              className={cn(
                                'flex items-center gap-1 rounded-pill border px-3 py-1 text-badge transition-colors',
                                voted[faq.id] === true
                                  ? 'border-success bg-success-bg text-success'
                                  : 'border-border text-ink-600 hover:bg-bg'
                              )}
                            >
                              <ThumbsUp size={14} />
                              مفيد
                            </button>
                            <button
                              type="button"
                              onClick={() => vote(faq.id, false)}
                              disabled={voted[faq.id] !== undefined}
                              aria-label="غير مفيد"
                              className={cn(
                                'flex items-center gap-1 rounded-pill border px-3 py-1 text-badge transition-colors',
                                voted[faq.id] === false
                                  ? 'border-danger bg-danger-bg text-danger'
                                  : 'border-border text-ink-600 hover:bg-bg'
                              )}
                            >
                              <ThumbsDown size={14} />
                              غير مفيد
                            </button>
                          </div>
                        </div>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ---- مواضيع المساعدة ---- */}
        <section aria-label="مواضيع المساعدة">
          <h2 className="mb-3 text-section font-bold text-ink-900">مواضيع المساعدة</h2>
          <div className="grid grid-cols-3 gap-2">
            {TOPICS.map((topic) => (
              <div
                key={topic.label}
                className="flex flex-col items-center gap-2 rounded-field border border-border bg-surface p-3 text-center"
              >
                <span className="text-brand-600">{topic.icon}</span>
                <span className="text-[11px] font-semibold leading-tight text-ink-700">
                  {topic.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ---- تنبيه الدفع ---- */}
        <InfoAlert tone="warning" title="بخصوص الدفع">
          لا يوجد دفع أونلاين في التطبيق. تدفع قيمة الخدمة كاش مباشرة لمقدم الخدمة بعد إتمام العمل.
        </InfoAlert>

        {/* ---- نموذج التواصل ---- */}
        <section id="contact" aria-label="تواصل معنا">
          <h2 className="mb-3 text-section font-bold text-ink-900">تواصل معنا</h2>

          <Card className="flex flex-col gap-4">
            <Field label="الموضوع" required>
              <Input
                placeholder="مثال: استفسار عن طلب"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </Field>

            <Field label="رسالتك" required counter={{ current: message.length, max: 1000 }}>
              <Textarea
                rows={4}
                maxLength={1000}
                placeholder="اشرح استفسارك بالتفصيل"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </Field>

            {contactError && (
              <InfoAlert tone="danger" title="تعذّر الإرسال">
                {contactError}
              </InfoAlert>
            )}

            {contact.isSuccess && (
              <InfoAlert tone="success" title="وصلت رسالتك">
                سنرد عليك في أقرب وقت. ستجد تأكيدًا في إشعاراتك.
              </InfoAlert>
            )}

            <Button
              fullWidth
              loading={contact.isPending}
              disabled={subject.trim().length < 3 || message.trim().length < 10}
              onClick={() => void sendContact()}
            >
              إرسال
            </Button>
          </Card>
        </section>
      </PageContainer>

      <BottomNav />
    </>
  );
}

function ChannelTile({
  href,
  icon,
  label,
  hint,
  external = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="flex items-center gap-3 rounded-card border border-border bg-surface p-3 transition-colors hover:bg-brand-50"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-label font-bold text-ink-900">{label}</span>
        <span className="block text-badge text-ink-400">{hint}</span>
      </span>
    </a>
  );
}

import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { render as baseRender, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BackHeader } from '@/components/layout/back-header';
import { PageTitle } from '@/components/layout/page-container';

/**
 * الترويسة المضغوطة (المرحلة 3): عنوان الصفحة يُرسم كبيرًا في المحتوى،
 * وتعرضه الترويسة صغيرًا حين يختفي بالتمرير.
 */

/** زر الرجوع يقرأ الجلسة (`useSafeBack`) فيحتاج QueryClient. */
function render(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (node: ReactNode) => <QueryClientProvider client={client}>{node}</QueryClientProvider>;
  const result = baseRender(wrap(ui));
  return { ...result, rerender: (next: ReactNode) => result.rerender(wrap(next)) };
}

describe('BackHeader — العنوان الكبير على طريقة iOS', () => {
  it('صفحة بلا PageTitle تُظهر العلامة في الوسط', () => {
    render(<BackHeader />);
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('button', { name: 'رجوع' })).toBeInTheDocument();
    expect(within(header).queryByText('خدماتي')).not.toBeInTheDocument();
  });

  it('تأخذ عنوان PageTitle، مخفيًا عن قارئ الشاشة ما دام الكبير ظاهرًا', () => {
    render(
      <>
        <BackHeader />
        <PageTitle title="المفضلة" />
      </>
    );

    const header = screen.getByRole('banner');
    const small = within(header).getByText('المفضلة');
    // العنوان الكبير ظاهر (لا تمرير بعد) — النسخة الصغيرة للعين فقط حين يختفي
    expect(small).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('heading', { level: 1, name: 'المفضلة' })).toBeInTheDocument();
  });

  it('يُمسح العنوان حين تغادر الصفحة — لا يظهر في ترويسة الصفحة التالية', () => {
    const { rerender } = render(
      <>
        <BackHeader />
        <PageTitle title="المفضلة" />
      </>
    );
    rerender(<BackHeader />);
    expect(within(screen.getByRole('banner')).queryByText('المفضلة')).not.toBeInTheDocument();
  });
});

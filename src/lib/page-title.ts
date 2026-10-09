import { create } from 'zustand';

interface PageTitleState {
  /** عنوان الشاشة الحالية كما يرسمه `PageTitle` — `null` إن لم يوجد. */
  title: string | null;
  /** هل العنوان الكبير ظاهر في المحتوى؟ */
  visible: boolean;
  set: (patch: Partial<Pick<PageTitleState, 'title' | 'visible'>>) => void;
}

/**
 * «العنوان الكبير» على طريقة iOS: `PageTitle` يرسم العنوان كبيرًا أعلى
 * المحتوى، وحين يختفي تحت الترويسة بالتمرير تعرضه الترويسة صغيرًا.
 *
 * المتجر يربط المكوّنين دون أن تمرّر كل صفحة عنوانها مرتين.
 */
export const usePageTitleStore = create<PageTitleState>((set) => ({
  title: null,
  visible: true,
  set: (patch) => set(patch),
}));

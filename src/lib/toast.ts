import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  /** إجراء واحد بجوار الرسالة — «تراجع» غالبًا. */
  action?: { label: string; onClick: () => void };
}

interface ToastState {
  current: ToastItem | null;
  show: (toast: Omit<ToastItem, 'id'>) => void;
  dismiss: (id?: number) => void;
}

/**
 * رسالة واحدة في كل مرة، والأحدث تحلّ محل الأقدم — نمط iOS وأندرويد.
 * طابور رسائل متراكمة يُغرق الشاشة ويؤخّر الرسالة التي تخص آخر ما فعله
 * المستخدم.
 */
export const useToastStore = create<ToastState>((set, get) => ({
  current: null,
  show: (toast) => set({ current: { ...toast, id: Date.now() + Math.random() } }),
  dismiss: (id) => {
    // `id` يمنع مؤقّت رسالة قديمة من إخفاء رسالة أحدث حلّت محلها
    if (id === undefined || get().current?.id === id) set({ current: null });
  },
}));

type ToastOptions = Pick<ToastItem, 'action'>;

function show(tone: ToastTone, message: string, options?: ToastOptions) {
  useToastStore.getState().show({ tone, message, ...options });
}

/**
 * يُستدعى من أي مكان (معالجات الأحداث، `onSuccess` في الـmutations):
 *
 *   toast.success('أُضيف إلى المفضلة', { action: { label: 'تراجع', onClick: undo } });
 */
export const toast = {
  success: (message: string, options?: ToastOptions) => show('success', message, options),
  error: (message: string, options?: ToastOptions) => show('error', message, options),
  info: (message: string, options?: ToastOptions) => show('info', message, options),
};

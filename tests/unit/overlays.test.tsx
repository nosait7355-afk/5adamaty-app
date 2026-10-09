import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { Toaster } from '@/components/ui/toaster';
import { closeTopOverlay, pushOverlay } from '@/lib/overlay-stack';
import { toast, useToastStore } from '@/lib/toast';

/**
 * طبقات الواجهة (المرحلة 2): Bottom Sheet، تأكيد الحذف، والـToast.
 */

afterEach(() => {
  act(() => useToastStore.getState().dismiss());
});

describe('overlay-stack — زر رجوع أندرويد', () => {
  it('يغلق الطبقة العليا فقط، ويعيد false حين لا يوجد شيء', () => {
    const first = vi.fn();
    const second = vi.fn();
    const unregisterFirst = pushOverlay(first);
    const unregisterSecond = pushOverlay(second);

    expect(closeTopOverlay()).toBe(true);
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();

    /*
     * الطلب لا يُخرج الطبقة من السجل — هي تخرج حين تُغلق فعلًا. شيت يرفض
     * الإغلاق (تأكيد قيد التنفيذ) يبقى مسجّلًا فلا يغادر الرجوعُ الصفحةَ.
     */
    unregisterSecond();
    expect(closeTopOverlay()).toBe(true);
    expect(first).toHaveBeenCalledOnce();

    unregisterFirst();
    expect(closeTopOverlay()).toBe(false);
  });
});

describe('BottomSheet', () => {
  it('يتبع `open` ويسجّل نفسه ليُغلقه زر الرجوع', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <BottomSheet open={false} onClose={onClose} title="تصفية النتائج">
        محتوى
      </BottomSheet>
    );
    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open');

    rerender(
      <BottomSheet open onClose={onClose} title="تصفية النتائج">
        محتوى
      </BottomSheet>
    );
    expect(screen.getByRole('dialog', { name: 'تصفية النتائج' })).toHaveAttribute('open');

    closeTopOverlay();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('الضغط على الخلفية يطلب الإغلاق، والضغط على المحتوى لا', async () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="عنوان">
        <button type="button">داخل الشيت</button>
      </BottomSheet>
    );

    await userEvent.click(screen.getByRole('button', { name: 'داخل الشيت' }));
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('ConfirmSheet — بديل window.confirm', () => {
  it('الزر يسمّي الفعل، والإلغاء والتأكيد يبلّغان', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmSheet
        open
        title="تحذف «تسليك مواسير»؟"
        description="مش هتقدر ترجّعها."
        confirmLabel="حذف الخدمة"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const dialog = screen.getByRole('dialog', { name: 'تحذف «تسليك مواسير»؟' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'إلغاء' }));
    expect(onCancel).toHaveBeenCalledOnce();

    await userEvent.click(within(dialog).getByRole('button', { name: 'حذف الخدمة' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('أثناء التنفيذ لا يُغلق ولا يُلغى', async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmSheet
        open
        loading
        title="تحذف الخدمة؟"
        confirmLabel="حذف الخدمة"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    expect(screen.getByRole('button', { name: 'إلغاء' })).toBeDisabled();
    closeTopOverlay();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('Toast', () => {
  it('يعرض الرسالة، والأحدث تحلّ محل الأقدم', () => {
    render(<Toaster />);

    act(() => toast.success('اتضاف للمفضلة'));
    expect(screen.getByText('اتضاف للمفضلة')).toBeInTheDocument();

    act(() => toast.error('تعذّر تحديث المفضلة'));
    expect(screen.queryByText('اتضاف للمفضلة')).not.toBeInTheDocument();
    expect(screen.getByText('تعذّر تحديث المفضلة')).toBeInTheDocument();
  });

  it('زر «تراجع» ينفّذ الإجراء ويخفي الرسالة', async () => {
    const undo = vi.fn();
    render(<Toaster />);

    act(() => toast.success('اتشالت من المفضلة', { action: { label: 'تراجع', onClick: undo } }));
    await userEvent.click(screen.getByRole('button', { name: 'تراجع' }));

    expect(undo).toHaveBeenCalledOnce();
    expect(screen.queryByText('اتشالت من المفضلة')).not.toBeInTheDocument();
  });

  it('تختفي وحدها بعد مدتها', () => {
    vi.useFakeTimers();
    try {
      render(<Toaster />);
      act(() => toast.info('اتنسخ رابط الملف'));
      expect(screen.getByText('اتنسخ رابط الملف')).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(3000));
      expect(screen.queryByText('اتنسخ رابط الملف')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

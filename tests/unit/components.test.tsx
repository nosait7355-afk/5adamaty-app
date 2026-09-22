import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { BottomNav } from '@/components/layout/bottom-nav';
import { Stepper } from '@/components/common/stepper';
import { CUSTOMER_NAV, PROVIDER_NAV } from '@/shared/constants/navigation';

describe('Button', () => {
  it('يمنع النقر أثناء التحميل', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        إرسال
      </Button>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('يمنع النقر عند التعطيل', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        التالي
      </Button>
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('نوعه الافتراضي button لا submit — حتى لا يرسل النماذج بالخطأ', () => {
    render(<Button>حفظ</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('Input', () => {
  it('يبدّل إظهار كلمة المرور', async () => {
    render(<Input type="password" togglePassword placeholder="كلمة المرور" />);

    const input = screen.getByPlaceholderText('كلمة المرور');
    expect(input).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: 'إظهار كلمة المرور' }));
    expect(input).toHaveAttribute('type', 'text');

    await userEvent.click(screen.getByRole('button', { name: 'إخفاء كلمة المرور' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('يضع aria-invalid عند الخطأ', () => {
    render(<Input invalid placeholder="الهاتف" />);
    expect(screen.getByPlaceholderText('الهاتف')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('Field', () => {
  it('يعرض نجمة الإلزام مع بديل نصي لقارئ الشاشة', () => {
    render(
      <Field label="الاسم الكامل" required htmlFor="name">
        <input id="name" />
      </Field>
    );
    expect(screen.getByText('(مطلوب)')).toBeInTheDocument();
  });

  it('يعرض رسالة الخطأ كـ alert', () => {
    render(
      <Field label="الهاتف" error="رقم الهاتف غير صحيح" htmlFor="phone">
        <input id="phone" />
      </Field>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('رقم الهاتف غير صحيح');
  });

  it('يعرض عدّاد الأحرف', () => {
    render(
      <Field label="التفاصيل" counter={{ current: 12, max: 500 }} htmlFor="d">
        <textarea id="d" />
      </Field>
    );
    expect(screen.getByText('12/500')).toBeInTheDocument();
  });
});

describe('BottomNav', () => {
  it('يرسم 5 عناصر بترتيب RTL الصحيح للعميل', () => {
    render(<BottomNav variant="customer" />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);

    // الترتيب في المصفوفة = ترتيب القراءة من اليمين لليسار
    const labels = items.map((item) => within(item).getByRole('link').textContent);
    expect(labels).toEqual(['التصنيفات', 'الإشعارات', 'الرئيسية', 'المفضلة', 'حسابي']);
  });

  it('يرسم شريط المزوّد بلا طلبات ولا رسائل', () => {
    render(<BottomNav variant="provider" />);

    const labels = screen.getAllByRole('listitem').map((i) => within(i).getByRole('link').textContent);
    expect(labels).toEqual(['الإشعارات', 'خدماتي', 'الرئيسية', 'ملفي', 'حسابي']);
  });

  it('لا يشير أي عنصر إلى الطلبات أو الرسائل', () => {
    for (const item of [...CUSTOMER_NAV, ...PROVIDER_NAV]) {
      expect(item.href, item.label).not.toMatch(/orders|messages/);
    }
    expect(CUSTOMER_NAV.find((item) => item.key === 'favorites')?.href).toBe('/account/favorites');
  });

  it('«الرئيسية» في الوسط في كلا الشريطين', () => {
    expect(CUSTOMER_NAV[2]?.key).toBe('home');
    expect(PROVIDER_NAV[2]?.key).toBe('home');
  });

  it('يعلّم العنصر النشط بـ aria-current', () => {
    // usePathname مُهيّأ على '/home' في tests/setup.ts
    render(<BottomNav variant="customer" />);
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('الرئيسية');
  });

  it('يعرض شارة العدّاد غير المقروء', () => {
    render(<BottomNav variant="customer" badges={{ notifications: 3 }} />);
    expect(screen.getByLabelText('3 غير مقروء')).toHaveTextContent('3');
  });

  it('يخفي الشارة عند الصفر', () => {
    render(<BottomNav variant="customer" badges={{ notifications: 0 }} />);
    expect(screen.queryByLabelText(/غير مقروء/)).not.toBeInTheDocument();
  });

  it('لا يعرض أي شارة للعناصر بلا عدّاد', () => {
    // انحدار: كانت النقطة الحمراء تظهر فوق كل العناصر الخمسة
    render(<BottomNav variant="customer" badges={{ notifications: 3 }} />);
    expect(screen.queryAllByLabelText('يوجد جديد')).toHaveLength(0);
    expect(screen.getAllByLabelText(/غير مقروء/)).toHaveLength(1);
  });

  it('لا يعرض شارات إطلاقًا بلا badges', () => {
    render(<BottomNav variant="customer" />);
    expect(screen.queryAllByLabelText('يوجد جديد')).toHaveLength(0);
    expect(screen.queryAllByLabelText(/غير مقروء/)).toHaveLength(0);
  });
});

describe('Stepper', () => {
  const steps = [
    { label: 'تفاصيل الطلب' },
    { label: 'تأكيد الطلب' },
    { label: 'اختيار الوقت' },
    { label: 'تم الإرسال' },
  ];

  it('يعلّم الخطوة الحالية بـ aria-current', () => {
    render(<Stepper steps={steps} current={3} />);
    const current = screen.getByText('اختيار الوقت').closest('li');
    expect(current).toHaveAttribute('aria-current', 'step');
  });

  it('يعلن موضع الخطوة لقارئ الشاشة', () => {
    render(<Stepper steps={steps} current={2} />);
    expect(screen.getByLabelText('الخطوة 2 من 4')).toBeInTheDocument();
  });

  it('يستبدل رقم الخطوات المنجزة بعلامة ✓', () => {
    render(<Stepper steps={steps} current={3} />);
    // الخطوتان 1 و2 منجزتان فلا يظهر رقماهما
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});

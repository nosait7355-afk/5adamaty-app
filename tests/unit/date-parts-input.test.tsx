import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePartsInput, INCOMPLETE_DATE } from '@/components/ui/date-parts-input';
import { providerStep1Schema } from '@/shared/schemas/provider.schema';

/** غلاف يحمل القيمة كما يفعل النموذج الحقيقي. */
function Harness({ initial = '', onValue }: { initial?: string; onValue: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <DatePartsInput
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
    />
  );
}

describe('DatePartsInput — تاريخ الميلاد بثلاث خانات', () => {
  it('يجمع اليوم والشهر والسنة في تاريخ كامل YYYY-MM-DD', async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);

    await userEvent.type(screen.getByLabelText('اليوم'), '5');
    await userEvent.selectOptions(screen.getByLabelText('الشهر'), '3');
    await userEvent.type(screen.getByLabelText('السنة'), '1990');

    expect(onValue).toHaveBeenLastCalledWith('1990-03-05');
  });

  it('الكتابة الجزئية تُعلَّم «ناقصة» ولا تُمسح أثناء الكتابة', async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);

    await userEvent.type(screen.getByLabelText('اليوم'), '12');
    expect(onValue).toHaveBeenLastCalledWith(INCOMPLETE_DATE);
    expect(screen.getByLabelText('اليوم')).toHaveValue('12');
  });

  it('يعرض تاريخًا محفوظًا في خاناته', () => {
    render(<Harness initial="1985-11-23" onValue={vi.fn()} />);
    expect(screen.getByLabelText('اليوم')).toHaveValue('23');
    expect(screen.getByLabelText('الشهر')).toHaveValue('11');
    expect(screen.getByLabelText('السنة')).toHaveValue('1985');
  });

  it('يقبل أرقامًا فقط', async () => {
    render(<Harness onValue={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('السنة'), '19a9x0');
    expect(screen.getByLabelText('السنة')).toHaveValue('1990');
  });
});

describe('التحقق من تاريخ الميلاد', () => {
  const base = {
    fullName: 'محمد عبد الرحمن',
    phone: '01012345678',
    whatsapp: '01012345678',
    email: 'p@example.com',
    password: 'Provider12345',
    confirmPassword: 'Provider12345',
    city: 'الفيوم',
    addressLine: 'شارع الحرية، بجوار مسجد النور',
  };
  const errorFor = (birthDate: string) => {
    const result = providerStep1Schema.safeParse({ ...base, birthDate });
    return result.success ? null : result.error.issues[0]?.message;
  };

  it('يقبل تاريخًا صحيحًا ويبقى اختياريًا', () => {
    expect(errorFor('1990-03-05')).toBeNull();
    expect(providerStep1Schema.safeParse(base).success).toBe(true);
  });

  it('يطلب إكمال الخانات الناقصة', () => {
    expect(errorFor(INCOMPLETE_DATE)).toMatch(/أكمل اليوم والشهر والسنة/);
  });

  it('يرفض تاريخًا غير موجود مثل 31 فبراير', () => {
    expect(errorFor('1990-02-31')).toMatch(/غير موجود/);
    expect(errorFor('1990-13-01')).toMatch(/غير موجود/);
  });

  it('يرفض عمرًا أقل من 18', () => {
    const recent = `${new Date().getFullYear() - 10}-01-01`;
    expect(errorFor(recent)).toMatch(/18/);
  });
});

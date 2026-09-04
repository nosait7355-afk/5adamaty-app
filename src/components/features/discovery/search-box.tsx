'use client';

import type { FormEvent } from 'react';
import { SearchInput } from './search-input';

export interface SearchBoxProps {
  value: string;
  onValueChange: (value: string) => void;
  /** يُستدعى عند Enter أو زر البحث في لوحة مفاتيح الهاتف. */
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

/**
 * حقل البحث داخل نموذج.
 *
 * الغلاف بـ`<form>` مقصود: على الهاتف يعرض المتصفح زر «بحث» في لوحة
 * المفاتيح بدل زر السطر الجديد، وضغطه يُطلق `onSubmit`.
 */
export function SearchBox({
  value,
  onValueChange,
  onSubmit,
  placeholder,
  autoFocus = false,
  className,
}: SearchBoxProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.();
  };

  return (
    <form role="search" onSubmit={handleSubmit} className={className}>
      <SearchInput
        value={value}
        onValueChange={onValueChange}
        autoFocus={autoFocus}
        {...(placeholder ? { placeholder } : {})}
      />
    </form>
  );
}

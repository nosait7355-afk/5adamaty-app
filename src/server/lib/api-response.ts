import { NextResponse } from 'next/server';
import type { ErrorCode, FieldErrors } from './errors';

/**
 * شكل الاستجابة الموحّد لكل الـAPI (ARCHITECTURE §6).
 * كل endpoint يعيد هذا الشكل بلا استثناء.
 */

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  hasMore?: boolean;
  cursor?: string | null;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiFailure {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    fields?: FieldErrors;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function ok<T>(data: T, meta?: ApiMeta, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true as const, data, ...(meta ? { meta } : {}) }, init);
}

export function created<T>(data: T): NextResponse<ApiSuccess<T>> {
  return ok(data, undefined, { status: 201 });
}

export function fail(
  code: ErrorCode,
  message: string,
  httpStatus: number,
  fields?: FieldErrors
): NextResponse<ApiFailure> {
  return NextResponse.json(
    {
      success: false as const,
      error: { code, message, ...(fields ? { fields } : {}) },
    },
    { status: httpStatus }
  );
}

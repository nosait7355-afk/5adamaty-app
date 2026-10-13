import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import { publicUrl } from '@/shared/brand';

/**
 * بديل `next/link` داخل التطبيق. الروابط الداخلية تنتقل بـreact-router،
 * والخارجية (`https:`، `tel:`، `mailto:`، واتساب) تبقى `<a>` عاديًا يفتحه
 * النظام خارج التطبيق.
 */

type Href =
  | string
  | {
      pathname?: string;
      query?: Record<string, string | number | boolean | undefined | null>;
      hash?: string;
    };

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: Href;
  replace?: boolean;
  // خيارات Next — لا معادل لها هنا
  prefetch?: boolean | null;
  scroll?: boolean;
  transitionTypes?: string[];
  children?: ReactNode;
}

function toPath(href: Href): string {
  if (typeof href === 'string') return href;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(href.query ?? {})) {
    if (value !== undefined && value !== null) search.set(key, String(value));
  }
  const query = search.toString();
  return `${href.pathname ?? ''}${query ? `?${query}` : ''}${href.hash ? `#${href.hash}` : ''}`;
}

const EXTERNAL = /^([a-z][a-z\d+.-]*:|\/\/)/i;

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, replace, prefetch: _prefetch, scroll: _scroll, transitionTypes: _types, ...rest },
  ref
) {
  const path = toPath(href);
  if (EXTERNAL.test(path)) return <a ref={ref} href={path} {...rest} />;
  /*
   * رابط داخلي في نافذة جديدة (الشروط من داخل نموذج تسجيل): لا نوافذ في
   * التطبيق، والتنقّل داخله يُضيّع النموذج المملوء — فنفتح نسخة الموقع في
   * المتصفح ويبقى النموذج كما هو.
   */
  if (rest.target === '_blank') return <a ref={ref} href={publicUrl(path)} rel="noopener noreferrer" {...rest} />;
  return <RouterLink ref={ref} to={path} {...(replace ? { replace } : {})} {...rest} />;
});

export default Link;

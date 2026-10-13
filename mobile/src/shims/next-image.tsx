import { forwardRef, type CSSProperties, type ImgHTMLAttributes } from 'react';

/**
 * بديل `next/image` داخل التطبيق — `<img>` عادي.
 *
 * لا مُحسِّن صور هنا (`/_next/image` على الخادم): صور Cloudinary تأتي
 * بتحويلاتها في الرابط أصلًا (`lib/cloudinary-url.ts`)، والصور المحلية في
 * الحزمة. `fill` و`priority` يُترجمان لما يعادلهما في HTML.
 */

interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height'> {
  src: string | { src: string };
  alt: string;
  width?: number | string;
  height?: number | string;
  fill?: boolean;
  priority?: boolean;
  quality?: number;
  unoptimized?: boolean;
  placeholder?: string;
}

const FILL_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
};

const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(
  { src, alt, fill, priority, quality: _quality, unoptimized: _unoptimized, placeholder: _placeholder, style, ...rest },
  ref
) {
  return (
    // هذا هو بديل next/image نفسه — لا مُحسِّن صور في التطبيق
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={typeof src === 'string' ? src : src.src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      {...(priority ? { fetchPriority: 'high' as const } : {})}
      style={fill ? { ...FILL_STYLE, ...style } : style}
      {...rest}
    />
  );
});

export default Image;

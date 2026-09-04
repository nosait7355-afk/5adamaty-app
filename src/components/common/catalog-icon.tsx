import {
  Activity,
  AirVent,
  Briefcase,
  Bug,
  Calculator,
  Car,
  GraduationCap,
  Grid2x2,
  Hammer,
  Home,
  Laptop,
  PaintRoller,
  PartyPopper,
  Pill,
  Scale,
  Scissors,
  Sparkles,
  Stethoscope,
  Truck,
  WashingMachine,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * أيقونات الكتالوج.
 *
 * التصنيفات والمهن تخزّن **اسم** الأيقونة نصًا في قاعدة البيانات ليتمكّن
 * Admin من تغييرها بلا نشر كود. الاستيراد الديناميكي من `lucide-react`
 * يسحب المكتبة كاملة إلى الحزمة، فنسجّل بدلًا منه خريطة صريحة للأسماء
 * المستخدمة فعلًا؛ أي اسم غير معروف يسقط إلى أيقونة محايدة بدل الانهيار.
 */
const ICONS: Record<string, LucideIcon> = {
  activity: Activity,
  'air-vent': AirVent,
  bug: Bug,
  calculator: Calculator,
  car: Car,
  'graduation-cap': GraduationCap,
  grid: Grid2x2,
  hammer: Hammer,
  home: Home,
  laptop: Laptop,
  'paint-roller': PaintRoller,
  'party-popper': PartyPopper,
  pill: Pill,
  scale: Scale,
  scissors: Scissors,
  sparkles: Sparkles,
  stethoscope: Stethoscope,
  truck: Truck,
  'washing-machine': WashingMachine,
  wrench: Wrench,
  zap: Zap,
};

export interface CatalogIconProps {
  name?: string | undefined;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function CatalogIcon({ name, size = 24, className, strokeWidth = 1.75 }: CatalogIconProps) {
  const Icon = (name && ICONS[name]) || Briefcase;
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
}

/** للاختبارات ولوحة الـDesign System. */
export const CATALOG_ICON_NAMES = Object.keys(ICONS);

import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'light';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-wine-700 text-white hover:bg-wine-600 disabled:bg-ink-muted/40',
  secondary: 'border border-ink/15 bg-white text-ink hover:border-wine-700 hover:text-wine-700',
  ghost: 'text-ink hover:bg-ink/5',
  light: 'bg-white text-burgundy-900 hover:bg-blush-100',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
};

export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', extra = '') =>
  `inline-flex items-center justify-center gap-2 rounded-lg font-semibold tracking-wide transition-colors disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${extra}`;

export function Button({
  variant,
  size,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

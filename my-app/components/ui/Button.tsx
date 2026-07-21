'use client';
// components/ui/Button.tsx
// Single shared button for the whole app. Do not create ad-hoc <button> styles
// on individual pages — extend this component instead (add a variant if needed).

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-light shadow-sm shadow-accent/20 ' +
    'disabled:bg-accent/50',
  secondary:
    'border border-gray-300 dark:border-surface-border text-gray-700 dark:text-fg ' +
    'bg-white dark:bg-surface-card hover:bg-gray-50 dark:hover:bg-surface-hover ' +
    'disabled:opacity-50',
  destructive:
    'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/50',
  ghost:
    'text-gray-600 dark:text-fg-muted hover:bg-gray-100 dark:hover:bg-white/5 ' +
    'disabled:opacity-50',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',   // 44px min height — touch-target friendly
  lg: 'h-12 px-6 text-base gap-2',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      className = '',
      children,
      ...rest
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center rounded-lg font-medium
          transition-colors duration-150 whitespace-nowrap
          focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
          disabled:cursor-not-allowed
          ${VARIANT_CLASSES[variant]}
          ${SIZE_CLASSES[size]}
          ${className}
        `}
        {...rest}
      >
        {loading && <Loader2 className="animate-spin" size={16} />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
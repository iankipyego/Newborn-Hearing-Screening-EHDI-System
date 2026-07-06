'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  border?: boolean;
  hover?: boolean;
}

const paddingStyles = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
};

const shadowStyles = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
};

export function Card({
  children,
  className = '',
  padding = 'md',
  shadow = 'sm',
  border = true,
  hover = false,
}: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl',
        border && 'border border-gray-200',
        paddingStyles[padding],
        shadowStyles[shadow],
        hover && 'transition-all duration-200 hover:shadow-md hover:border-teal-300',
        className
      )}
    >
      {children}
    </div>
  );
}
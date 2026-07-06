'use client';

import { UseFormRegister, FieldError } from 'react-hook-form';
import { cn } from '@/lib/utils/cn';

interface CheckboxProps {
  name: string;
  label: string;
  register: UseFormRegister<any>;
  error?: FieldError;
  className?: string;
  disabled?: boolean;
  helperText?: string;
}

export function Checkbox({
  name,
  label,
  register,
  error,
  className = '',
  disabled = false,
  helperText,
}: CheckboxProps) {
  const id = `field-${name}`;

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-start gap-2.5">
        <input
          id={id}
          type="checkbox"
          disabled={disabled}
          {...register(name)}
          className={cn(
            'mt-0.5 h-4 w-4 rounded border-gray-300',
            'text-teal-600 focus:ring-teal-500',
            'transition-colors duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-red-500'
          )}
        />
        <label
          htmlFor={id}
          className={cn(
            'text-sm text-gray-700 select-none',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {label}
        </label>
      </div>

      {helperText && !error && (
        <p className="text-sm text-gray-500 ml-6">{helperText}</p>
      )}

      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1 ml-6">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
          {error.message}
        </p>
      )}
    </div>
  );
}
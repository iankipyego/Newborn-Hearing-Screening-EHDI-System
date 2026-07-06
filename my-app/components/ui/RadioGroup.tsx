'use client';

import { UseFormRegister, FieldError } from 'react-hook-form';
import { cn } from '@/lib/utils/cn';

interface RadioOption {
  value: string | number | boolean;
  label: string;
}

interface RadioGroupProps {
  name: string;
  label: string;
  options: RadioOption[];
  register: UseFormRegister<any>;
  error?: FieldError;
  className?: string;
  disabled?: boolean;
  defaultValue?: string | number | boolean;
  helperText?: string;
  direction?: 'row' | 'column';
}

export function RadioGroup({
  name,
  label,
  options,
  register,
  error,
  className = '',
  disabled = false,
  defaultValue,
  helperText,
  direction = 'column',
}: RadioGroupProps) {
  const id = `field-${name}`;

  return (
    <div className={cn('space-y-1.5', className)}>
      <span className="block text-sm font-medium text-gray-700">
        {label}
      </span>

      <div
        className={cn(
          'flex gap-4',
          direction === 'column' ? 'flex-col' : 'flex-row flex-wrap'
        )}
      >
        {options.map((opt) => {
          const value = String(opt.value);
          return (
            <label
              key={value}
              className={cn(
                'flex items-center gap-2 text-sm text-gray-700',
                'cursor-pointer',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <input
                type="radio"
                value={value}
                disabled={disabled}
                defaultChecked={String(defaultValue) === value}
                {...register(name)}
                className={cn(
                  'h-4 w-4 border-gray-300 text-teal-600',
                  'focus:ring-teal-500 focus:ring-offset-2',
                  'disabled:cursor-not-allowed',
                  error && 'border-red-500'
                )}
              />
              {opt.label}
            </label>
          );
        })}
      </div>

      {helperText && !error && (
        <p className="text-sm text-gray-500">{helperText}</p>
      )}

      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
          {error.message}
        </p>
      )}
    </div>
  );
}
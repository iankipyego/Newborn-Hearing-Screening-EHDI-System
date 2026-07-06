'use client';

import { UseFormRegister, FieldError } from 'react-hook-form';
import { cn } from '@/lib/utils/cn';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  name: string;
  label: string;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  register: UseFormRegister<any>;
  error?: FieldError;
  className?: string;
  disabled?: boolean;
  defaultValue?: string;
  helperText?: string;
}

export function Select({
  name,
  label,
  options,
  placeholder = 'Select...',
  required = false,
  register,
  error,
  className = '',
  disabled = false,
  defaultValue,
  helperText,
}: SelectProps) {
  const id = `field-${name}`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      <select
        id={id}
        disabled={disabled}
        defaultValue={defaultValue}
        {...register(name)}
        className={cn(
          'w-full rounded-lg border border-gray-300',
          'px-4 py-2.5 text-gray-900',
          'appearance-none bg-white',
          'transition-colors duration-150',
          'focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20',
          'disabled:bg-gray-100 disabled:cursor-not-allowed',
          error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
          className
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

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
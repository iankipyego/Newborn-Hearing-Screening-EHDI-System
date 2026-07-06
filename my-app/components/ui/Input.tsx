'use client';

import { UseFormRegister, FieldError } from 'react-hook-form';
import { cn } from '@/lib/utils/cn';

interface InputProps {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'number' | 'date' | 'datetime-local' | 'tel' | 'password' | 'textarea';
  placeholder?: string;
  required?: boolean;
  register: UseFormRegister<any>;
  error?: FieldError;
  className?: string;
  disabled?: boolean;
  defaultValue?: any;
  step?: string | number;
  min?: number;
  max?: number;
  rows?: number;
  helperText?: string;
}

export function Input({
  name,
  label,
  type = 'text',
  placeholder,
  required = false,
  register,
  error,
  className = '',
  disabled = false,
  defaultValue,
  step,
  min,
  max,
  rows = 3,
  helperText,
}: InputProps) {
  const isTextarea = type === 'textarea';
  const id = `field-${name}`;

  const commonProps = {
    id,
    placeholder,
    disabled,
    defaultValue,
    ...register(name),
    className: cn(
      'w-full rounded-lg border border-gray-300',
      'px-4 py-2.5 text-gray-900',
      'transition-colors duration-150',
      'focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20',
      'disabled:bg-gray-100 disabled:cursor-not-allowed',
      error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
      className
    ),
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {isTextarea ? (
        <textarea rows={rows} {...commonProps} />
      ) : (
        <input
          type={type}
          step={step}
          min={min}
          max={max}
          {...commonProps}
        />
      )}

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
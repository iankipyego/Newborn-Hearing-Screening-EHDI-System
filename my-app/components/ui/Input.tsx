'use client';

import { forwardRef } from 'react';
import { useFormContext } from 'react-hook-form';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, required, className = '', id, ...props }, ref) => {
    const { register, formState: { errors } } = useFormContext();
    const fieldError = id ? errors?.[id]?.message : error;

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-fg">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          {...register(id)}
          aria-invalid={fieldError ? 'true' : 'false'}
          aria-describedby={fieldError ? `${id}-error` : undefined}
          className={`w-full px-3.5 py-2.5 rounded-lg text-sm border bg-white dark:bg-surface-card
            text-gray-900 dark:text-fg placeholder-gray-400 dark:placeholder-fg-muted
            focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent
            disabled:opacity-50 disabled:cursor-not-allowed
            ${fieldError ? 'border-red-300 dark:border-red-800/60' : 'border-gray-300 dark:border-surface-border'}
            ${className}`}
          {...props}
        />
        {fieldError && (
          <p id={`${id}-error`} className="text-xs text-red-600 dark:text-red-400">{fieldError}</p>
        )}
        {hint && !fieldError && (
          <p className="text-xs text-gray-500 dark:text-fg-muted">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
'use client';

import { forwardRef } from 'react';
import { useFormContext } from 'react-hook-form';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label: string;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  error?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, placeholder, required, error, className = '', id, ...props }, ref) => {
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
        <div className="relative">
          <select
            ref={ref}
            id={id}
            {...register(id)}
            aria-invalid={fieldError ? 'true' : 'undefined'}
            aria-describedby={fieldError ? `${id}-error` : undefined}
            className={`w-full px-3.5 py-2.5 rounded-lg text-sm border bg-white dark:bg-surface-card
              text-gray-900 dark:text-fg appearance-none
              focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent
              disabled:opacity-50 disabled:cursor-not-allowed
              ${fieldError ? 'border-red-300 dark:border-red-800/60' : 'border-gray-300 dark:border-surface-border'}
              ${className}`}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>{placeholder}</option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-fg-muted"
          />
        </div>
        {fieldError && (
          <p id={`${id}-error`} className="text-xs text-red-600 dark:text-red-400">{fieldError}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
export default Select;
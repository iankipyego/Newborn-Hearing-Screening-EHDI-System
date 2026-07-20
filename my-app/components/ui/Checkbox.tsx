'use client';

import { useFormContext } from 'react-hook-form';
import { Check } from 'lucide-react';

interface CheckboxProps {
  id: string;
  label: string;
  autoSuggested?: boolean;
  autoSuggestedReason?: string;
  disabled?: boolean;
}

export default function Checkbox({ id, label, autoSuggested, autoSuggestedReason, disabled = false }: CheckboxProps) {
  const { setValue, watch } = useFormContext();
  const value = watch(id) || false;

  const handleClick = () => {
    if (disabled) return;
    setValue(id, !value, { shouldValidate: true });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-150 text-left
        ${value
          ? 'bg-accent/10 dark:bg-accent/10 border-accent/30 dark:border-accent/20'
          : 'bg-white dark:bg-surface-card border-gray-200 dark:border-surface-border hover:border-gray-300 dark:hover:border-surface-hover'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <div
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-150
          ${value
            ? 'bg-accent border-accent'
            : 'border-gray-300 dark:border-surface-border'
          }`}
      >
        {value && <Check size={12} className="text-white" strokeWidth={3} />}
      </div>
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium leading-tight ${value ? 'text-accent-700 dark:text-accent-light' : 'text-gray-700 dark:text-fg'}`}>
          {label}
        </span>
        {autoSuggested && !value && (
          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Auto: {autoSuggestedReason}
          </span>
        )}
      </div>
    </button>
  );
}
import { Info, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { useState } from 'react';

type AlertVariant = 'info' | 'warning' | 'success';

interface AlertProps {
  variant?: AlertVariant;
  children: React.ReactNode;
  dismissible?: boolean;
}

const styles = {
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40',
    text: 'text-blue-800 dark:text-blue-300',
    icon: 'text-blue-500 dark:text-blue-400',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40',
    text: 'text-amber-800 dark:text-amber-300',
    icon: 'text-amber-500 dark:text-amber-400',
  },
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40',
    text: 'text-emerald-800 dark:text-emerald-300',
    icon: 'text-emerald-500 dark:text-emerald-400',
  },
};

const icons = { info: Info, warning: AlertTriangle, success: CheckCircle };

export default function Alert({ variant = 'info', children, dismissible = false }: AlertProps) {
  const [visible, setVisible] = useState(true);
  const s = styles[variant];
  const Icon = icons[variant];

  if (!visible) return null;

  return (
    <div className={`rounded-xl border p-4 ${s.bg} ${s.text} flex items-start gap-3`}>
      <Icon size={18} className={`shrink-0 mt-0.5 ${s.icon}`} />
      <div className="flex-1 text-sm leading-relaxed">{children}</div>
      {dismissible && (
        <button
          onClick={() => setVisible(false)}
          className="shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          aria-label="Dismiss"
        >
          <X size={16} className="text-current opacity-50" />
        </button>
      )}
    </div>
  );
}
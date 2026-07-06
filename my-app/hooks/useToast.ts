'use client';

import { useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastState {
  message: string;
  type: ToastType;
}

interface UseToastReturn {
  toast: ToastState | null;
  setToast: (toast: ToastState | null) => void;
  showToast: (message: string, type?: ToastType) => void;
  hideToast: () => void;
}

export function useToast(): UseToastReturn {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  return {
    toast,
    setToast,
    showToast,
    hideToast,
  };
}
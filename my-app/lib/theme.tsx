'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

type Theme = 'light' | 'dark';

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ theme: 'light', toggle: () => {} });

export function useTheme() {
  return useContext(Ctx);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem('theme') as Theme) ?? 'light';
    setTheme(stored);
    document.documentElement.classList.toggle('dark', stored === 'dark');
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  };

  // Don't render children until we've read the theme from localStorage.
  // This prevents a flash of the wrong theme on load.
  if (!mounted) {
    return <div style={{ visibility: 'hidden' }} />;
  }

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}
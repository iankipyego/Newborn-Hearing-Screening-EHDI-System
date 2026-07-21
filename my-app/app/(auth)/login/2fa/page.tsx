// app/(auth)/login/2fa/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';

export default function TwoFactorPage() {
  const [code, setCode]         = useState('');
  const [testCode, setTestCode] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [mounted, setMounted]   = useState(false);
  const inputRef                = useRef<HTMLInputElement>(null);
  const router                  = useRouter();
  const searchParams            = useSearchParams();

  const tempToken   = searchParams.get('token') ?? '';
  const codeFromUrl = searchParams.get('code')  ?? '';

  useEffect(() => {
    if (!tempToken) { router.replace('/login'); return; }
    if (codeFromUrl) setTestCode(codeFromUrl);
    inputRef.current?.focus();
  }, [tempToken, codeFromUrl, router]);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (mounted && codeFromUrl) setCode(codeFromUrl);
  }, [mounted, codeFromUrl]);

  const submit = async (submittedCode: string) => {
    if (loading || submittedCode.length !== 6) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/2fa/challenge', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ temp_token: tempToken, code: submittedCode }),
      });

      const text = await res.text();
      if (!text) throw new Error('Empty response from server');
      const data = JSON.parse(text);

      if (!res.ok) throw new Error(data.error || '2FA verification failed');

      document.cookie = [
        `access_token=${data.access_token}`,
        'path=/',
        'SameSite=Lax',
        ...(window.location.protocol === 'https:' ? ['Secure'] : []),
      ].join('; ');

      localStorage.setItem('access_token',  data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('user',          JSON.stringify(data.user));

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '2FA verification failed');
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(code);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(val);
    if (val.length === 6 && !codeFromUrl) submit(val);
  };

  if (!tempToken) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-surface px-4">
      <div className="w-full max-w-md space-y-6 p-8 rounded-2xl border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-card shadow-sm">
        <div className="text-center space-y-2">
          <div className="mx-auto w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <ShieldCheck className="text-accent" size={18} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-fg">Two-Factor Authentication</h1>
          <p className="text-sm text-gray-500 dark:text-fg-muted">
            {testCode
              ? 'A verification code has been generated for you'
              : 'Enter the code from your authenticator app'}
          </p>
        </div>

        {mounted && testCode && (
          <Alert variant="warning">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1">Development mode</p>
            <p className="mb-2">Your verification code:</p>
            <p className="text-2xl font-bold text-center tracking-[0.3em] font-mono text-gray-900 dark:text-fg">
              {testCode}
            </p>
            <p className="text-xs mt-2">
              In production this is sent via SMS, WhatsApp, or email. Set{' '}
              <code className="bg-black/5 dark:bg-white/10 px-1 rounded">TWO_FACTOR_DELIVERY=sms</code> in .env to switch.
            </p>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-fg">
              Verification Code
            </label>
            <input
              id="code"
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={handleChange}
              placeholder="000000"
              maxLength={6}
              required
              className="mt-1.5 w-full px-3.5 py-3 rounded-lg text-center text-2xl tracking-[0.4em] font-mono
                         border border-gray-300 dark:border-surface-border bg-white dark:bg-surface-card
                         text-gray-900 dark:text-fg
                         focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>

          {error && <Alert variant="warning">{error}</Alert>}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            disabled={code.length < 6}
            className="w-full"
          >
            {loading ? 'Verifying…' : 'Verify & Continue'}
          </Button>

          <div className="text-center">
            <Button type="button" variant="ghost" size="sm" onClick={() => router.push('/login')}>
              ← Back to login
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
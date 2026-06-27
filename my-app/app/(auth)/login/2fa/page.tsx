'use client';
// app/(auth)/login/2fa/page.tsx

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function TwoFactorPage() {
  const [code, setCode]         = useState('');
  const [testCode, setTestCode] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
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

      // Guard against empty body before parsing JSON
      const text = await res.text();
      if (!text) throw new Error('Empty response from server');
      const data = JSON.parse(text);

      if (!res.ok) throw new Error(data.error || '2FA verification failed');

      // Store access token in cookie so middleware.ts can read it
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
    // Auto-submit when 6 digits typed (not from URL auto-fill)
    if (val.length === 6 && !codeFromUrl) submit(val);
  };

  // Fill from URL code only after component is fully mounted — avoids hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (mounted && codeFromUrl) {
      setCode(codeFromUrl);
    }
  }, [mounted, codeFromUrl]);

  if (!tempToken) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div>
          <h1 className="text-center text-2xl font-bold text-gray-900">
            Two-Factor Authentication
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            {testCode
              ? 'A verification code has been generated for you'
              : 'Enter the code from your authenticator app'}
          </p>
        </div>

        {/* Test mode banner — disappears when TWO_FACTOR_DELIVERY != test */}
        {mounted && testCode && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
              ⚠ Development mode
            </p>
            <p className="text-sm text-gray-600 text-center mb-2">Your verification code:</p>
            <p className="text-3xl font-bold text-center text-amber-800 tracking-[0.3em]">
              {testCode}
            </p>
            <p className="text-xs text-center text-gray-500 mt-2">
              In production this will be sent via SMS, WhatsApp, or email.
              <br />
              Set <code className="bg-gray-100 px-1 rounded">TWO_FACTOR_DELIVERY=sms</code> in .env to switch.
            </p>
          </div>
        )}

        <form className="mt-4 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700">
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
              className="mt-1 w-full px-3 py-3 border border-gray-300 rounded-md shadow-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500
                         text-center text-2xl tracking-[0.4em] font-mono"
              maxLength={6}
              required
            />
          </div>

          {error && (
            <div className="text-red-700 text-sm bg-red-50 border border-red-200 p-3 rounded-md">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md
                       hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {loading ? 'Verifying…' : 'Verify & Continue'}
          </button>

          <div className="text-center text-sm">
            <button type="button" className="text-blue-600 hover:underline"
              onClick={() => router.push('/login')}>
              ← Back to login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
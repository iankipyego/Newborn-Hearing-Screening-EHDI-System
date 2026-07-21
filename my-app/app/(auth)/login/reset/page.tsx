// app/(auth)/login/reset/page.tsx
//
// NOTE: This calls POST /api/v1/auth/reset/request, which does not exist yet
// in app/api/v1/auth/[...route]/route.ts. That endpoint needs to be added
// (accept { email }, always return 200 regardless of whether the email
// exists — never reveal account existence — and email/SMS a time-limited
// reset link containing a token that route.ts also needs to issue and
// verify). This page is UI-complete and ready to wire up once that
// endpoint exists.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';

const RequestSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});
type RequestValues = z.infer<typeof RequestSchema>;

export default function ResetRequestPage() {
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const methods = useForm<RequestValues>({
    resolver: zodResolver(RequestSchema),
    defaultValues: { email: '' },
  });
  const { handleSubmit } = methods;

  const onSubmit = async (values: RequestValues) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      // Always treat as success once the request completes — never reveal
      // whether the email exists in the system.
      if (!res.ok && res.status >= 500) {
        throw new Error('Something went wrong. Please try again.');
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-surface px-4">
      <div className="w-full max-w-md space-y-6 p-8 rounded-2xl border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-card shadow-sm">
        <div className="text-center space-y-2">
          <div className="mx-auto w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <KeyRound className="text-accent" size={18} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-fg">Reset your password</h1>
          <p className="text-sm text-gray-500 dark:text-fg-muted">
            Enter your account email and we&apos;ll send you a reset link.
          </p>
        </div>

        {error && <Alert variant="warning">{error}</Alert>}

        {sent ? (
          <Alert variant="success">
            If an account exists for that email, a reset link is on its way. Check your inbox
            (and spam folder) for the next step.
          </Alert>
        ) : (
          <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <Input id="email" label="Email" type="email" required autoComplete="username" />
              <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
                {loading ? 'Sending…' : 'Send Reset Link'}
              </Button>
            </form>
          </FormProvider>
        )}

        <div className="text-center">
          <Link href="/login" className="text-sm text-accent hover:underline">
            ← Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
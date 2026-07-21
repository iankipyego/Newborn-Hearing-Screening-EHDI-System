// app/(auth)/login/reset/[token]/page.tsx
//
// NOTE: This calls POST /api/v1/auth/reset/confirm, which does not exist
// yet in app/api/v1/auth/[...route]/route.ts. That endpoint needs to
// accept { token, password }, verify the token (single-use, time-limited —
// reuse the signTempToken/verifyTempToken pattern already in lib/auth/jwt.ts
// rather than inventing a new token scheme), hash the new password with
// bcrypt (matching handleLogin's compare logic), and invalidate the token
// after use. This page is UI-complete and ready to wire up once that
// endpoint exists.
'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';

const ConfirmSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
type ConfirmValues = z.infer<typeof ConfirmSchema>;

export default function ResetConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const methods = useForm<ConfirmValues>({
    resolver: zodResolver(ConfirmSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const { handleSubmit } = methods;

  const onSubmit = async (values: ConfirmValues) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: values.password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.error || 'This reset link is invalid or has expired.');

      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-surface px-4">
      <div className="w-full max-w-md space-y-6 p-8 rounded-2xl border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-card shadow-sm">
        <div className="text-center space-y-2">
          <div className="mx-auto w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Lock className="text-accent" size={18} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-fg">Set a new password</h1>
          <p className="text-sm text-gray-500 dark:text-fg-muted">
            Choose a new password for your account.
          </p>
        </div>

        {error && <Alert variant="warning">{error}</Alert>}

        {success ? (
          <Alert variant="success">
            Password updated. Redirecting you to sign in…
          </Alert>
        ) : (
          <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <Input
                id="password"
                label="New password"
                type="password"
                required
                autoComplete="new-password"
                hint="At least 8 characters."
              />
              <Input
                id="confirmPassword"
                label="Confirm new password"
                type="password"
                required
                autoComplete="new-password"
              />
              <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
                {loading ? 'Saving…' : 'Save New Password'}
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
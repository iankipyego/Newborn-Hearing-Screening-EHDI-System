// app/(auth)/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ear } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';

const LoginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type LoginValues = z.infer<typeof LoginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const methods = useForm<LoginValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  });
  const { handleSubmit } = methods;

  const onSubmit = async (values: LoginValues) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Login failed');

      if (data.test_code) {
        router.push(`/login/2fa?token=${data.temp_token}&code=${data.test_code}`);
      } else if (data.requires_2fa) {
        router.push(`/login/2fa?token=${data.temp_token}`);
      } else {
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-surface px-4">
      <div className="w-full max-w-md space-y-6 p-8 rounded-2xl border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-card shadow-sm">
        <div className="text-center space-y-2">
          {/* <div className="mx-auto w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Ear className="text-accent" size={18} />
          </div> */}
          <h1 className="text-xl font-bold text-gray-900 dark:text-fg">EHDI</h1>
          <p className="text-sm text-gray-500 dark:text-fg-muted">Newborn Hearing Screening System</p>
        </div>

        {error && <Alert variant="warning">{error}</Alert>}

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Input id="email" label="Email" type="email" required autoComplete="username" />
            <Input id="password" label="Password" type="password" required autoComplete="current-password" />

            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>

            <div className="text-center">
              <a href="/login/reset" className="text-sm text-accent hover:underline">
                Forgot your password?
              </a>
            </div>
          </form>
        </FormProvider>

        {/* {process.env.NODE_ENV !== 'production' && (
          <p className="text-center text-xs text-gray-400 dark:text-fg-muted/60 border-t border-gray-100 dark:border-surface-border pt-3">
            Dev only: admin@test.com / Test1234!
          </p>
        )} */}
      </div>
    </div>
  );
}
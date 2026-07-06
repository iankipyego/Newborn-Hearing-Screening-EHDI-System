import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify } from 'jose';
import { RegistrationForm } from '@/components/forms/RegistrationForm';
import { Card } from '@/components/ui/Card';

function getAccessSecret(): Uint8Array {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET environment variable is required');
  }
  return new TextEncoder().encode(secret);
}

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getAccessSecret());
    return payload;
  } catch {
    return null;
  }
}

export default async function NewChildPage() {
  const user = await getCurrentUser();

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/login?from=/children/new');
  }

  // Check role - only DATA_CLERK and ADMIN can register
  const allowedRoles = ['DATA_CLERK', 'ADMIN'];
  if (!allowedRoles.includes(user.role as string)) {
    redirect('/dashboard');
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Register New Child</h1>
        <p className="text-sm text-gray-500 mt-1">
          Complete all sections to register a newborn for hearing screening
        </p>
      </div>

      <Card padding="none" shadow="md" border>
        <RegistrationForm />
      </Card>
    </div>
  );
}
// app/(app)/layout.tsx
// Authenticated route group layout.
// Wraps every page under (app)/ with the sidebar + top bar shell.
// middleware.ts already ensures only authenticated users reach these routes.

import AppLayout from '@/components/layout/AppLayout';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}

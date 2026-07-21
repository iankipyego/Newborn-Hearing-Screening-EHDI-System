import Link from 'next/link';
import { Ear, ShieldCheck } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-surface px-6">
      {/* <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-6">
        <Ear className="text-accent" size={20} />
      </div> */}

      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-fg text-center">
        EHDI
      </h1>
      <p className="mt-2 max-w-md text-center text-sm sm:text-base text-gray-600 dark:text-fg-muted">
        Newborn Hearing Screening &amp; Early Hearing Detection and Intervention
        system for CHISHLO and Mama Rachel Hospital.
      </p>

      <div className="mt-8">
        <Link href="/login">
          <Button variant="primary" size="lg">
            Sign In
          </Button>
        </Link>
      </div>

      <div className="mt-10 flex items-center gap-2 text-xs text-gray-400 dark:text-fg-muted/60">
        <ShieldCheck size={14} />
        <span>Authorized staff access only &middot; CHISHLO</span>
      </div>
    </div>
  );
}
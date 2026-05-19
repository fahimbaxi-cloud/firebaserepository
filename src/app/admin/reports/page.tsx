
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function ReportsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/reports/accounting');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center py-32">
      <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Navigating to Reports...</p>
    </div>
  );
}


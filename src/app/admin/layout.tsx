
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar as SidebarComponent } from "@/components/layout/AppSidebar";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Loader2 } from "lucide-react";
import { useFirestore } from "@/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { User } from "@/lib/types";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const firestore = useFirestore();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

  useEffect(() => {
    const verifyAccess = async () => {
      const loggedId = localStorage.getItem('bacchabite_logged_id');
      if (!loggedId) {
        router.replace('/');
        return;
      }

      try {
        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, where('bacchabiteId', '==', loggedId), limit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const doc = querySnapshot.docs[0];
          const userData = { ...doc.data(), id: doc.id } as User;
          if (userData.role === 'admin' || userData.role === 'super-admin') {
            setIsAuthorized(true);
          } else {
            router.replace('/');
          }
        } else {
          router.replace('/');
        }
      } catch (e) {
        router.replace('/');
      }
    };

    verifyAccess();
  }, [router, firestore]);

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-secondary/10 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Verifying Admin Access...</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="print:hidden">
        <SidebarComponent />
      </div>
      <SidebarInset className="bg-secondary/10">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-secondary/20 bg-white/50 backdrop-blur-md sticky top-0 z-20 px-4 print:hidden">
          <div className="flex items-center gap-1">
            <SidebarTrigger className="text-primary hover:bg-primary/10 rounded-full h-12 w-12" />
            <Separator orientation="vertical" className="mx-1 h-6" />
          </div>
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <div className="relative w-9 h-9 rounded-full overflow-hidden border border-primary/20 md:hidden bg-white shadow-sm shrink-0">
              <Image 
                src={logo?.imageUrl || "https://picsum.photos/seed/baccha-logo/200/200"}
                alt="Logo"
                fill
                className="object-contain p-1"
                data-ai-hint={logo?.imageHint || "food logo"}
              />
            </div>
            <span className="font-bold text-[10px] md:text-xs text-muted-foreground uppercase tracking-widest truncate">
              BacchaBite Admin
            </span>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-8 pt-4 print:p-0 print:bg-white">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

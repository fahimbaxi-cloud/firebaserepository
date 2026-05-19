
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Lock, Fingerprint, CalendarDays, Loader2, Sparkles, ZoomIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { BroadcastPackage } from '@/lib/types';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const [bacchabiteId, setBacchabiteId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

  // Fetch broadcasted packages to show a featured one on login
  const packagesQuery = useMemoFirebase(() => collection(firestore, 'packages'), [firestore]);
  const { data: packages = [] } = useCollection<BroadcastPackage>(packagesQuery);

  const featuredPackage = useMemo(() => {
    if (!packages || packages.length === 0) return null;
    const now = new Date();
    
    // Priority 1: Current Month Subscription
    const currentMonthStr = format(now, 'MMMM yyyy');
    const monthSub = packages.find(p => p.type === 'monthly' && p.dateContext === currentMonthStr);
    if (monthSub) return monthSub;
    
    // Priority 2: Tomorrow's Daily Special
    const tomorrow = addDays(now, 1);
    const tomorrowStr = format(tomorrow, 'MMMM d, yyyy');
    const tomorrowPkg = packages.find(p => p.type === 'daily' && p.dateContext === tomorrowStr);
    if (tomorrowPkg) return tomorrowPkg;
    
    // Priority 3: Day after Tomorrow
    const dayAfter = addDays(now, 2);
    const dayAfterStr = format(dayAfter, 'MMMM d, yyyy');
    const dayAfterPkg = packages.find(p => p.type === 'daily' && p.dateContext === dayAfterStr);
    if (dayAfterPkg) return dayAfterPkg;
    
    return null;
  }, [packages]);

  useEffect(() => {
    const loggedId = localStorage.getItem('bacchabite_logged_id');
    if (loggedId) {
      // Session checking delay
      setCheckingSession(false);
    } else {
      setCheckingSession(false);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('bacchabiteId', '==', bacchabiteId.trim()), limit(1));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();

        if (userData.password && userData.password !== password) {
          toast({
            title: "Login Failed",
            description: "Invalid password.",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }

        let destination = '/customer';
        let roleName = 'Customer';

        if (userData.role === 'admin' || userData.role === 'super-admin') {
          destination = '/admin';
          roleName = userData.role === 'super-admin' ? 'Super Admin' : 'Administrator';
        } else if (userData.role === 'delivery') {
          destination = '/delivery';
          roleName = 'Delivery Partner';
        }

        localStorage.setItem('bacchabite_logged_id', userData.bacchabiteId);

        toast({
          title: "Login Successful",
          description: `Welcome back, ${roleName}!`,
        });
        
        router.replace(destination);
      } else {
        toast({
          title: "Login Failed",
          description: "Invalid BacchaBite ID.",
          variant: "destructive"
        });
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "An error occurred during login. Please try again.",
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-secondary/30 flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-sm font-bold text-muted-foreground animate-pulse uppercase tracking-widest">Checking Session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30 flex flex-col items-center justify-center p-6 py-12">
      <div className="mb-8 text-center flex flex-col items-center">
        <div className="relative w-32 h-32 mb-4 rounded-full overflow-hidden border-4 border-white shadow-xl bg-white">
          <Image 
            src={logo?.imageUrl || "/logo.png"}
            alt="BacchaBite Logo"
            fill
            className="object-contain p-2"
            data-ai-hint="food logo"
          />
        </div>
        <h1 className="text-4xl font-headline font-bold text-primary">BacchaBite</h1>
        <p className="text-muted-foreground font-medium">Healthy Meals for Happy Kids</p>
      </div>

      <Card className="w-full max-w-md shadow-2xl border-none rounded-[2.5rem] overflow-hidden bg-white">
        <CardHeader className="pt-10 pb-4 text-center">
          <CardTitle className="text-3xl font-headline font-bold">Welcome Back</CardTitle>
          <CardDescription className="text-muted-foreground font-medium">
            Enter your BacchaBite ID to access your portal
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {featuredPackage && (
              <div className="rounded-3xl overflow-hidden border border-secondary shadow-md bg-white mb-4 group cursor-default">
                <div className="relative h-44 w-full group/image">
                  <Image 
                    src={featuredPackage.imageUrl || "https://picsum.photos/seed/featured/600/400"} 
                    alt={featuredPackage.name} 
                    fill 
                    className="object-cover transition-transform duration-700 group-hover/image:scale-105"
                    data-ai-hint="healthy kid meal"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover/image:opacity-100 transition-opacity duration-300 z-10">
                        <ZoomIn className="w-8 h-8 text-white" />
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-none">
                      <DialogHeader className="sr-only">
                        <DialogTitle>{featuredPackage.name}</DialogTitle>
                        <DialogDescription>Full view of the package image</DialogDescription>
                      </DialogHeader>
                      <div className="relative w-full aspect-video rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl">
                        <Image 
                          src={featuredPackage.imageUrl || "https://picsum.photos/seed/featured/600/400"} 
                          alt={featuredPackage.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    </DialogContent>
                  </Dialog>

                  <div className="absolute top-4 left-4">
                    <div className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full shadow-lg border border-white/20",
                      featuredPackage.type === 'monthly' ? "bg-accent" : "bg-primary"
                    )}>
                      {featuredPackage.type === 'monthly' ? <Sparkles className="w-3 h-3 text-white" /> : <CalendarDays className="w-3 h-3 text-white" />}
                      <span className="text-[10px] font-black uppercase tracking-wider text-white">
                        {featuredPackage.dateContext} {featuredPackage.type === 'monthly' ? 'Plan' : 'Special'}
                      </span>
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-white font-bold text-lg leading-tight">{featuredPackage.name}</h3>
                    <p className="text-white/80 text-[10px] font-medium mt-0.5 line-clamp-1">
                      {featuredPackage.message}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="bacchabiteId">BacchaBite ID</Label>
                <Link href="/signup">
                  <span className="text-[10px] font-bold text-primary hover:underline">New here?</span>
                </Link>
              </div>
              <div className="relative">
                <Input 
                  id="bacchabiteId" 
                  type="text"
                  placeholder="e.g. BB-CUST-01" 
                  className="pl-11 h-14 rounded-2xl border-secondary focus:border-primary transition-all font-bold"
                  value={bacchabiteId}
                  onChange={(e) => setBacchabiteId(e.target.value)}
                  required
                />
                <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Your password</Label>
                <Link href="/forgot-password">
                  <span className="text-xs text-primary font-bold hover:underline">Forgot?</span>
                </Link>
              </div>
              <div className="relative">
                <Input 
                  id="password" 
                  type="password"
                  placeholder="••••••••" 
                  className="pl-11 h-14 rounded-2xl border-secondary focus:border-primary transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-14 bg-primary hover:bg-primary/90 rounded-2xl font-bold text-lg shadow-lg shadow-primary/20 transition-all active:scale-[0.98]" 
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : "Sign In"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="bg-secondary/20 p-8 flex flex-col gap-4 border-t border-secondary/30">
          <p className="text-sm text-muted-foreground text-center font-medium">
            Enter your unique BacchaBite ID to manage your healthy bites.
          </p>
        </CardFooter>
      </Card>
      
      <footer className="mt-12 text-muted-foreground text-xs font-medium">
        © 2026 BacchaBite Food Services. All rights reserved.
      </footer>
    </div>
  );
}

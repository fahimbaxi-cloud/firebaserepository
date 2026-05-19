
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, Mail, ShieldCheck, Truck, Star, Clock, Lock, Key, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, getDocs, limit, doc } from 'firebase/firestore';
import { User } from '@/lib/types';

export default function DeliveryProfilePage() {
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // State for password change
  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  useEffect(() => {
    const fetchRiderProfile = async () => {
      const loggedId = localStorage.getItem('bacchabite_logged_id');
      if (!loggedId) {
        router.replace('/');
        return;
      }

      try {
        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, where('bacchabiteId', '==', loggedId), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const doc = snap.docs[0];
          setProfile({ ...doc.data(), id: doc.id } as User);
        } else {
          router.replace('/');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchRiderProfile();
  }, [firestore, router]);

  const handlePasswordUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    if (!passwordData.current || !passwordData.new || !passwordData.confirm) {
      toast({ title: "Missing Fields", description: "Please fill in all password fields.", variant: "destructive" });
      return;
    }

    if (passwordData.new !== passwordData.confirm) {
      toast({ title: "Mismatch", description: "New password and confirmation do not match.", variant: "destructive" });
      return;
    }

    const userRef = doc(firestore, 'users', profile.id);
    updateDocumentNonBlocking(userRef, { password: passwordData.new, updatedAt: new Date().toISOString() });

    toast({ title: "Password Updated", description: "Your partner credentials have been successfully updated in Firestore." });
    setPasswordData({ current: '', new: '', confirm: '' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-50/30 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Syncing Partner Profile...</p>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="pb-24 md:pb-0 md:pt-16 min-h-screen bg-blue-50/30">
      <Navbar role="delivery" />
      
      <main className="max-w-3xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-headline font-bold text-blue-600">Partner Profile</h1>
          <p className="text-muted-foreground mt-1 font-medium">View your stats and partner details from Cloud Firestore.</p>
        </header>

        <div className="space-y-6">
          <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <Avatar className="w-24 h-24 border-4 border-blue-100">
                  <AvatarImage src={`https://picsum.photos/seed/${profile.bacchabiteId}/200`} />
                  <AvatarFallback className="text-2xl font-bold bg-blue-600 text-white">{profile.firstName[0]}{profile.lastName[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-center md:text-left">
                  <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                    <h2 className="text-2xl font-bold">{profile.firstName} {profile.lastName}</h2>
                    <Badge className="w-fit mx-auto md:mx-0 bg-blue-100 text-blue-600 border-none uppercase">
                      {profile.role} PARTNER
                    </Badge>
                  </div>
                  <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground font-medium">
                    <ShieldCheck className="w-4 h-4" />
                    <span>ID: {profile.bacchabiteId}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-4">
            <Card className="rounded-3xl border-none shadow-sm bg-white p-4 text-center">
              <Star className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
              <p className="text-xl font-bold">4.8</p>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Rating</p>
            </Card>
            <Card className="rounded-3xl border-none shadow-sm bg-white p-4 text-center">
              <Truck className="w-5 h-5 text-blue-600 mx-auto mb-1" />
              <p className="text-xl font-bold">124</p>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Orders</p>
            </Card>
            <Card className="rounded-3xl border-none shadow-sm bg-white p-4 text-center">
              <Clock className="w-5 h-5 text-green-600 mx-auto mb-1" />
              <p className="text-lg font-bold">10m</p>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Avg Time</p>
            </Card>
          </div>

          <Card className="rounded-[2.5rem] border-none shadow-lg overflow-hidden bg-white">
            <CardHeader className="bg-blue-50 p-8 pb-4">
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-blue-700"><Lock className="w-5 h-5" />Security Settings</CardTitle>
              <CardDescription className="font-medium text-blue-600/70">Update your partner portal login password.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <form onSubmit={handlePasswordUpdate} className="space-y-5">
                <div className="space-y-2"><Label htmlFor="current-password">Current Password</Label><div className="relative"><Input id="current-password" type="password" placeholder="••••••••" value={passwordData.current} onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })} className="pl-11 h-12 rounded-2xl bg-slate-50 border-blue-50 font-bold focus:border-blue-200" /><Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /></div></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="new-password">New Password</Label><div className="relative"><Input id="new-password" type="password" placeholder="••••••••" value={passwordData.new} onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })} className="pl-11 h-12 rounded-2xl bg-slate-50 border-blue-50 font-bold focus:border-blue-200" /><Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /></div></div>
                  <div className="space-y-2"><Label htmlFor="confirm-password">Confirm New Password</Label><div className="relative"><Input id="confirm-password" type="password" placeholder="••••••••" value={passwordData.confirm} onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })} className="pl-11 h-12 rounded-2xl bg-slate-50 border-blue-50 font-bold focus:border-blue-200" /><CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /></div></div>
                </div>
                <Button type="submit" className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-lg shadow-blue-200 transition-all active:scale-95">Update My Password</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-none shadow-sm bg-white">
            <CardHeader><CardTitle className="text-sm font-bold uppercase text-muted-foreground">Partner Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3"><div className="p-2 bg-blue-50 rounded-lg"><Mail className="w-4 h-4 text-blue-600" /></div><div><p className="text-xs text-muted-foreground">Email Address</p><p className="font-bold">{profile.email}</p></div></div>
              <div className="flex items-center gap-3"><div className="p-2 bg-blue-50 rounded-lg"><Phone className="w-4 h-4 text-blue-600" /></div><div><p className="text-xs text-muted-foreground">Mobile Number</p><p className="font-bold">{profile.mobileNumber}</p></div></div>
              <div className="flex items-center gap-3"><div className="p-2 bg-blue-50 rounded-lg"><Clock className="w-4 h-4 text-blue-600" /></div><div><p className="text-xs text-muted-foreground">Partner Since</p><p className="font-bold">{new Date(profile.createdAt).toLocaleDateString()}</p></div></div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

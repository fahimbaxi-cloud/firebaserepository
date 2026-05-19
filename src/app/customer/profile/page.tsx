"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Edit3, 
  Lock, 
  Key, 
  CheckCircle2, 
  Fingerprint,
  Loader2,
  User as UserIcon
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, getDocs, limit, doc } from 'firebase/firestore';
import { User } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';

export default function CustomerProfilePage() {
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile Edit state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobileNumber: '',
    address: ''
  });

  // Password Update state
  const [passwordData, setPasswordData] = useState({
    new: '',
    confirm: ''
  });

  useEffect(() => {
    const fetchProfile = async () => {
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
          const docSnap = snap.docs[0];
          const data = { ...docSnap.data(), id: docSnap.id } as User;
          setProfile(data);
          setEditForm({
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            mobileNumber: data.mobileNumber || '',
            address: data.address || ''
          });
        } else {
          router.replace('/');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [firestore, router]);

  const handleProfileUpdate = () => {
    if (!profile) return;

    if (!editForm.firstName || !editForm.lastName || !editForm.email) {
      toast({ title: "Required Fields", description: "Name and Email are mandatory.", variant: "destructive" });
      return;
    }

    const userRef = doc(firestore, 'users', profile.id);
    updateDocumentNonBlocking(userRef, {
      ...editForm,
      updatedAt: new Date().toISOString()
    });

    setProfile({ ...profile, ...editForm });
    toast({ title: "Profile Saved", description: "Your details have been updated successfully." });
    setIsEditOpen(false);
  };

  const handlePasswordUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    if (!passwordData.new || !passwordData.confirm) {
      toast({ title: "Empty Fields", description: "Please enter your new password.", variant: "destructive" });
      return;
    }

    if (passwordData.new !== passwordData.confirm) {
      toast({ title: "Mismatch", description: "Passwords do not match.", variant: "destructive" });
      return;
    }

    const userRef = doc(firestore, 'users', profile.id);
    updateDocumentNonBlocking(userRef, { password: passwordData.new, updatedAt: new Date().toISOString() });

    toast({ title: "Security Updated", description: "Your login password has been changed." });
    setPasswordData({ new: '', confirm: '' });
  };

  const handleLogout = () => {
    localStorage.removeItem('bacchabite_logged_id');
    router.replace('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-secondary/20 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Fetching Profile...</p>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="pb-24 md:pb-0 md:pt-16 min-h-screen bg-secondary/20">
      <Navbar role="customer" />
      
      <main className="max-w-3xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-headline font-bold">My Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your identity and delivery coordinates.</p>
        </header>

        <div className="space-y-6">
          <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <Avatar className="w-24 h-24 border-4 border-secondary">
                  <AvatarFallback className="text-2xl font-bold bg-primary text-white">{profile.firstName[0]}{profile.lastName[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-center md:text-left">
                  <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                    <h2 className="text-2xl font-bold">{profile.firstName} {profile.lastName}</h2>
                    <Badge className="w-fit mx-auto md:mx-0 bg-primary/10 text-primary border-none uppercase">
                      {profile.role}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground font-medium">
                    <Fingerprint className="w-4 h-4" />
                    <span>Member ID: {profile.bacchabiteId}</span>
                  </div>
                </div>
                <Button 
                  onClick={() => setIsEditOpen(true)}
                  className="rounded-xl h-12 px-6 font-bold shadow-lg shadow-primary/10"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="rounded-3xl border-none shadow-sm bg-white">
              <CardHeader><CardTitle className="text-xs font-black uppercase text-muted-foreground tracking-widest">Contact Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3"><div className="p-2 bg-secondary rounded-lg"><Mail className="w-4 h-4 text-primary" /></div><div><p className="text-[10px] uppercase font-black text-muted-foreground leading-none mb-1">Email</p><p className="font-bold text-sm">{profile.email}</p></div></div>
                <div className="flex items-center gap-3"><div className="p-2 bg-secondary rounded-lg"><Phone className="w-4 h-4 text-primary" /></div><div><p className="text-[10px] uppercase font-black text-muted-foreground leading-none mb-1">Mobile</p><p className="font-bold text-sm">{profile.mobileNumber}</p></div></div>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border-none shadow-sm bg-white">
              <CardHeader><CardTitle className="text-xs font-black uppercase text-muted-foreground tracking-widest">Saved Address</CardTitle></CardHeader>
              <CardContent className="flex items-start gap-3"><div className="p-2 bg-secondary rounded-lg shrink-0"><MapPin className="w-4 h-4 text-primary" /></div><p className="font-medium text-sm leading-relaxed">{profile.address}</p></CardContent>
            </Card>
          </div>

          <Card className="rounded-[2.5rem] border-none shadow-md overflow-hidden bg-white">
            <CardHeader className="bg-accent/5 p-8 pb-4">
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-accent"><Lock className="w-5 h-5" />Update Credentials</CardTitle>
              <CardDescription className="font-medium">Change your login password below.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <form onSubmit={handlePasswordUpdate} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                      <Input id="new-password" type="password" placeholder="••••••••" value={passwordData.new} onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })} className="pl-11 h-12 rounded-2xl bg-secondary/20 border-none font-bold" />
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <div className="relative">
                      <Input id="confirm-password" type="password" placeholder="••••••••" value={passwordData.confirm} onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })} className="pl-11 h-12 rounded-2xl bg-secondary/20 border-none font-bold" />
                      <CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
                <Button type="submit" className="w-full h-14 rounded-2xl bg-accent hover:bg-accent/90 text-white font-bold text-lg shadow-lg shadow-accent/20 transition-all active:scale-95">Reset Account Password</Button>
              </form>
            </CardContent>
          </Card>

          <Button variant="ghost" onClick={handleLogout} className="w-full h-14 rounded-2xl text-destructive font-black uppercase tracking-widest hover:bg-destructive/10">
            Secure Sign Out
          </Button>
        </div>

        {/* Edit Profile Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="rounded-[2.5rem] max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-2xl font-headline flex items-center gap-2 text-accent">
                <UserIcon className="w-6 h-6 text-primary" />
                Edit Details
              </DialogTitle>
              <DialogDescription>Modify your profile information below.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input 
                    value={editForm.firstName} 
                    onChange={(e) => setEditForm({...editForm, firstName: e.target.value})}
                    className="rounded-xl h-11 border-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input 
                    value={editForm.lastName} 
                    onChange={(e) => setEditForm({...editForm, lastName: e.target.value})}
                    className="rounded-xl h-11 border-secondary"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input 
                  type="email"
                  value={editForm.email} 
                  onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                  className="rounded-xl h-11 border-secondary"
                />
              </div>
              <div className="space-y-2">
                <Label>Mobile Number</Label>
                <Input 
                  value={editForm.mobileNumber} 
                  onChange={(e) => setEditForm({...editForm, mobileNumber: e.target.value})}
                  className="rounded-xl h-11 border-secondary"
                />
              </div>
              <div className="space-y-2">
                <Label>Delivery Address</Label>
                <Textarea 
                  value={editForm.address} 
                  onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                  className="rounded-xl min-h-[100px] border-secondary"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)} className="rounded-xl h-12 px-6">Cancel</Button>
              <Button onClick={handleProfileUpdate} className="bg-primary hover:bg-primary/90 rounded-xl h-12 px-8 font-bold text-white shadow-lg shadow-primary/20">Save Updates</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

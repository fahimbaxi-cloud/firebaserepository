
"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Database, 
  Trash2, 
  ShieldAlert, 
  AlertTriangle, 
  UserCog, 
  RefreshCcw, 
  Loader2,
  Lock,
  Ghost,
  Palette,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  X,
  Smartphone
} from 'lucide-react';
import { useFirestore, deleteDocumentNonBlocking, useDoc, setDocumentNonBlocking, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit, doc } from 'firebase/firestore';
import { User, AppConfig } from '@/lib/types';
import { Label } from '@/components/ui/label';

export default function AdminSettings() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Branding State
  const configRef = useMemoFirebase(() => doc(firestore, 'settings', 'branding'), [firestore]);
  const { data: config, isLoading: configLoading } = useDoc<AppConfig>(configRef);

  const faviconRef = useRef<HTMLInputElement>(null);
  const iconRef = useRef<HTMLInputElement>(null);
  const webAppIconRef = useRef<HTMLInputElement>(null);

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
        const snap = await getDocs(q);

        if (!snap.empty) {
          const userData = snap.docs[0].data() as User;
          if (userData.role === 'super-admin' || userData.role === 'admin') {
            setIsAuthorized(true);
            setIsSuperAdmin(userData.role === 'super-admin');
          } else {
            router.replace('/admin');
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

  const TRANSACTION_COLLECTIONS = [
    'orders', 
    'purchases', 
    'payments', 
    'receipts', 
    'manufacturing_logs', 
    'general_transactions', 
    'journal_entries'
  ];

  const MASTER_COLLECTIONS = [
    'menu_items', 
    'packages', 
    'suppliers', 
    'raw_items', 
    'units', 
    'categories', 
    'expense_categories', 
    'income_categories'
  ];

  const clearCollection = async (collectionName: string, filterSuperAdmin: boolean = false) => {
    const colRef = collection(firestore, collectionName);
    const q = query(colRef);
    const snap = await getDocs(q);
    
    snap.docs.forEach(d => {
      if (filterSuperAdmin && d.data().role === 'super-admin') return;
      deleteDocumentNonBlocking(doc(firestore, collectionName, d.id));
    });
  };

  const handleClearTransactions = async () => {
    setIsProcessing(true);
    try {
      for (const col of TRANSACTION_COLLECTIONS) {
        await clearCollection(col);
      }
      toast({ title: "Operational Data Cleared", description: "All historical transactions have been removed." });
    } catch (e) {
      toast({ title: "Operation Error", description: "Failed to clear transaction records.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearMastersAndTransactions = async () => {
    setIsProcessing(true);
    try {
      for (const col of TRANSACTION_COLLECTIONS) await clearCollection(col);
      for (const col of MASTER_COLLECTIONS) await clearCollection(col);
      toast({ title: "Masters & History Reset", description: "Database reset to base user directory." });
    } catch (e) {
      toast({ title: "Reset Error", description: "Full system reset failed.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWipeAll = async () => {
    setIsProcessing(true);
    try {
      for (const col of TRANSACTION_COLLECTIONS) await clearCollection(col);
      for (const col of MASTER_COLLECTIONS) await clearCollection(col);
      await clearCollection('users', true);
      toast({ title: "Total Wipe Complete", description: "Database cleared except for Super Admins." });
    } catch (e) {
      toast({ title: "Wipe Interrupted", description: "Wipe process failed.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'favicon' | 'appIcon' | 'webAppIcon') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 750 * 1024) {
        toast({ title: "File too large", description: "Images must be under 750KB for database storage.", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const updateKey = type === 'favicon' ? 'faviconUrl' : type === 'appIcon' ? 'appIconUrl' : 'webAppIconUrl';
        const update: Partial<AppConfig> = {
          [updateKey]: result,
          updatedAt: new Date().toISOString()
        };
        setDocumentNonBlocking(configRef, update, { merge: true });
        toast({ title: `${type === 'favicon' ? 'Favicon' : type === 'appIcon' ? 'App Icon' : 'Mobile Icon'} Updated`, description: "Branding asset saved to cloud storage." });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeBranding = (type: 'favicon' | 'appIcon' | 'webAppIcon') => {
    const updateKey = type === 'favicon' ? 'faviconUrl' : type === 'appIcon' ? 'appIconUrl' : 'webAppIconUrl';
    const update: any = {
      [updateKey]: null,
      updatedAt: new Date().toISOString()
    };
    setDocumentNonBlocking(configRef, update, { merge: true });
    toast({ title: "Branding Removed", description: "Asset cleared from settings." });
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Validating Identity...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto w-full px-4">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-accent flex items-center gap-3">
            <Lock className="w-8 h-8" />
            Platform Management
          </h1>
          <p className="text-muted-foreground mt-1 font-medium text-lg">Powerful database tools for maintenance and system resets.</p>
        </div>
        <Badge className="bg-accent text-white px-6 py-2 rounded-full font-black uppercase text-xs tracking-widest shadow-lg shadow-accent/20">
          {isSuperAdmin ? 'Super Admin Console' : 'Administrator Portal'}
        </Badge>
      </header>

      <Tabs defaultValue="branding" className="w-full">
        <TabsList className="bg-white rounded-2xl p-1 shadow-sm border h-14 flex w-fit mb-8">
          <TabsTrigger value="branding" className="rounded-xl font-black px-8 h-full uppercase text-[10px] tracking-widest">
            <Palette className="w-4 h-4 mr-2" /> Branding
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="maintenance" className="rounded-xl font-black px-8 h-full uppercase text-[10px] tracking-widest">
              <ShieldAlert className="w-4 h-4 mr-2" /> System Maintenance
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="branding" className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* App Icon Card */}
            <Card className="rounded-[3rem] border-none shadow-sm overflow-hidden bg-white">
              <CardHeader className="p-8 pb-4">
                <div className="p-5 bg-primary/5 w-fit rounded-[2rem] mb-6">
                  <ImageIcon className="w-10 h-10 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold">Sidebar Icon</CardTitle>
                <CardDescription className="text-base font-medium mt-2">Visible in the sidebar and dashboard headers.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-4">
                <div className="space-y-6">
                  <div 
                    onClick={() => iconRef.current?.click()}
                    className="relative w-full aspect-video rounded-[2.5rem] border-4 border-dashed border-secondary hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer flex flex-col items-center justify-center overflow-hidden bg-secondary/10"
                  >
                    {config?.appIconUrl ? (
                      <>
                        <img src={config.appIconUrl} className="h-4/5 object-contain" alt="App Icon" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <span className="text-[10px] font-black text-white uppercase bg-white/20 px-4 py-1.5 rounded-full backdrop-blur-md">Replace Icon</span>
                        </div>
                        <Button 
                          variant="destructive" 
                          size="icon" 
                          onClick={(e) => { e.stopPropagation(); removeBranding('appIcon'); }}
                          className="absolute top-4 right-4 h-8 w-8 rounded-full shadow-lg"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <div className="text-center p-6">
                        <Upload className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm font-bold text-muted-foreground">Upload Square PNG/JPG</p>
                      </div>
                    )}
                  </div>
                  <input type="file" ref={iconRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'appIcon')} />
                </div>
              </CardContent>
            </Card>

            {/* Web App Icon Card */}
            <Card className="rounded-[3rem] border-none shadow-sm overflow-hidden bg-white">
              <CardHeader className="p-8 pb-4">
                <div className="p-5 bg-blue-50 w-fit rounded-[2rem] mb-6">
                  <Smartphone className="w-10 h-10 text-blue-600" />
                </div>
                <CardTitle className="text-2xl font-bold">Mobile Home Icon</CardTitle>
                <CardDescription className="text-base font-medium mt-2">The icon shown on a user's mobile home screen.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-4">
                <div className="space-y-6">
                  <div 
                    onClick={() => webAppIconRef.current?.click()}
                    className="relative w-full aspect-video rounded-[2.5rem] border-4 border-dashed border-secondary hover:border-blue-400/40 hover:bg-blue-50 transition-all cursor-pointer flex flex-col items-center justify-center overflow-hidden bg-secondary/10"
                  >
                    {config?.webAppIconUrl ? (
                      <>
                        <img src={config.webAppIconUrl} className="h-4/5 object-contain" alt="Web App Icon" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <span className="text-[10px] font-black text-white uppercase bg-white/20 px-4 py-1.5 rounded-full backdrop-blur-md">Replace Icon</span>
                        </div>
                        <Button 
                          variant="destructive" 
                          size="icon" 
                          onClick={(e) => { e.stopPropagation(); removeBranding('webAppIcon'); }}
                          className="absolute top-4 right-4 h-8 w-8 rounded-full shadow-lg"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <div className="text-center p-6">
                        <Upload className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm font-bold text-muted-foreground">Upload Home Screen Icon</p>
                      </div>
                    )}
                  </div>
                  <input type="file" ref={webAppIconRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'webAppIcon')} />
                </div>
              </CardContent>
            </Card>

            {/* Favicon Card */}
            <Card className="rounded-[3rem] border-none shadow-sm overflow-hidden bg-white">
              <CardHeader className="p-8 pb-4">
                <div className="p-5 bg-accent/5 w-fit rounded-[2rem] mb-6">
                  <Ghost className="w-10 h-10 text-accent" />
                </div>
                <CardTitle className="text-2xl font-bold">Browser Favicon</CardTitle>
                <CardDescription className="text-base font-medium mt-2">The small icon shown in browser tabs.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-4">
                <div className="space-y-6">
                  <div 
                    onClick={() => faviconRef.current?.click()}
                    className="relative w-full aspect-video rounded-[2.5rem] border-4 border-dashed border-secondary hover:border-accent/40 hover:bg-accent/5 transition-all cursor-pointer flex flex-col items-center justify-center overflow-hidden bg-secondary/10"
                  >
                    {config?.faviconUrl ? (
                      <>
                        <div className="p-8 bg-white rounded-3xl shadow-xl border border-secondary">
                          <img src={config.faviconUrl} className="w-16 h-16 object-contain" alt="Favicon" />
                        </div>
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <span className="text-[10px] font-black text-white uppercase bg-white/20 px-4 py-1.5 rounded-full backdrop-blur-md">Replace Favicon</span>
                        </div>
                        <Button 
                          variant="destructive" 
                          size="icon" 
                          onClick={(e) => { e.stopPropagation(); removeBranding('favicon'); }}
                          className="absolute top-4 right-4 h-8 w-8 rounded-full shadow-lg"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <div className="text-center p-6">
                        <Upload className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm font-bold text-muted-foreground">Upload Tab Icon</p>
                      </div>
                    )}
                  </div>
                  <input type="file" ref={faviconRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'favicon')} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="p-10 border-4 border-dashed border-secondary rounded-[3rem] bg-white/50 text-center">
            <div className="max-w-2xl mx-auto space-y-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Identity Logic Engaged
              </p>
              <p className="text-sm font-medium text-muted-foreground leading-relaxed italic">
                "Icon updates are pushed to the document head dynamically. The Mobile Home Icon specifically targets the 'apple-touch-icon' tag for high-quality iOS and Android launcher rendering."
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="rounded-[3rem] border-none shadow-sm overflow-hidden bg-white flex flex-col min-h-[500px]">
              <CardHeader className="p-8 pb-4">
                <div className="p-5 bg-blue-50 w-fit rounded-[2rem] mb-6">
                  <RefreshCcw className="w-10 h-10 text-blue-600" />
                </div>
                <CardTitle className="text-2xl font-bold">Flush Transactions</CardTitle>
                <CardDescription className="text-base font-medium mt-2">Delete history while keeping master definitions safe.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-4 flex-1 flex flex-col justify-between">
                <div className="space-y-6">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Clears all Orders, Purchases, and Receipts. Useful for starting a new month or clearing test data.
                  </p>
                  <div className="bg-blue-50/50 p-5 rounded-[2rem] border border-blue-100">
                    <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-3">Target Collections</p>
                    <div className="flex flex-wrap gap-2">
                      {TRANSACTION_COLLECTIONS.map(c => <Badge key={c} variant="outline" className="text-[9px] bg-white border-blue-200 px-2.5 py-1">{c}</Badge>)}
                    </div>
                  </div>
                </div>
                <div className="mt-8">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={isProcessing} className="w-full h-20 rounded-[1.5rem] bg-blue-600 hover:bg-blue-700 font-black shadow-xl shadow-blue-200 transition-all active:scale-95 flex flex-col gap-1 items-center justify-center text-white px-4 text-center">
                        <div className="flex items-center gap-2">
                          {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                          <span className="text-lg uppercase">Flush Records</span>
                        </div>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-[2.5rem]">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-headline">Confirm Transaction Flush?</AlertDialogTitle>
                        <AlertDialogDescription className="text-base">
                          This will permanently wipe all operational records. Masters like Menu and Suppliers will remain.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel className="rounded-2xl h-12 px-6 font-bold">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearTransactions} className="bg-blue-600 hover:bg-blue-700 rounded-2xl h-12 px-8 font-black">Wipe Records</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[3rem] border-none shadow-sm overflow-hidden bg-white flex flex-col min-h-[500px]">
              <CardHeader className="p-8 pb-4">
                <div className="p-5 bg-orange-50 w-fit rounded-[2rem] mb-6">
                  <Database className="w-10 h-10 text-orange-600" />
                </div>
                <CardTitle className="text-2xl font-bold">Reset System State</CardTitle>
                <CardDescription className="text-base font-medium mt-2">Clears everything except the existing user directory.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-4 flex-1 flex flex-col justify-between">
                <div className="space-y-6">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Removes all menu items, suppliers, packages, and transaction history. User profiles are preserved.
                  </p>
                  <div className="bg-orange-50/50 p-5 rounded-[2rem] border border-orange-100">
                    <p className="text-[10px] font-black uppercase text-orange-600 tracking-widest mb-3">Preservation Policy</p>
                    <Badge variant="outline" className="text-[9px] bg-white border-orange-200 px-2.5 py-1">Users Collection: PROTECTED</Badge>
                  </div>
                </div>
                <div className="mt-8">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={isProcessing} className="w-full h-20 rounded-[1.5rem] bg-orange-600 hover:bg-orange-700 font-black shadow-xl shadow-orange-200 transition-all active:scale-95 flex flex-col gap-1 items-center justify-center text-white px-4 text-center">
                        <div className="flex items-center gap-2">
                          {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
                          <span className="text-lg uppercase">System Hard Reset</span>
                        </div>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-[2.5rem]">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-headline flex items-center gap-2">
                          <AlertTriangle className="text-orange-600 w-8 h-8" />
                          Wipe Content?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-base">
                          Everything except users will be deleted. This is irreversible.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel className="rounded-2xl h-12 px-6 font-bold">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearMastersAndTransactions} className="bg-orange-600 hover:bg-orange-700 rounded-2xl h-12 px-8 font-black">Proceed Reset</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-accent text-white flex flex-col min-h-[500px]">
              <CardHeader className="p-8 pb-4">
                <div className="p-5 bg-white/20 w-fit rounded-[2rem] mb-6">
                  <ShieldAlert className="w-10 h-10 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold">Destructive Wipe</CardTitle>
                <CardDescription className="text-base font-medium text-white/70 mt-2">Absolute factory reset of the entire database.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-4 flex-1 flex flex-col justify-between">
                <div className="space-y-6">
                  <p className="text-sm text-white/80 leading-relaxed">
                    Wipes all records and all user accounts (Customers/Riders). Only <strong>Super Admins</strong> remain.
                  </p>
                  <div className="bg-white/10 p-5 rounded-[2rem] border border-white/10">
                    <p className="text-[10px] font-black uppercase text-white/60 tracking-widest mb-3">Super-Admin Exclusion</p>
                    <div className="flex items-center gap-3">
                      <Ghost className="w-6 h-6" />
                      <span className="text-xs font-bold">Persistent Access Enabled</span>
                    </div>
                  </div>
                </div>
                <div className="mt-8">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={isProcessing} className="w-full h-20 rounded-[1.5rem] bg-white text-accent hover:bg-white/90 font-black shadow-2xl shadow-black/20 transition-all active:scale-95 flex flex-col gap-1 items-center justify-center px-4 text-center">
                        <div className="flex items-center gap-2">
                          {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldAlert className="w-5 h-5" />}
                          <span className="text-lg uppercase">Total System Wipe</span>
                        </div>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-[2.5rem] bg-accent text-white border-none shadow-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-3xl font-headline flex items-gap-3">
                          <ShieldAlert className="w-10 h-10" />
                          CRITICAL ACTION
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-white/80 text-lg font-medium pt-4 leading-relaxed">
                          This will delete all customer data, riders, and history. Only Super Admins will be able to log in. Proceed with absolute caution.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="mt-8">
                        <AlertDialogCancel className="bg-white/10 text-white border-white/20 hover:bg-white/20 rounded-2xl h-12 px-6 font-bold">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleWipeAll} className="bg-white text-accent hover:bg-white/90 rounded-2xl h-12 px-8 font-black">WIPE ALL DATA</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}


"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Order, User } from '@/lib/types';
import { 
  MapPinned, 
  ArrowUp, 
  ArrowDown, 
  Save, 
  RotateCcw, 
  GripVertical, 
  Loader2,
  MapPin,
  CheckCircle2,
  Printer,
  FileDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { downloadPDF } from '@/lib/pdf-export';

export default function AddressSortPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [addressOrder, setAddressOrder] = useState<string[]>([]);
  const { toast } = useToast();

  const ordersQuery = useMemoFirebase(() => collection(firestore, 'orders'), [firestore]);
  const { data: allOrders = [] } = useCollection<Order>(ordersQuery);

  useEffect(() => {
    const verifyRider = async () => {
      setMounted(true);
      const loggedId = localStorage.getItem('bacchabite_logged_id');
      if (!loggedId) {
        router.replace('/');
        return;
      }

      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('bacchabiteId', '==', loggedId), limit(1));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const doc = snap.docs[0];
        const userData = { ...doc.data(), id: doc.id } as User;
        if (userData.role === 'delivery') {
          setCurrentUser(userData);
          setIsAuthorized(true);

          const savedOrder = localStorage.getItem(`bb_address_priority_${userData.id}`);
          if (savedOrder) {
            setAddressOrder(JSON.parse(savedOrder));
          }
        } else {
          router.replace('/');
        }
      } else {
        router.replace('/');
      }
    };

    verifyRider();
  }, [router, firestore]);

  useEffect(() => {
    if (currentUser && currentUser.id && allOrders && addressOrder.length === 0) {
      const myAddresses = Array.from(new Set(
        allOrders
          .filter(o => o.assignedTo === currentUser.id)
          .map(o => o.address)
      ));
      if (myAddresses.length > 0) {
        setAddressOrder(myAddresses);
      }
    }
  }, [currentUser, allOrders, addressOrder.length]);

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...addressOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    
    setAddressOrder(newOrder);
  };

  const handleSave = () => {
    if (!currentUser || !currentUser.id) return;
    localStorage.setItem(`bb_address_priority_${currentUser.id}`, JSON.stringify(addressOrder));
    toast({
      title: "Route Optimized",
      description: "Your custom address sorting order has been saved successfully.",
    });
  };

  const handleReset = () => {
    if (!currentUser || !currentUser.id || !allOrders) return;
    const myAddresses = Array.from(new Set(
      allOrders
        .filter(o => o.assignedTo === currentUser.id)
        .map(o => o.address)
    ));
    setAddressOrder(myAddresses);
    toast({
      title: "Sort Reset",
      description: "Address list has been reset to default order.",
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    const head = [['Sequence', 'Address']];
    const body = addressOrder.map((addr, idx) => [idx + 1, addr]);
    downloadPDF('Assigned Route Sequence', head, body, 'delivery_route');
  };

  if (!isAuthorized || !currentUser) {
    return (
      <div className="min-h-screen bg-blue-50/30 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Verifying Session...</p>
      </div>
    );
  }

  return (
    <div className="pb-24 md:pb-0 md:pt-16 min-h-screen bg-blue-50/30">
      <Navbar role="delivery" />
      
      <main className="max-w-3xl mx-auto px-4 py-8">
        <header className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:mb-4">
          <div>
            <h1 className="text-3xl font-headline font-bold text-blue-600">Route Sequence</h1>
            <p className="text-muted-foreground">Define your preferred delivery order by address.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={handleReset} className="rounded-xl font-bold bg-white border-blue-100 text-blue-600">
              <RotateCcw className="w-4 h-4 mr-2" /> Reset
            </Button>
            <Button size="sm" onClick={handleSave} className="rounded-xl font-bold bg-blue-600 hover:bg-blue-700 shadow-md">
              <Save className="w-4 h-4 mr-2" /> Save Order
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl font-bold bg-white border-blue-100 text-blue-600">
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl font-bold bg-white border-blue-100 text-blue-600">
              <FileDown className="w-4 h-4 mr-2" /> Export PDF
            </Button>
          </div>
        </header>

        <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white print:shadow-none print:rounded-none">
          <CardHeader className="bg-blue-600 text-white p-8 print:p-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <MapPinned className="w-6 h-6" />
              Delivery Priority List
            </CardTitle>
            <CardDescription className="text-blue-100 font-medium mt-1">
              Arrange these addresses in the order you want to visit them.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {addressOrder.length > 0 ? (
                addressOrder.map((address, index) => (
                  <div 
                    key={address} 
                    className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-blue-100 hover:bg-white transition-all group"
                  >
                    <div className="flex flex-col gap-1 print:hidden">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                        onClick={() => handleMove(index, 'up')}
                        disabled={index === 0}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                        onClick={() => handleMove(index, 'down')}
                        disabled={index === addressOrder.length - 1}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="bg-blue-600 text-white font-black text-sm w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm">
                      {index + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        <p className="font-bold text-slate-800 truncate">{address}</p>
                      </div>
                    </div>

                    <div className="hidden group-hover:block print:hidden animate-in fade-in slide-in-from-right-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 opacity-40">
                  <MapPin className="w-12 h-12 mx-auto mb-2" />
                  <p className="font-bold">No addresses found in your tasks.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

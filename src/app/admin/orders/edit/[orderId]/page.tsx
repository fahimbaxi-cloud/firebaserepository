
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { User, TimeSlot, BroadcastPackage, MenuItem, Order, OrderStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, isValid, parseISO, parse } from 'date-fns';
import { Search, Package, User as UserIcon, MapPin, Clock, ArrowLeft, CheckCircle2, Calendar as CalendarIcon, Info, Minus, Plus, ShoppingCart, Loader2, Sparkles, Trash2, AlertTriangle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useDoc, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const parseDateSafe = (d: any): Date => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  if (typeof d === 'string') {
    const parsed = parseISO(d);
    return isValid(parsed) ? parsed : new Date();
  }
  if (d && typeof d === 'object' && 'seconds' in d) {
    return new Date(d.seconds * 1000);
  }
  return new Date();
};

export default function EditOrderPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.orderId as string;
  const firestore = useFirestore();
  const { toast } = useToast();

  const orderRef = useMemoFirebase(() => doc(firestore, 'orders', orderId), [firestore, orderId]);
  const { data: order, isLoading: orderLoading } = useDoc<Order>(orderRef);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: usersData, isLoading: usersLoading } = useCollection<User>(usersQuery);
  const allUsers = usersData || [];

  const packagesQuery = useMemoFirebase(() => collection(firestore, 'packages'), [firestore]);
  const { data: packagesData, isLoading: packagesLoading } = useCollection<BroadcastPackage>(packagesQuery);
  const broadcastPackages = packagesData || [];

  const menuQuery = useMemoFirebase(() => collection(firestore, 'menu_items'), [firestore]);
  const { data: menuData } = useCollection<MenuItem>(menuQuery);
  const menuItems = menuData || [];

  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedPackages, setSelectedPackages] = useState<Record<string, number>>({});
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('Morning');
  const [timeValue, setTimeValue] = useState('08:30');
  const [timePeriod, setTimePeriod] = useState('AM');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('Pending');
  const [isInitialized, setIsInitialized] = useState(false);

  // Scheme Date States
  const [activeTab, setActiveTab] = useState('daily');
  const [refMonth, setRefMonth] = useState<string>(format(new Date(), "MMMM"));
  const [refYear, setRefYear] = useState<string>(format(new Date(), "yyyy"));

  useEffect(() => {
    if (order && allUsers.length > 0 && broadcastPackages.length > 0 && !isInitialized) {
      const user = allUsers.find(u => u.id === order.customerId);
      setSelectedUser(user || null);
      
      const date = order.referenceDate ? parseISO(order.referenceDate) : parseDateSafe(order.createdAt);
      setSelectedDate(isValid(date) ? date : new Date());

      const pkg = broadcastPackages.find(p => p.name === order.packageName);
      if (pkg) {
        setSelectedPackages({ [pkg.id]: order.packageQuantity });
      }

      setDeliveryAddress(order.address);
      setTimeSlot(order.slot);
      
      const timeParts = (order.deliveryTime || '08:30 AM').split(' ');
      setTimeValue(timeParts[0] || '08:30');
      setTimePeriod(timeParts[1] || 'AM');
      setOrderStatus(order.status);
      
      if (order.type === 'Subscription') {
        setActiveTab('scheme');
        const d = isValid(date) ? date : new Date();
        setRefMonth(format(d, "MMMM"));
        setRefYear(format(d, "yyyy"));
      } else {
        setActiveTab('daily');
        const d = isValid(date) ? date : new Date();
        setSelectedDate(d);
      }

      setIsInitialized(true);
    }
  }, [order, allUsers, broadcastPackages, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    setTimePeriod(timeSlot === 'Morning' ? 'AM' : 'PM');
    if (timeSlot === 'Morning' && timeValue === '12:30') setTimeValue('08:30');
    if (timeSlot === 'Noon' && timeValue === '08:30') setTimeValue('12:30');
  }, [timeSlot, timeValue, isInitialized]);

  const filteredCustomers = useMemo(() => {
    return allUsers.filter(u => 
      u.role === 'customer' && 
      (`${u.firstName} ${u.lastName} ${u.bacchabiteId}`).toLowerCase().includes(customerSearch.toLowerCase())
    );
  }, [allUsers, customerSearch]);

  const getPackageDate = (pkg: BroadcastPackage): Date => {
    if (!pkg.dateContext) return new Date(pkg.createdAt ? String(pkg.createdAt) : 0);
    try {
      if (pkg.type === 'daily') {
        const parsed = parse(pkg.dateContext, 'MMMM d, yyyy', new Date());
        if (isValid(parsed)) return parsed;
      } else {
        const parsed = parse(pkg.dateContext, 'MMMM yyyy', new Date());
        if (isValid(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return new Date(pkg.createdAt ? String(pkg.createdAt) : 0);
  };

  const sortedDailyPackages = useMemo(() => {
    if (!broadcastPackages) return [];
    const list = [...broadcastPackages].filter(pkg => pkg.type === 'daily');
    
    // Ensure the package currently in the order is always visible
    if (order && order.type === 'Daily') {
      const orderPkg = broadcastPackages.find(p => p.name === order.packageName && p.type === 'daily');
      if (orderPkg && !list.some(p => p.id === orderPkg.id)) {
        list.push(orderPkg);
      }
    }
    
    return list.sort((a, b) => getPackageDate(b).getTime() - getPackageDate(a).getTime());
  }, [broadcastPackages, order]);

  const sortedSchemePackages = useMemo(() => {
    if (!broadcastPackages) return [];
    const list = [...broadcastPackages].filter(pkg => pkg.type === 'monthly');
    
    // Ensure the package currently in the order is always visible
    if (order && order.type === 'Subscription') {
      const orderPkg = broadcastPackages.find(p => p.name === order.packageName && p.type === 'monthly');
      if (orderPkg && !list.some(p => p.id === orderPkg.id)) {
        list.push(orderPkg);
      }
    }
    
    return list.sort((a, b) => getPackageDate(b).getTime() - getPackageDate(a).getTime());
  }, [broadcastPackages, order]);

  const targetDailyDateStr = useMemo(() => {
    if (!selectedDate) return '';
    return format(addDays(selectedDate, 1), "MMMM d, yyyy");
  }, [selectedDate]);

  const targetMonthStr = useMemo(() => {
    return `${refMonth} ${refYear}`;
  }, [refMonth, refYear]);

  const cartPackages = useMemo(() => {
    return Object.entries(selectedPackages)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => {
        const pkg = broadcastPackages.find(p => p.id === id);
        return { pkg, qty };
      })
      .filter(entry => entry.pkg !== undefined);
  }, [selectedPackages, broadcastPackages]);

  const totalAmount = useMemo(() => {
    return cartPackages.reduce((sum, entry) => sum + (entry.pkg!.price * entry.qty), 0);
  }, [cartPackages]);

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setDeliveryAddress(user.address || '');
  };

  const updatePackageQuantity = (pkgId: string, delta: number) => {
    setSelectedPackages(prev => {
      const current = prev[pkgId] || 0;
      const next = Math.max(0, current + delta);
      const newState: Record<string, number> = {};
      if (next > 0) newState[pkgId] = next;
      return newState;
    });
  };

  const handleUpdate = () => {
    if (!selectedUser || !order) return;
    if (cartPackages.length === 0) {
      toast({ title: "No Items", description: "An order must contain at least one package.", variant: "destructive" });
      return;
    }

    const { pkg, qty } = cartPackages[0];
    const orderItems = (pkg!.items || []).map(itemId => {
      const m = menuItems.find(mi => mi.id === itemId);
      return {
        menuItemId: itemId,
        name: m?.name || "Unknown",
        quantity: qty,
        price: m?.price || 0,
        type: m?.type || 'Veg'
      };
    });

    // Calculate referenceDate and targetDeliveryDate depending on daily vs subscription (scheme)
    const calculatedRefDate = pkg!.type === 'daily'
      ? (selectedDate || new Date()).toISOString()
      : (() => {
          const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          const mIdx = months.indexOf(refMonth);
          const d = new Date(parseInt(refYear), mIdx >= 0 ? mIdx : 0, 1, 12, 0, 0);
          return d.toISOString();
        })();

    const calculatedTargetDeliveryDate = pkg!.type === 'daily'
      ? targetDailyDateStr
      : `${refMonth} ${refYear}`;

    const updateData: any = {
      customerId: selectedUser.id,
      customerName: `${selectedUser.firstName} ${selectedUser.lastName}`,
      packageName: pkg!.name,
      packageQuantity: qty,
      address: deliveryAddress,
      mobile: selectedUser.mobileNumber,
      items: orderItems,
      total: pkg!.price * qty,
      type: pkg!.type === 'daily' ? 'Daily' : 'Subscription',
      slot: timeSlot,
      deliveryTime: `${timeValue} ${timePeriod}`,
      status: orderStatus,
      referenceDate: calculatedRefDate,
      targetDeliveryDate: calculatedTargetDeliveryDate,
      updatedAt: new Date().toISOString()
    };

    updateDocumentNonBlocking(orderRef, updateData);
    toast({ title: "Order Modified", description: "The changes have been saved to the database." });
    router.push('/admin');
  };

  const handleDelete = () => {
    deleteDocumentNonBlocking(orderRef);
    toast({ title: "Order Removed", description: "Record has been deleted from Firestore." });
    router.push('/admin');
  };

  if (orderLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-secondary/10">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Syncing Order Data...</p>
      </div>
    );
  }

  return (
"use client";

import { useRouter, useParams } from 'next/navigation';
import { useEffect } from 'react';

export default function EditOrderPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.orderId as string;
  
  useEffect(() => {
    if (orderId) {
      router.push(`/admin/orders/new?edit=${orderId}`);
    }
  }, [router, orderId]);
  
  return null;
}
  );
}

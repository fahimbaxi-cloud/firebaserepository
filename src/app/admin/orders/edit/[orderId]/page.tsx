
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-headline font-bold text-accent">Edit Order #{orderId.substring(0,8)}</h1>
          <p className="text-muted-foreground mt-1 font-medium">Update customer, package, or delivery details.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <Card className="rounded-[2rem] border-none shadow-sm overflow-hidden bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-primary" />
                1. Customer Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by name or ID..." 
                  value={customerSearch} 
                  onChange={(e) => setCustomerSearch(e.target.value)} 
                  className="pl-11 h-12 rounded-2xl bg-secondary/20 border-none font-bold" 
                />
              </div>
              <ScrollArea className="h-40 border-2 border-secondary/30 rounded-2xl bg-secondary/5">
                <div className="p-2 space-y-1">
                  {filteredCustomers.map((user) => (
                    <div 
                      key={user.id} 
                      onClick={() => handleUserSelect(user)} 
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all",
                        selectedUser?.id === user.id ? "bg-primary text-white shadow-lg" : "hover:bg-primary/5"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs", selectedUser?.id === user.id ? "bg-white/20" : "bg-secondary text-primary")}>
                          {user.firstName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{user.firstName} {user.lastName}</p>
                          <p className={cn("text-[10px]", selectedUser?.id === user.id ? "text-white/70" : "text-muted-foreground")}>ID: {user.bacchabiteId}</p>
                        </div>
                      </div>
                      {selectedUser?.id === user.id && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {selectedUser && (
                <div className="p-4 bg-green-50 border-2 border-green-100 rounded-2xl flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <p className="text-sm font-black text-green-800">{selectedUser.firstName} {selectedUser.lastName} Selected</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-none shadow-sm overflow-hidden bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                2. Offering & Date
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="w-full">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                    <TabsList className="grid grid-cols-2 w-full sm:w-[320px] bg-secondary/20 p-1 rounded-2xl h-12">
                      <TabsTrigger value="daily" className="rounded-xl font-bold h-10 data-[state=active]:bg-primary data-[state=active]:text-white">Daily Package</TabsTrigger>
                      <TabsTrigger value="scheme" className="rounded-xl font-bold h-10 data-[state=active]:bg-primary data-[state=active]:text-white">Scheme</TabsTrigger>
                    </TabsList>
                    <Badge variant="outline" className="border-secondary text-[9px] font-black px-2 py-1 max-w-max">LIVE PACKAGES</Badge>
                  </div>

                  {packagesLoading ? (
                    <div className="p-12 text-center">
                      <Loader2 className="animate-spin mx-auto w-8 h-8 text-primary" />
                      <p className="mt-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">Querying Packages...</p>
                    </div>
                  ) : (
                    <>
                      <TabsContent value="daily" className="space-y-4 outline-none animate-in fade-in duration-300">
                        {/* Reference Date and Target Delivery Date specifically for Daily Packages */}
                        <div className="flex flex-col md:flex-row gap-4 mb-6 bg-secondary/10 p-5 rounded-[1.5rem] border border-secondary/20">
                          <div className="space-y-2 flex-1">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Reference Date (When Given)</Label>
                            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                              <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-full h-12 justify-start text-left font-bold rounded-xl bg-white border-none px-4 shadow-sm", !selectedDate && "text-muted-foreground")}>
                                  <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                  {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 rounded-3xl border-none shadow-2xl" align="start">
                                <Calendar mode="single" selected={selectedDate} onSelect={(date) => {
                                  setSelectedDate(date);
                                  setIsDatePickerOpen(false);
                                }} initialFocus className="rounded-3xl" />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="space-y-2 flex-1">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Target Delivery Date</Label>
                            <div className="h-12 bg-green-50/50 border border-green-200 rounded-xl flex items-center px-4 gap-2 text-green-700 font-bold shadow-sm">
                              <Sparkles className="w-4 h-4 text-green-500" />
                              <span>{targetDailyDateStr}</span>
                            </div>
                          </div>
                        </div>
                        {sortedDailyPackages.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {sortedDailyPackages.map((pkg) => {
                              const isTargetMatch = pkg.dateContext === targetDailyDateStr;
                              return (
                                <div 
                                  key={pkg.id} 
                                  className={cn(
                                    "p-5 border-2 rounded-[2rem] transition-all flex flex-col justify-between h-full group relative overflow-hidden",
                                    selectedPackages[pkg.id] > 0 
                                      ? "border-primary bg-primary/5 shadow-md" 
                                      : isTargetMatch 
                                        ? "border-green-300 bg-green-50/40 hover:border-green-400" 
                                        : "border-secondary/30 bg-white hover:border-primary/20"
                                  )}
                                >
                                  {isTargetMatch && (
                                    <div className="absolute top-0 right-0 bg-green-500 text-white font-black text-[8px] px-3 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1 shadow-sm">
                                      <Check className="w-2.5 h-2.5" /> Target Date Match
                                    </div>
                                  )}
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-start">
                                      <span className="text-[10px] font-bold text-muted-foreground bg-secondary/40 px-2 py-0.5 rounded">
                                        {pkg.dateContext}
                                      </span>
                                      <span className="font-black text-primary text-xl">Rs {pkg.price}</span>
                                    </div>
                                    <p className="font-black text-sm text-accent leading-tight line-clamp-2 pr-10">{pkg.name}</p>
                                    <p className="text-[10px] text-muted-foreground italic font-medium">"{pkg.message}"</p>
                                  </div>
                                  <div className="mt-4 flex items-center justify-between bg-secondary/20 p-2 rounded-2xl">
                                    <span className="text-xs font-bold px-2">Quantity</span>
                                    <div className="flex items-center gap-3">
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-9 w-9 rounded-xl bg-white shadow-sm hover:text-destructive animate-none" 
                                        onClick={() => updatePackageQuantity(pkg.id, -1)}
                                      >
                                        <Minus className="w-4 h-4" />
                                      </Button>
                                      <span className="font-black text-lg w-4 text-center">{selectedPackages[pkg.id] || 0}</span>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-9 w-9 rounded-xl bg-primary text-white hover:bg-primary/90 hover:text-white shadow-md animate-none" 
                                        onClick={() => updatePackageQuantity(pkg.id, 1)}
                                      >
                                        <Plus className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-10 border-2 border-dashed border-secondary/50 rounded-[2rem] flex flex-col items-center justify-center text-center space-y-3 bg-secondary/5 opacity-60">
                            <div className="p-4 bg-white rounded-full">
                              <Info className="w-8 h-8 text-muted-foreground/30" />
                            </div>
                            <p className="text-sm font-bold text-muted-foreground max-w-[250px]">No daily packages found in Firestore.</p>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="scheme" className="space-y-4 outline-none animate-in fade-in duration-300">
                        {/* Month and Year Selection for Schemes */}
                        <div className="bg-secondary/10 p-5 rounded-[1.5rem] border border-secondary/20">
                          <div className="space-y-2 max-w-md">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Reference Month & Year</Label>
                            <div className="flex gap-2">
                              <Select value={refMonth} onValueChange={setRefMonth}>
                                <SelectTrigger className="rounded-xl border-secondary font-bold h-11 bg-white shadow-sm">
                                  <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m) => (
                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select value={refYear} onValueChange={setRefYear}>
                                <SelectTrigger className="rounded-xl border-secondary font-bold h-11 bg-white shadow-sm w-28">
                                  <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  {["2025", "2026", "2027", "2028", "2029", "2030"].map((y) => (
                                    <SelectItem key={y} value={y}>{y}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                        {sortedSchemePackages.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {sortedSchemePackages.map((pkg) => {
                              const isTargetMatch = pkg.dateContext === targetMonthStr;
                              return (
                                <div 
                                  key={pkg.id} 
                                  className={cn(
                                    "p-5 border-2 rounded-[2rem] transition-all flex flex-col justify-between h-full group relative overflow-hidden",
                                    selectedPackages[pkg.id] > 0 
                                      ? "border-primary bg-primary/5 shadow-md" 
                                      : isTargetMatch 
                                        ? "border-green-300 bg-green-50/40 hover:border-green-400" 
                                        : "border-secondary/30 bg-white hover:border-primary/20"
                                  )}
                                >
                                  {isTargetMatch && (
                                    <div className="absolute top-0 right-0 bg-green-500 text-white font-black text-[8px] px-3 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1 shadow-sm">
                                      <Check className="w-2.5 h-2.5" /> Month Match
                                    </div>
                                  )}
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-start">
                                      <span className="text-[10px] font-bold text-muted-foreground bg-secondary/40 px-2 py-0.5 rounded">
                                        {pkg.dateContext}
                                      </span>
                                      <span className="font-black text-primary text-xl">Rs {pkg.price}</span>
                                    </div>
                                    <p className="font-black text-sm text-accent leading-tight line-clamp-2 pr-10">{pkg.name}</p>
                                    <p className="text-[10px] text-muted-foreground italic font-medium">"{pkg.message}"</p>
                                  </div>
                                  <div className="mt-4 flex items-center justify-between bg-secondary/20 p-2 rounded-2xl">
                                    <span className="text-xs font-bold px-2">Quantity</span>
                                    <div className="flex items-center gap-3">
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-9 w-9 rounded-xl bg-white shadow-sm hover:text-destructive animate-none" 
                                        onClick={() => updatePackageQuantity(pkg.id, -1)}
                                      >
                                        <Minus className="w-4 h-4" />
                                      </Button>
                                      <span className="font-black text-lg w-4 text-center">{selectedPackages[pkg.id] || 0}</span>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-9 w-9 rounded-xl bg-primary text-white hover:bg-primary/90 hover:text-white shadow-md animate-none" 
                                        onClick={() => updatePackageQuantity(pkg.id, 1)}
                                      >
                                        <Plus className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-10 border-2 border-dashed border-secondary/50 rounded-[2rem] flex flex-col items-center justify-center text-center space-y-3 bg-secondary/5 opacity-60">
                            <div className="p-4 bg-white rounded-full">
                              <Info className="w-8 h-8 text-muted-foreground/30" />
                            </div>
                            <p className="text-sm font-bold text-muted-foreground max-w-[250px]">No schemes found in Firestore.</p>
                          </div>
                        )}
                      </TabsContent>
                    </>
                  )}
                </Tabs>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white sticky top-24">
            <CardHeader className="bg-accent text-white p-7">
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-6 h-6" />
                Update Order
              </CardTitle>
            </CardHeader>
            <CardContent className="p-7 space-y-6">
              <div className="space-y-4">
                <div className="bg-secondary/10 p-4 rounded-xl space-y-2">
                  {cartPackages.map(({ pkg, qty }) => (
                    <div key={pkg!.id} className="flex justify-between font-bold text-sm">
                      <span>{qty}x {pkg!.name}</span>
                      <span className="text-primary">{pkg!.price * qty}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t flex justify-between font-black text-lg">
                    <span>Total</span>
                    <span>Rs {totalAmount}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Slot</Label>
                    <Select value={timeSlot} onValueChange={(v) => setTimeSlot(v as TimeSlot)}>
                      <SelectTrigger className="rounded-xl h-11 bg-secondary/10 border-none font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl"><SelectItem value="Morning">Morning</SelectItem><SelectItem value="Noon">Noon</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Status</Label>
                    <Select value={orderStatus} onValueChange={(v) => setOrderStatus(v as OrderStatus)}>
                      <SelectTrigger className="rounded-xl h-11 bg-secondary/10 border-none font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Assigned">Assigned</SelectItem>
                        <SelectItem value="Picked Up">Picked Up</SelectItem>
                        <SelectItem value="Out for Delivery">Out for Delivery</SelectItem>
                        <SelectItem value="Delivered">Delivered</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Preferred Time</Label>
                  <div className="flex gap-2">
                    <Input value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className="rounded-xl h-11 bg-secondary/10 border-none font-bold flex-1" />
                    <Select value={timePeriod} onValueChange={setTimePeriod}>
                      <SelectTrigger className="w-20 h-11 rounded-xl bg-secondary/10 border-none font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl"><SelectItem value="AM">AM</SelectItem><SelectItem value="PM">PM</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Address</Label>
                  <Textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className="rounded-2xl bg-secondary/10 border-none min-h-[100px] font-medium" />
                </div>
              </div>
              
              <div className="flex flex-col gap-3 pt-4 border-t">
                <Button onClick={handleUpdate} className="w-full bg-primary hover:bg-primary/90 text-white rounded-[1.5rem] h-16 font-black text-xl shadow-lg">
                  Update Order
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="w-full text-muted-foreground hover:text-destructive h-12 rounded-2xl font-bold">
                      <Trash2 className="w-5 h-5 mr-2" />
                      Delete Permanently
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-[2.5rem]">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-2xl font-headline flex items-center gap-2">
                        <AlertTriangle className="text-destructive" />
                        Confirm Deletion
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove Order #{orderId.substring(0,8)} from the system. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl h-11">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 rounded-xl h-11">
                        Delete Order
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

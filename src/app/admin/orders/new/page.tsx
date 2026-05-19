
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { User, TimeSlot, BroadcastPackage, MenuItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, isValid } from 'date-fns';
import { Search, Package, User as UserIcon, MapPin, Clock, ArrowLeft, CheckCircle2, Calendar as CalendarIcon, Info, Minus, Plus, ShoppingCart, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

export default function NewOfflineOrderPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  // Firestore Data - Real-time listeners for live data sync
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: usersData, isLoading: usersLoading } = useCollection<User>(usersQuery);
  const allUsers = usersData || [];

  const packagesQuery = useMemoFirebase(() => collection(firestore, 'packages'), [firestore]);
  const { data: packagesData, isLoading: packagesLoading } = useCollection<BroadcastPackage>(packagesQuery);
  const broadcastPackages = packagesData || [];

  const menuQuery = useMemoFirebase(() => collection(firestore, 'menu_items'), [firestore]);
  const { data: menuData } = useCollection<MenuItem>(menuQuery);
  const menuItems = menuData || [];

  // State
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedPackages, setSelectedPackages] = useState<Record<string, number>>({});
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('Morning');
  const [timeValue, setTimeValue] = useState('08:30');
  const [timePeriod, setTimePeriod] = useState('AM');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // Auto-adjust AM/PM based on slot
  useEffect(() => {
    setTimePeriod(timeSlot === 'Morning' ? 'AM' : 'PM');
    if (timeSlot === 'Morning' && timeValue === '12:30') setTimeValue('08:30');
    if (timeSlot === 'Noon' && timeValue === '08:30') setTimeValue('12:30');
  }, [timeSlot, timeValue]);
  
  // Filters
  const customers = useMemo(() => {
    return allUsers.filter(u => 
      u.role === 'customer' && 
      (`${u.firstName} ${u.lastName} ${u.bacchabiteId}`).toLowerCase().includes(customerSearch.toLowerCase())
    );
  }, [allUsers, customerSearch]);

  // Logic: Show package of 1 day after selected date (matching online order logic)
  const availablePackages = useMemo(() => {
    if (!selectedDate || !broadcastPackages) return [];
    
    // 1. Determine Target Date (Selection + 1 Day) for Daily
    const targetDailyDate = addDays(selectedDate, 1);
    const dailyDateStr = format(targetDailyDate, "MMMM d, yyyy");
    
    // 2. Determine Month for Subscriptions
    const monthStr = format(selectedDate, "MMMM yyyy");

    return broadcastPackages.filter(pkg => 
      (pkg.type === 'daily' && pkg.dateContext === dailyDateStr) || 
      (pkg.type === 'monthly' && pkg.dateContext === monthStr)
    );
  }, [selectedDate, broadcastPackages]);

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

  // Handlers
  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setDeliveryAddress(user.address || '');
  };

  const updatePackageQuantity = (pkgId: string, delta: number) => {
    setSelectedPackages(prev => {
      const current = prev[pkgId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [pkgId]: next };
    });
  };

  const handlePlaceOrder = () => {
    if (!selectedUser) {
      toast({ title: "No Customer", description: "Please select a customer first.", variant: "destructive" });
      return;
    }
    if (cartPackages.length === 0) {
      toast({ title: "Empty Cart", description: "Add at least one package to the order.", variant: "destructive" });
      return;
    }

    const ordersRef = collection(firestore, 'orders');
    
    cartPackages.forEach(({ pkg, qty }) => {
      // Cross-reference menu items from Firestore to build full order details
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

      // Save to Firestore 'orders' collection (Same structure as online entry)
      addDocumentNonBlocking(ordersRef, {
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
        status: 'Pending',
        paymentStatus: 'pending',
        referenceDate: (selectedDate || new Date()).toISOString(),
        createdAt: new Date().toISOString()
      });
    });

    toast({ title: "Orders Recorded", description: `Offline order for ${selectedUser.firstName} has been saved to Firestore.` });
    router.push('/admin');
  };

  const targetDateLabel = useMemo(() => {
    if (!selectedDate) return "";
    return format(addDays(selectedDate, 1), "PPP");
  }, [selectedDate]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm hover:bg-secondary/20 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-headline font-bold text-accent">Offline Order Entry</h1>
          <p className="text-muted-foreground mt-1 font-medium">Create orders on behalf of customers using live packages.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          {/* Section 1: Customer Selection */}
          <Card className="rounded-[2rem] border-none shadow-sm overflow-hidden bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-primary" />
                1. Select Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search live directory by name or ID..." 
                  value={customerSearch} 
                  onChange={(e) => setCustomerSearch(e.target.value)} 
                  className="pl-11 h-12 rounded-2xl bg-secondary/20 border-none focus-visible:ring-primary/20 font-bold" 
                />
              </div>
              <ScrollArea className="h-40 border-2 border-secondary/30 rounded-2xl bg-secondary/5">
                <div className="p-2 space-y-1">
                  {usersLoading ? (
                    <div className="p-10 text-center">
                      <Loader2 className="animate-spin mx-auto w-6 h-6 text-primary" />
                      <p className="text-[10px] font-black uppercase text-muted-foreground mt-2">Syncing Directory...</p>
                    </div>
                  ) : customers.map((user) => (
                    <div 
                      key={user.id} 
                      onClick={() => handleUserSelect(user)} 
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all",
                        selectedUser?.id === user.id ? "bg-primary text-white shadow-lg scale-[0.99]" : "hover:bg-primary/5"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs",
                          selectedUser?.id === user.id ? "bg-white/20" : "bg-secondary text-primary"
                        )}>
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
                <div className="p-4 bg-green-50 border-2 border-green-100 rounded-2xl flex items-center justify-between animate-in zoom-in-95 duration-300">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-black text-green-800">{selectedUser.firstName} {selectedUser.lastName} Selected</p>
                      <p className="text-[10px] text-green-600/70 font-bold">Orders will be assigned to this profile.</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)} className="text-green-800 hover:bg-green-100 h-8 px-2 font-bold">Change</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 2: Package Selection */}
          <Card className="rounded-[2rem] border-none shadow-sm overflow-hidden bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                2. Select Date & Package
              </CardTitle>
              <CardDescription className="font-medium">Selecting a date will show packages available for 1 day after (Tomorrow's Specials). This also acts as the "Order Reference Date".</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="space-y-3 flex-1">
                  <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Reference Date (When Given)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant={"outline"} className={cn("w-full h-14 justify-start text-left font-bold rounded-2xl bg-secondary/30 border-none px-6", !selectedDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-3 h-5 w-5 text-primary" />
                        {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-3xl border-none shadow-2xl" align="start">
                      <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus className="rounded-3xl" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-3 flex-1">
                  <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Target Delivery Date</Label>
                  <div className="h-14 bg-accent/5 border-2 border-dashed border-accent/20 rounded-2xl flex items-center px-6 gap-3">
                    <Sparkles className="w-5 h-5 text-accent" />
                    <span className="font-black text-accent">{targetDateLabel}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-secondary/30">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Available Packages for {targetDateLabel}</Label>
                  <Badge variant="outline" className="border-secondary text-[9px] font-black px-2">LIVE DATA</Badge>
                </div>
                
                {packagesLoading ? (
                  <div className="p-12 text-center">
                    <Loader2 className="animate-spin mx-auto w-8 h-8 text-primary" />
                    <p className="mt-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">Querying Packages...</p>
                  </div>
                ) : availablePackages.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availablePackages.map((pkg) => (
                      <div 
                        key={pkg.id} 
                        className={cn(
                          "p-5 border-2 rounded-[2rem] transition-all flex flex-col justify-between h-full group",
                          selectedPackages[pkg.id] > 0 ? "border-primary bg-primary/5 shadow-md" : "border-secondary/30 bg-white hover:border-primary/20"
                        )}
                      >
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <Badge variant="secondary" className={cn(
                              "rounded-lg px-2.5 py-0.5 font-bold uppercase text-[9px]",
                              pkg.type === 'daily' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                            )}>
                              {pkg.type} Package
                            </Badge>
                            <span className="font-black text-primary text-xl">{pkg.price}</span>
                          </div>
                          <p className="font-black text-sm text-accent leading-tight line-clamp-2">{pkg.name}</p>
                          <p className="text-[10px] text-muted-foreground italic font-medium">"{pkg.message}"</p>
                        </div>
                        <div className="mt-4 flex items-center justify-between bg-secondary/20 p-2 rounded-2xl">
                          <span className="text-xs font-bold px-2">Add to Order</span>
                          <div className="flex items-center gap-3">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 rounded-xl bg-white shadow-sm hover:text-destructive" 
                              onClick={() => updatePackageQuantity(pkg.id, -1)}
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="font-black text-lg w-4 text-center">{selectedPackages[pkg.id] || 0}</span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 rounded-xl bg-primary text-white hover:bg-primary/90 hover:text-white shadow-md" 
                              onClick={() => updatePackageQuantity(pkg.id, 1)}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-10 border-2 border-dashed border-secondary/50 rounded-[2rem] flex flex-col items-center justify-center text-center space-y-3 bg-secondary/5 opacity-60">
                    <div className="p-4 bg-white rounded-full">
                      <Info className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm font-bold text-muted-foreground max-w-[250px]">No packages found for {targetDateLabel} in Firestore.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: Order Summary & Logistics */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white sticky top-24">
            <CardHeader className="bg-accent text-white p-7">
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-6 h-6" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-7 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Selected Items</Label>
                  <div className="space-y-3 min-h-[100px]">
                    {cartPackages.length > 0 ? cartPackages.map(({ pkg, qty }) => (
                      <div key={pkg!.id} className="flex justify-between items-start text-sm bg-secondary/10 p-3 rounded-xl border border-secondary/20 animate-in slide-in-from-right-2">
                        <div>
                          <p className="font-bold">{qty}x {pkg!.name}</p>
                          <p className="text-[10px] text-muted-foreground line-clamp-1 italic font-medium">{pkg!.dateContext}</p>
                        </div>
                        <span className="font-black text-accent">{pkg!.price * qty}</span>
                      </div>
                    )) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center bg-secondary/5 rounded-2xl border-2 border-dashed border-secondary">
                        <Package className="w-6 h-6 text-muted-foreground/20 mb-1" />
                        <p className="text-[10px] text-muted-foreground font-black uppercase">No Items Added</p>
                      </div>
                    )}
                  </div>
                  <div className="pt-4 mt-2 border-t-2 border-dashed border-secondary flex justify-between items-center">
                    <span className="font-black text-lg">Total Bill</span>
                    <span className="text-2xl font-black text-primary">{totalAmount}</span>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t-2 border-secondary/30">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Slot</Label>
                      <Select value={timeSlot} onValueChange={(v) => setTimeSlot(v as TimeSlot)}>
                        <SelectTrigger className="rounded-xl border-secondary font-bold h-11 bg-secondary/10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="Morning">Morning</SelectItem>
                          <SelectItem value="Noon">Noon</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Time</Label>
                      <div className="flex gap-2">
                        <Input 
                          value={timeValue} 
                          onChange={(e) => setTimeValue(e.target.value)} 
                          className="rounded-xl h-11 border-secondary font-bold flex-1 bg-secondary/10" 
                          placeholder="08:30" 
                        />
                        <Select value={timePeriod} onValueChange={setTimePeriod}>
                          <SelectTrigger className="w-20 h-11 rounded-xl border-secondary font-bold bg-secondary/10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="AM">AM</SelectItem>
                            <SelectItem value="PM">PM</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-primary" />
                      Delivery Address
                    </Label>
                    <Textarea 
                      value={deliveryAddress} 
                      onChange={(e) => setDeliveryAddress(e.target.value)} 
                      placeholder="Fetch automatic address or enter new..." 
                      className="rounded-2xl min-h-[100px] border-secondary text-sm font-medium focus-visible:ring-primary/20 bg-secondary/5" 
                    />
                  </div>
                </div>
              </div>
              
              <Button 
                onClick={handlePlaceOrder} 
                className="w-full bg-primary hover:bg-primary/90 text-white rounded-[1.5rem] h-16 font-black text-xl shadow-2xl shadow-primary/20 transition-all active:scale-95 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                disabled={!selectedUser || cartPackages.length === 0}
              >
                <ShoppingCart className="w-6 h-6 mr-3" />
                Confirm Order
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { PackageGrid } from '@/components/menu/PackageGrid';
import { BroadcastPackage, TimeSlot, Order, User, MenuItem } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Bell, Sparkles, CalendarIcon, ChevronRight, Truck, Clock, Package as PackageIcon, Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { format, getMonth, getYear, isValid, addDays, startOfDay, parse, subDays, setHours, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

export default function CustomerHome() {
  const router = useRouter();
  const firestore = useFirestore();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<BroadcastPackage | null>(null);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [timeValue, setTimeValue] = useState('08:30');
  const [timePeriod, setTimePeriod] = useState('AM');
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('Morning');
  
  const [activeTab, setActiveTab] = useState('all');
  const [schemeStartDate, setSchemeStartDate] = useState<Date | undefined>(undefined);
  const [schemeEndDate, setSchemeEndDate] = useState<Date | undefined>(undefined);
  const [isStartPopoverOpen, setIsStartPopoverOpen] = useState(false);
  const [isEndPopoverOpen, setIsEndPopoverOpen] = useState(false);
  
  const [dailyDate, setDailyDate] = useState<Date | undefined>(undefined);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [monthlyMonth, setMonthlyMonth] = useState<number>(getMonth(new Date()));
  const [monthlyYear, setMonthlyYear] = useState<number>(getYear(new Date()));

  const { toast } = useToast();

  // Firestore Data with safety fallbacks
  const packagesQuery = useMemoFirebase(() => collection(firestore, 'packages'), [firestore]);
  const { data: allPackagesData = [] } = useCollection<BroadcastPackage>(packagesQuery);
  const allPackages = allPackagesData || [];
  
  const ordersQuery = useMemoFirebase(() => collection(firestore, 'orders'), [firestore]);
  const { data: allOrdersData = [] } = useCollection<Order>(ordersQuery);
  const allOrders = allOrdersData || [];

  const menuQuery = useMemoFirebase(() => collection(firestore, 'menu_items'), [firestore]);
  const { data: menuData = [] } = useCollection<MenuItem>(menuQuery);
  const menu = menuData || [];

  useEffect(() => {
    const verifyCustomer = async () => {
      const loggedId = localStorage.getItem('bacchabite_logged_id');
      if (!loggedId) {
        router.replace('/');
        return;
      }

      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('bacchabiteId', '==', loggedId), limit(1));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const userData = { ...docSnap.data(), id: docSnap.id } as User;
        if (userData.role === 'customer') {
          setCurrentUser(userData);
          setIsAuthorized(true);
          setDailyDate(new Date());
        } else {
          router.replace('/');
        }
      } else {
        router.replace('/');
      }
    };

    verifyCustomer();
  }, [router, firestore]);

  useEffect(() => {
    if (timeSlot === 'Morning') {
      setTimePeriod('AM');
      if (timeValue === '12:30') setTimeValue('08:30');
    } else {
      setTimePeriod('PM');
      if (timeValue === '08:30') setTimeValue('12:30');
    }
  }, [timeSlot]);

  const handleOrderClick = (pkg: BroadcastPackage) => {
    setSelectedPackage(pkg);
    setIsOrderDialogOpen(true);
  };

  const confirmOrder = () => {
    if (!selectedPackage || !currentUser) return;

    const finalTime = `${timeValue} ${timePeriod}`;
    const ordersRef = collection(firestore, 'orders');
    
    // Build order items from package item IDs
    const orderItems = (selectedPackage.items || []).map(id => {
      const m = menu.find(mi => mi.id === id);
      return {
        menuItemId: id,
        name: m?.name || "Unknown",
        quantity: quantity,
        price: m?.price || 0,
        type: m?.type || 'Veg'
      };
    });

    addDocumentNonBlocking(ordersRef, {
      customerId: currentUser.id,
      customerName: `${currentUser.firstName} ${currentUser.lastName}`,
      packageName: selectedPackage.name,
      packageQuantity: quantity,
      address: currentUser.address,
      mobile: currentUser.mobileNumber,
      items: orderItems,
      total: selectedPackage.price * quantity,
      type: selectedPackage.type === 'daily' ? 'Daily' : 'Subscription',
      slot: timeSlot,
      deliveryTime: finalTime,
      status: 'Pending',
      paymentStatus: 'pending',
      createdAt: new Date().toISOString()
    });

    toast({
      title: "Order Placed!",
      description: `Your order for ${quantity}x ${selectedPackage.name} has been placed.`,
    });
    setIsOrderDialogOpen(false);
  };

  const filteredDailyPackages = useMemo(() => {
    if (!dailyDate || !isValid(dailyDate) || !allPackages) return [];
    const targetDate = addDays(dailyDate, 1);
    const dateStr = format(targetDate, 'MMMM d, yyyy');
    return allPackages.filter(p => p.type === 'daily' && p.dateContext === dateStr);
  }, [dailyDate, allPackages]);

  const filteredSchemePackages = useMemo(() => {
    if (!allPackages) return [];
    
    return allPackages.filter(pkg => {
      if (pkg.type !== 'scheme' && pkg.type !== 'monthly') return false;
      
      // If no filter, show all
      if (!schemeStartDate || !schemeEndDate) return true;

      if (!pkg.startDate || !pkg.endDate) return false;
      const pStart = new Date(pkg.startDate);
      const pEnd = new Date(pkg.endDate);
      // Overlap logic: Scheme interval [pStart, pEnd] overlaps with user interval [schemeStartDate, schemeEndDate]
      return pStart <= schemeEndDate && pEnd >= schemeStartDate;
    });
  }, [allPackages, schemeStartDate, schemeEndDate]);

  const filteredAllPackages = useMemo(() => {
    if (!allPackages) return [];
    return allPackages;
  }, [allPackages]);

  const upcomingOrder = useMemo(() => {
    if (!currentUser || !allOrders) return null;
    const myOrders = allOrders.filter(o => 
      o.customerId === currentUser.id && 
      o.status !== 'Cancelled' && 
      o.status !== 'Delivered'
    );
    return [...myOrders].sort((a, b) => {
      const dateA = typeof a.createdAt === 'string' ? parseISO(a.createdAt) : a.createdAt;
      const dateB = typeof b.createdAt === 'string' ? parseISO(b.createdAt) : b.createdAt;
      return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
    })[0];
  }, [currentUser, allOrders]);

  const orderedPackageIds = useMemo(() => {
    if (!currentUser || !allOrders || !allPackages) return [];
    const myOrders = allOrders.filter(o => o.customerId === currentUser.id);
    return allPackages.filter(pkg => 
      myOrders.some(o => 
        o.packageName === pkg.name && 
        format(parseISO(o.createdAt as any), pkg.type === 'daily' ? 'MMMM d, yyyy' : 'MMMM yyyy') === pkg.dateContext
      )
    ).map(p => p.id);
  }, [currentUser, allOrders, allPackages]);

  const pastPackageIds = useMemo(() => {
    if (!allPackages) return [];
    const now = new Date();
    return allPackages.filter(pkg => {
      try {
        if (pkg.type === 'daily') {
          const targetDate = parse(pkg.dateContext, 'MMMM d, yyyy', new Date());
          const deadline = setHours(subDays(startOfDay(targetDate), 1), 19);
          return now > deadline;
        } else {
          const monthStartDate = parse(pkg.dateContext, 'MMMM yyyy', new Date());
          const subscriptionDeadline = startOfDay(monthStartDate);
          subscriptionDeadline.setDate(8);
          return now >= subscriptionDeadline;
        }
      } catch (e) {
        console.error(e);
        return false;
      }
    }).map(p => p.id);
  }, [allPackages]);

  const tomorrowSpecialName = useMemo(() => {
    if (!dailyDate || !allPackages) return "Nutri-Balanced Meal";
    const tomorrow = addDays(dailyDate, 1);
    const dateStr = format(tomorrow, 'MMMM d, yyyy');
    const pkg = allPackages.find(p => p.type === 'daily' && p.dateContext === dateStr);
    return pkg?.name || "Nutri-Balanced Meal";
  }, [dailyDate, allPackages]);

  if (!isAuthorized || !currentUser) {
    return (
      <div className="min-h-screen bg-secondary/10 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Authenticating Session...</p>
      </div>
    );
  }

  return (
    <div className="pb-24 md:pb-0 md:pt-16 min-h-screen bg-secondary/10">
      <Navbar role="customer" />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-headline font-bold text-primary">Hi, {currentUser.firstName}! 👋</h1>
            <p className="text-muted-foreground mt-2 font-medium">Plan ahead for some yummy and healthy bites!</p>
          </div>

          <div className="bg-white p-4 pr-10 rounded-[2.5rem] shadow-sm border flex items-center gap-4 w-fit min-w-[300px] self-start md:self-center animate-in fade-in slide-in-from-right-4 duration-700">
            <div className="bg-accent/5 p-4 rounded-2xl shrink-0">
              <Bell className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-[10px] font-black text-accent uppercase tracking-widest leading-none">Tomorrow's Special</p>
              <p className="text-lg font-bold text-slate-900 mt-1">
                {tomorrowSpecialName}
              </p>
            </div>
          </div>
        </header>

        {upcomingOrder && (
          <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Card className="rounded-[2.5rem] border-none shadow-md overflow-hidden bg-white ring-2 ring-primary/10 max-w-2xl">
              <CardContent className="p-0">
                <div className="bg-primary/5 px-6 py-3 border-b border-primary/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">Upcoming Delivery</span>
                  </div>
                  <Badge variant="outline" className="bg-white text-[9px] font-bold border-primary/20 text-primary uppercase">
                    {upcomingOrder.status}
                  </Badge>
                </div>
                <div className="p-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
                      <PackageIcon className="w-7 h-7 text-primary/40" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-accent leading-tight">{upcomingOrder.packageName || "Custom Meal"}</h3>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold">{upcomingOrder.slot} • {upcomingOrder.deliveryTime}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                          <span className="text-[10px] font-black text-blue-600 uppercase">Live Tracking</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Link href="/customer/orders">
                    <Button variant="ghost" size="icon" className="rounded-full hover:bg-secondary h-10 w-10">
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <section className="space-y-12">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-3 w-full sm:w-[480px] bg-secondary/20 p-1 rounded-2xl h-12 mb-8">
              <TabsTrigger value="all" className="rounded-xl font-bold h-10 data-[state=active]:bg-primary data-[state=active]:text-white">All</TabsTrigger>
              <TabsTrigger value="daily" className="rounded-xl font-bold h-10 data-[state=active]:bg-primary data-[state=active]:text-white">Daily</TabsTrigger>
              <TabsTrigger value="scheme" className="rounded-xl font-bold h-10 data-[state=active]:bg-primary data-[state=active]:text-white">Scheme</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-12 outline-none animate-in fade-in duration-300">
               {/* Include all sections here for 'all' tab? Or just show filtered? */}
               {/* Actually the request says "tabs for all, daily and scheme". I'll put appropriate content in each tab. */}
               {/* Maybe just render everything in "All"? Or just show a list? The user said "keep listing". */}
               <PackageGrid packages={filteredAllPackages} onOrder={handleOrderClick} orderedIds={orderedPackageIds} pastIds={pastPackageIds} menuItems={menu} />
            </TabsContent>

            <TabsContent value="daily" className="space-y-12 outline-none animate-in fade-in duration-300">
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-primary" />
                    <h2 className="text-2xl font-bold font-headline">Daily Special Packages</h2>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Selection (Showing Next Day Menu)</Label>
                    <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full md:w-[240px] h-12 justify-start text-left font-bold rounded-2xl bg-white border-none shadow-sm px-4",
                            !dailyDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                          {dailyDate ? format(dailyDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-3xl border-none shadow-2xl" align="end">
                        <Calendar
                          mode="single"
                          selected={dailyDate}
                          onSelect={(date) => {
                            if (date) {
                              setDailyDate(date);
                              setIsDatePickerOpen(false);
                            }
                          }}
                          initialFocus
                          className="rounded-3xl"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {filteredDailyPackages.length > 0 ? (
                  <PackageGrid 
                    packages={filteredDailyPackages} 
                    onOrder={handleOrderClick} 
                    orderedIds={orderedPackageIds}
                    pastIds={pastPackageIds}
                    menuItems={menu}
                  />
                ) : (
                  <div className="p-12 border-2 border-dashed border-secondary rounded-[2.5rem] bg-white/50 text-center space-y-3">
                    <p className="text-muted-foreground font-medium italic">
                      No special packages found for {dailyDate ? format(addDays(dailyDate, 1), 'PPP') : 'tomorrow'}.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="scheme" className="space-y-12 outline-none animate-in fade-in duration-300">
               {/* Scheme section with date filter */}
               <div className="space-y-6">
                 <div className="bg-secondary/10 p-5 rounded-[1.5rem] border border-secondary/20">
                    <div className="space-y-4">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select Scheme Date Range</Label>
                      <div className="flex flex-col sm:flex-row gap-4 items-center">
                        <Popover open={isStartPopoverOpen} onOpenChange={setIsStartPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full h-12 justify-start text-left font-bold rounded-xl bg-white border-none px-4 shadow-sm">
                              <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                              {schemeStartDate ? format(schemeStartDate, "PPP") : <span>Start Date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 rounded-3xl border-none shadow-2xl" align="start">
                            <Calendar mode="single" selected={schemeStartDate} onSelect={(date) => { setSchemeStartDate(date); setIsStartPopoverOpen(false); }} initialFocus className="rounded-3xl" />
                          </PopoverContent>
                        </Popover>
                        <Popover open={isEndPopoverOpen} onOpenChange={setIsEndPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full h-12 justify-start text-left font-bold rounded-xl bg-white border-none px-4 shadow-sm">
                              <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                              {schemeEndDate ? format(schemeEndDate, "PPP") : <span>End Date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 rounded-3xl border-none shadow-2xl" align="start">
                            <Calendar mode="single" selected={schemeEndDate} onSelect={(date) => { setSchemeEndDate(date); setIsEndPopoverOpen(false); }} initialFocus className="rounded-3xl" />
                          </PopoverContent>
                        </Popover>
                        {(schemeStartDate || schemeEndDate) && (
                          <Button 
                            variant="ghost" 
                            onClick={() => { setSchemeStartDate(undefined); setSchemeEndDate(undefined); }}
                            className="text-xs font-bold text-destructive hover:text-destructive/80"
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {filteredSchemePackages.length > 0 ? (
                    <PackageGrid 
                      packages={filteredSchemePackages} 
                      onOrder={handleOrderClick} 
                      orderedIds={orderedPackageIds}
                      pastIds={pastPackageIds}
                      menuItems={menu}
                    />
                  ) : (
                    <div className="p-12 border-2 border-dashed border-secondary rounded-[2.5rem] bg-white/50 text-center space-y-3">
                      <p className="text-muted-foreground font-medium italic">No scheme packages found in range.</p>
                    </div>
                  )}
               </div>
            </TabsContent>
          </Tabs>
        </section>

        <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
          <DialogContent className="rounded-3xl max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl font-headline">Place Order</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="flex items-center gap-4 bg-secondary/30 p-4 rounded-2xl">
                <div className="p-3 bg-white rounded-xl shadow-sm">
                  <Sparkles className={selectedPackage?.type === 'daily' ? "text-primary" : "text-accent"} />
                </div>
                <div>
                  <h4 className="font-bold">{selectedPackage?.name}</h4>
                  <p className="text-primary font-bold">{selectedPackage?.price}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input 
                      id="quantity" 
                      type="number" 
                      value={quantity} 
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      min={1}
                      className="rounded-xl h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Preferred Slot</Label>
                    <Select value={timeSlot} onValueChange={(v: TimeSlot) => setTimeSlot(v)}>
                      <SelectTrigger className="rounded-xl h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="Morning">Morning</SelectItem>
                        <SelectItem value="Noon">Noon</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Preferred Time Within Slot</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="text" 
                      value={timeValue} 
                      onChange={(e) => setTimeValue(e.target.value)}
                      placeholder="08:30"
                      className="rounded-xl h-12 flex-1"
                    />
                    <Select value={timePeriod} onValueChange={setTimePeriod}>
                      <SelectTrigger className="w-24 h-12 rounded-xl">
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
            </div>
            <DialogFooter>
              <Button onClick={confirmOrder} className="w-full h-14 text-lg bg-primary hover:bg-primary/90 rounded-2xl font-bold shadow-lg shadow-primary/20">
                Confirm {selectedPackage?.type === 'daily' ? 'Daily Order' : 'Subscription'} • {(selectedPackage?.price || 0) * quantity}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

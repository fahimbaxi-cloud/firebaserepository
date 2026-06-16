"use client";

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription,
  DialogTrigger
} from '@/components/ui/dialog';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Order, OrderStatus, TimeSlot, User, BroadcastPackage, MenuItem } from '@/lib/types';
import { 
  Package, 
  Clock, 
  ChevronRight, 
  Sparkles, 
  Box, 
  Edit, 
  Trash2, 
  AlertTriangle,
  CheckCircle2,
  Info,
  Image as ImageIcon,
  ZoomIn,
  Calendar,
  UtensilsCrossed,
  ChevronDown,
  ChevronUp,
  Loader2,
  Headset,
  Phone,
  MessageCircle,
  HelpCircle,
  Search,
  FilterX,
  Wallet,
  Hash
} from 'lucide-react';
import { format, subDays, setHours, startOfDay, isAfter, parseISO, parse, getMonth, getYear, isWithinInterval, endOfDay, isValid } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, getDocs, limit, doc } from 'firebase/firestore';

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

export default function CustomerOrdersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [statusFilters, setStatusFilters] = useState<OrderStatus[]>([]);
  const [slotFilters, setSlotFilters] = useState<TimeSlot[]>([]);
  const [packageSearch, setPackageSearch] = useState('');
  const [qtySearch, setQtySearch] = useState('');
  const [amountSearch, setBillAmountSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString());

  const packagesQuery = useMemoFirebase(() => collection(firestore, 'packages'), [firestore]);
  const { data: allPackagesData } = useCollection<BroadcastPackage>(packagesQuery);
  const allPackages = allPackagesData || [];

  const menuQuery = useMemoFirebase(() => collection(firestore, 'menu_items'), [firestore]);
  const { data: menuData } = useCollection<MenuItem>(menuQuery);
  const menu = menuData || [];

  const ordersQuery = useMemoFirebase(() => {
    if (!currentUser || !currentUser.id) return null;
    return query(collection(firestore, 'orders'), where('customerId', '==', currentUser.id));
  }, [firestore, currentUser]);
  const { data: ordersData, isLoading: ordersLoading } = useCollection<Order>(ordersQuery);
  const orders = ordersData || [];

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editQuantity, setEditQuantity] = useState(1);
  const [editSlot, setEditSlot] = useState<TimeSlot>('Morning');
  const [editTimeValue, setEditTimeValue] = useState('08:30');
  const [editTimePeriod, setEditTimePeriod] = useState('AM');

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [selectedHelpOrder, setSelectedHelpOrder] = useState<Order | null>(null);

  useEffect(() => {
    setMounted(true);
    const verifyUser = async () => {
      const loggedId = localStorage.getItem('bacchabite_logged_id');
      if (loggedId) {
        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, where('bacchabiteId', '==', loggedId), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          setCurrentUser({ ...docSnap.data(), id: docSnap.id } as User);
        }
      }
    };
    verifyUser();
  }, [firestore]);

  const toggleDay = (key: string) => {
    setOpenDays(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getStatusColor = (status: OrderStatus) => {
    switch(status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-700';
      case 'Assigned': return 'bg-blue-100 text-blue-700';
      case 'Out for Delivery': return 'bg-purple-100 text-purple-700';
      case 'Delivered': return 'bg-green-100 text-green-700';
      case 'Cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    return orders.filter(o => {
      const orderDate = parseDateSafe(o.createdAt);
      
      if (startDate && orderDate < startOfDay(parseISO(startDate))) return false;
      if (endDate && orderDate > endOfDay(parseISO(endDate))) return false;

      if (statusFilters.length > 0 && !statusFilters.includes(o.status)) return false;

      if (slotFilters.length > 0 && !slotFilters.includes(o.slot)) return false;

      if (packageSearch && !(o.packageName || '').toLowerCase().includes(packageSearch.toLowerCase())) return false;

      if (qtySearch && (o.packageQuantity || 1).toString() !== qtySearch) return false;

      if (amountSearch && !o.total.toString().includes(amountSearch)) return false;

      if (monthFilter !== 'all' && getMonth(orderDate).toString() !== monthFilter) return false;
      if (yearFilter && getYear(orderDate).toString() !== yearFilter) return false;

      return true;
    }).sort((a, b) => {
      const dateA = parseDateSafe(a.createdAt);
      const dateB = parseDateSafe(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });
  }, [orders, startDate, endDate, statusFilters, slotFilters, packageSearch, qtySearch, amountSearch, monthFilter, yearFilter]);

  const orderStats = useMemo(() => {
    return {
      count: filteredOrders.length,
      totalValue: filteredOrders.reduce((sum, o) => sum + o.total, 0)
    };
  }, [filteredOrders]);

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setStatusFilters([]);
    setSlotFilters([]);
    setPackageSearch('');
    setQtySearch('');
    setBillAmountSearch('');
    setMonthFilter('all');
    setYearFilter(new Date().getFullYear().toString());
  };

  const toggleStatusFilter = (status: OrderStatus) => {
    setStatusFilters(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const toggleSlotFilter = (slot: TimeSlot) => {
    setSlotFilters(prev => 
      prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]
    );
  };

  const isOrderLocked = (order: Order) => {
    if (!mounted) return true;
    const now = new Date();
    const pkg = allPackages.find(p => p.name === order.packageName);
    
    if (order.type === 'Daily') {
      if (!pkg) return order.status !== 'Pending';
      try {
        const targetDate = parse(pkg.dateContext, 'MMMM d, yyyy', new Date());
        const cutoff = setHours(subDays(startOfDay(targetDate), 1), 19);
        return isAfter(now, cutoff) || order.status !== 'Pending';
      } catch (e) {
        console.error(e);
        return order.status !== 'Pending';
      }
    } else {
      if (!pkg) return order.status !== 'Pending';
      try {
        const monthStartDate = parse(pkg.dateContext, 'MMMM yyyy', new Date());
        const cutoff = startOfDay(monthStartDate);
        cutoff.setDate(8);
        return isAfter(now, cutoff) || order.status !== 'Pending';
      } catch (e) {
        console.error(e);
        return order.status !== 'Pending';
      }
    }
  };

  const handleEditClick = (order: Order) => {
    setEditingOrder(order);
    setEditQuantity(order.packageQuantity || 1);
    setEditSlot(order.slot);
    const [time, period] = (order.deliveryTime || '08:30 AM').split(' ');
    setEditTimeValue(time || '08:30');
    setEditTimePeriod(period || 'AM');
    setIsEditDialogOpen(true);
  };

  const saveEdit = () => {
    if (!editingOrder) return;
    const updatedTime = `${editTimeValue} ${editTimePeriod}`;
    const orderRef = doc(firestore, 'orders', editingOrder.id);
    updateDocumentNonBlocking(orderRef, {
      packageQuantity: editQuantity,
      slot: editSlot,
      deliveryTime: updatedTime,
      updatedAt: new Date().toISOString()
    });
    toast({ title: "Order Updated", description: `Your order #${editingOrder.id} has been updated.` });
    setIsEditDialogOpen(false);
  };

  const handleDeleteClick = (orderId: string) => {
    setDeletingOrderId(orderId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!deletingOrderId) return;
    const orderRef = doc(firestore, 'orders', deletingOrderId);
    updateDocumentNonBlocking(orderRef, { status: 'Cancelled', updatedAt: new Date().toISOString() });
    toast({ title: "Order Cancelled", description: `Order #${deletingOrderId} is now marked as Cancelled.` });
    setIsDeleteDialogOpen(false);
  };

  const handleHelpClick = (order: Order) => {
    setSelectedHelpOrder(order);
    setIsHelpDialogOpen(true);
  };

  const getPackageItems = (order: Order) => {
    const pkg = allPackages.find(p => p.name === order.packageName);
    if (pkg && pkg.items) {
      return pkg.items.map(id => menu.find(m => m.id === id)).filter(Boolean).filter((m: any) => m.show !== false);
    }
    return (order.items || []).filter((item: any) => {
      const menuItem = menu.find(m => m.id === item.menuItemId || m.name === item.name);
      return !menuItem || menuItem.show !== false;
    });
  };

  const PackageItemRow = ({ item }: { item: any }) => (
    <div className="flex items-center gap-3 bg-secondary/20 p-2.5 rounded-2xl border border-secondary/30 transition-all hover:bg-white hover:border-primary/20 group">
      <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-secondary bg-white">
        <img 
          src={item.imageUrl || `https://picsum.photos/seed/${item.id}/100/100`} 
          className="object-cover w-full h-full" 
          alt={item.name} 
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-accent truncate leading-tight">{item.name}</p>
        <p className={cn("text-[9px] font-bold uppercase", item.type === 'Veg' ? "text-green-600" : "text-red-600")}>{item.type}</p>
      </div>
      <div className="shrink-0 mr-1">
        <div className="w-5 h-5 rounded-full bg-green-100 border border-green-200 flex items-center justify-center">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
        </div>
      </div>
    </div>
  );

  const BreakdownSection = ({ order }: { order: Order }) => {
    const items = getPackageItems(order);
    return (
      <div className="bg-primary/5 p-5 rounded-[2rem] border border-primary/10 mt-2 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-primary" />
          <p className="text-[10px] font-black uppercase text-primary tracking-widest">What's Inside</p>
        </div>
        {order.type === 'Subscription' ? (
          <div className="space-y-2.5">
            {items.map((item: any, idx: number) => {
              const dayKey = `${order.id}-day-${idx}`;
              const isOpen = !!openDays[dayKey];
              return (
                <Collapsible key={dayKey} open={isOpen} onValueChange={() => toggleDay(dayKey)} className="w-full">
                  <div className={cn("flex items-center justify-between p-2.5 rounded-2xl border transition-all", isOpen ? "bg-white border-primary/30 shadow-sm" : "bg-secondary/20 border-secondary/30")}>
                    <div className="flex items-center gap-3">
                      <div className="bg-primary text-white font-black text-[9px] w-7 h-7 flex items-center justify-center rounded-lg shadow-sm">D{idx + 1}</div>
                      <div>
                        <p className="text-xs font-black text-accent">Day {idx + 1} Package</p>
                        <p className="text-[9px] text-muted-foreground font-bold">{item?.name || "Surprise Meal"}</p>
                      </div>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 rounded-full p-0 hover:bg-primary/10 hover:text-primary">
                        {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent className="animate-in slide-in-from-top-2 duration-300">
                    <div className="mt-1 px-1"><PackageItemRow item={item} /></div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">{items.map((item: any, idx: number) => (<PackageItemRow key={idx} item={item} />))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="pb-24 md:pb-0 md:pt-16 min-h-screen bg-secondary/20">
      <Navbar role="customer" />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold">My Orders</h1>
            <p className="text-muted-foreground mt-1">Track and manage your healthy bites.</p>
          </div>
          {(startDate || endDate || statusFilters.length > 0 || slotFilters.length > 0 || packageSearch || qtySearch || amountSearch || monthFilter !== 'all') && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="rounded-full font-bold text-xs text-primary hover:bg-primary/10">
              <FilterX className="w-4 h-4 mr-2" /> Clear All Filters
            </Button>
          )}
        </header>

        <Card className="rounded-[2rem] border-none shadow-sm overflow-hidden bg-white mb-8">
          <CardHeader className="p-6 pb-2 bg-secondary/30 border-b">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" /> Filter Registry
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Period Range</Label>
                <div className="flex items-center gap-2">
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-12 rounded-xl bg-secondary/20 border-none text-xs font-bold" />
                  <span className="text-muted-foreground text-[10px] font-black">TO</span>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-12 rounded-xl bg-secondary/20 border-none text-xs font-bold" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Time Slot</Label>
                <div className="flex gap-2">
                  {(['Morning', 'Noon'] as TimeSlot[]).map(slot => (
                    <Button 
                      key={slot} 
                      size="sm" 
                      variant="outline" 
                      onClick={() => toggleSlotFilter(slot)}
                      className={cn(
                        "h-12 flex-1 rounded-xl font-bold transition-all",
                        slotFilters.includes(slot) ? "bg-accent text-white border-accent shadow-sm" : "bg-white text-accent border-secondary"
                      )}
                    >
                      {slot}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-secondary/30">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Order Status</Label>
              <div className="flex flex-wrap gap-2">
                {(['Pending', 'Assigned', 'Out for Delivery', 'Delivered', 'Cancelled'] as OrderStatus[]).map(status => (
                  <Button 
                    key={status} 
                    size="sm" 
                    variant="outline" 
                    onClick={() => toggleStatusFilter(status)}
                    className={cn(
                      "h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all",
                      statusFilters.includes(status) ? "bg-primary text-white border-primary shadow-md" : "bg-white text-muted-foreground border-secondary hover:bg-secondary/20"
                    )}
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-secondary/30">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Package Name</Label>
                <div className="relative">
                  <Input placeholder="Search Package..." value={packageSearch} onChange={e => setPackageSearch(e.target.value)} className="h-11 rounded-xl bg-secondary/20 border-none pl-9 text-sm font-bold" />
                  <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Quantity</Label>
                <div className="relative">
                  <Input placeholder="Sets Qty" value={qtySearch} onChange={e => setQtySearch(e.target.value)} className="h-11 rounded-xl bg-secondary/20 border-none pl-9 text-sm font-bold" />
                  <Box className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Bill Amount</Label>
                <div className="relative">
                  <Input placeholder="Price..." value={amountSearch} onChange={e => setBillAmountSearch(e.target.value)} className="h-11 rounded-xl bg-secondary/20 border-none pl-9 text-sm font-bold" />
                  <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Month</Label>
                  <Select value={monthFilter} onValueChange={setMonthFilter}>
                    <SelectTrigger className="h-11 rounded-xl bg-secondary/20 border-none font-bold text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">All Months</SelectItem>
                      {Array.from({ length: 12 }).map((_, i) => (
                        <SelectItem key={i} value={i.toString()}>{format(new Date(2024, i), 'MMMM')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Year</Label>
                  <Input value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="h-11 rounded-xl bg-secondary/20 border-none text-xs font-bold text-center" />
                </div>
              </div>
            </div>
          </CardContent>
          <div className="bg-primary/5 px-6 py-4 border-t flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-primary" />
                <span className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">
                  Showing: <span className="text-primary font-bold">{orderStats.count} Orders</span>
                </span>
              </div>
              <div className="w-px h-5 bg-secondary" />
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                <span className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">
                  Filtered Total: <span className="text-primary font-bold">Rs {orderStats.totalValue}</span>
                </span>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          {ordersLoading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Loading Your Orders...</p>
            </div>
          ) : (filteredOrders.length > 0) ? (
            filteredOrders.map((order) => {
              const locked = isOrderLocked(order);
              const pkg = allPackages.find(p => p.name === order.packageName);
              const orderDate = parseDateSafe(order.createdAt);
              return (
                <Card key={order.id} className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white hover:shadow-md transition-shadow group">
                  <CardHeader className="p-6 pb-2 flex flex-col sm:flex-row items-start gap-4">
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-secondary shrink-0 border border-secondary group/image">
                      {pkg?.imageUrl ? (
                        <>
                          <Image src={pkg.imageUrl} alt={order.packageName || "Package"} fill className="object-cover" />
                          <Dialog>
                            <DialogTrigger asChild>
                              <button className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover/image:opacity-100 transition-opacity"><ZoomIn className="w-6 h-6 text-white" /></button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-none">
                              <div className="relative w-full aspect-video rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl">
                                <Image src={pkg.imageUrl} alt={order.packageName || "Package"} fill className="object-cover" />
                              </div>
                            </DialogContent>
                          </Dialog>
                        </>
                      ) : (<div className="flex items-center justify-center h-full text-muted-foreground/30"><ImageIcon className="w-8 h-8" /></div>)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Order #{order.id}</span>
                        <span className="text-[10px] text-muted-foreground/40">•</span>
                        <div className="flex items-center gap-1"><Calendar className="w-3 h-3 text-muted-foreground/60" /><span className="text-[10px] font-bold text-muted-foreground">{mounted ? format(orderDate, 'MMM dd, yyyy') : '...'}</span></div>
                        <Badge variant="secondary" className="text-[9px] rounded-md h-4 px-1.5 py-0 font-black uppercase border-none ml-auto sm:ml-2">{order.type}</Badge>
                      </div>
                      <CardTitle className="text-xl font-bold text-accent flex items-center gap-2">{order.packageName && <Sparkles className="w-5 h-5 text-primary shrink-0" />}{order.packageName || "Custom Selection"}</CardTitle>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black text-[10px] h-6 px-3 rounded-full"><Box className="w-3 h-3 mr-1.5" />Quantity: {order.packageQuantity || 1}</Badge>
                        <Badge className={cn("rounded-lg border-none px-3 h-6 font-bold text-[9px] uppercase", getStatusColor(order.status))}>{order.status}</Badge>
                      </div>
                    </div>
                    <div className="sm:text-right flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0">
                      <div><p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Total Bill</p><p className="text-2xl font-black text-primary leading-none">{order.total}</p></div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 pt-2">
                    <BreakdownSection order={order} />
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-1.5 bg-secondary/30 px-3 py-1.5 rounded-xl"><Clock className="w-4 h-4 text-primary" /><span className="text-xs font-bold">{order.slot} • {order.deliveryTime}</span></div>
                      <div className="flex items-center gap-2">
                        {!locked ? (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleEditClick(order)} className="h-9 px-3 rounded-xl font-bold text-xs text-primary hover:bg-primary/10"><Edit className="w-3.5 h-3.5 mr-1.5" />Update Order</Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(order.id)} className="h-9 px-3 rounded-xl font-bold text-xs text-destructive hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5 mr-1.5" />Cancel</Button>
                          </>
                        ) : (<div className="flex items-center gap-1.5 bg-secondary/50 px-3 py-1.5 rounded-xl text-[10px] text-muted-foreground font-bold italic"><AlertTriangle className="w-3.5 h-3.5 text-yellow-600" />Modifications Closed</div>)}
                      </div>
                    </div>
                    <div className="mt-6 pt-4 border-t-2 border-dashed border-secondary flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2.5 h-2.5 rounded-full", order.status === 'Delivered' ? 'bg-green-500 shadow-sm' : 'bg-blue-500 animate-pulse')} />
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wide">{order.status === 'Delivered' ? 'Delivered' : 'Expected by ' + (order.deliveryTime || 'TBD')}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleHelpClick(order)} className="h-8 rounded-full text-[10px] font-black uppercase tracking-wider text-accent hover:bg-accent/5">Order Help <ChevronRight className="w-3.5 h-3.5 ml-1" /></Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="text-center py-24 bg-white rounded-[3rem] shadow-sm border-2 border-dashed border-secondary">
              <Package className="w-20 h-20 text-muted-foreground/10 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-muted-foreground">No orders match these criteria</h3>
              <p className="text-sm text-muted-foreground/60 max-w-[200px] mx-auto mt-1">Try adjusting your filters to find your orders.</p>
              <Button variant="link" onClick={clearFilters} className="text-primary font-bold mt-2">Reset all filters</Button>
            </div>
          )}
        </div>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="rounded-3xl max-w-md">
            <DialogHeader><DialogTitle className="text-2xl font-headline text-accent font-bold">Update Order</DialogTitle></DialogHeader>
            <div className="space-y-6 py-4">
              <div className="flex items-center gap-4 bg-secondary/30 p-4 rounded-2xl">
                <div className="p-3 bg-white rounded-xl shadow-sm"><Sparkles className={editingOrder?.type === 'Daily' ? "text-primary" : "text-accent"} /></div>
                <div><h4 className="font-black text-accent leading-tight">{editingOrder?.packageName || "Custom Selection"}</h4><p className="text-primary font-black text-lg">{editingOrder?.total}</p></div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quantity</Label><Input type="number" value={editQuantity} onChange={(e) => setEditQuantity(Number(e.target.value))} min={1} className="rounded-xl h-12 bg-secondary/20 border-none font-bold" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Preferred Slot</Label><Select value={editSlot} onValueChange={(v: TimeSlot) => setEditSlot(v)}><SelectTrigger className="rounded-xl h-12 bg-secondary/20 border-none font-bold"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="Morning">Morning</SelectItem><SelectItem value="Noon">Noon</SelectItem></SelectContent></Select></div>
                </div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Delivery Time</Label><div className="flex gap-2"><Input type="text" value={editTimeValue} onChange={(e) => setEditTimeValue(e.target.value)} className="rounded-xl h-12 bg-secondary/20 border-none font-bold flex-1" /><Select value={editTimePeriod} onValueChange={setEditTimePeriod}><SelectTrigger className="w-[100px] h-12 bg-secondary/20 border-none font-bold rounded-xl"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="AM">AM</SelectItem><SelectItem value="PM">PM</SelectItem></SelectContent></Select></div></div>
              </div>
            </div>
            <DialogFooter><Button onClick={saveEdit} className="w-full h-14 text-lg bg-primary hover:bg-primary/90 rounded-2xl font-bold shadow-lg shadow-primary/20 transition-all active:scale-95">Save Order Changes</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="rounded-3xl max-w-sm">
            <DialogHeader><DialogTitle className="text-xl font-headline text-destructive flex items-center gap-2"><AlertTriangle className="w-6 h-6" />Cancel Order?</DialogTitle></DialogHeader>
            <DialogFooter className="flex-col gap-2 mt-4"><Button variant="destructive" onClick={confirmDelete} className="w-full h-12 rounded-xl font-bold">Yes, Cancel Order</Button><Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} className="w-full h-12 rounded-xl font-bold text-muted-foreground">Keep Order</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
          <DialogContent className="rounded-[2.5rem] max-w-lg border-none shadow-2xl p-0 overflow-hidden">
            <DialogHeader className="bg-accent p-8 text-white">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 rounded-2xl"><Headset className="w-8 h-8 text-white" /></div>
                <div>
                  <DialogTitle className="text-2xl font-headline font-bold">Help & Support</DialogTitle>
                  <DialogDescription className="text-white/70 font-medium">Assistance for Order #{selectedHelpOrder?.id}</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">How can we help?</p>
                <div className="grid grid-cols-1 gap-3">
                  <Button variant="outline" className="h-16 justify-start rounded-2xl border-secondary hover:border-primary hover:bg-primary/5 transition-all group" onClick={() => window.open('tel:9876543210')}>
                    <div className="p-2.5 bg-primary/10 rounded-xl mr-4 group-hover:bg-primary group-hover:text-white transition-colors"><Phone className="w-5 h-5 text-primary group-hover:text-white" /></div>
                    <div className="text-left"><p className="font-bold text-slate-900">Call Support</p><p className="text-[10px] text-muted-foreground">9876-543-210</p></div>
                  </Button>
                  <Button variant="outline" className="h-16 justify-start rounded-2xl border-secondary hover:border-green-600 hover:bg-green-50 transition-all group" onClick={() => window.open('https://wa.me/919876543210')}>
                    <div className="p-2.5 bg-green-100 rounded-xl mr-4 group-hover:bg-green-600 group-hover:text-white transition-colors"><MessageCircle className="w-5 h-5 text-green-600 group-hover:text-white" /></div>
                    <div className="text-left"><p className="font-bold text-slate-900">WhatsApp Us</p><p className="text-[10px] text-muted-foreground">Chat with an agent</p></div>
                  </Button>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-secondary/30">
                <div className="flex items-center gap-2 text-primary">
                  <HelpCircle className="w-4 h-4" />
                  <span className="text-xs font-black uppercase tracking-widest">Quick FAQs</span>
                </div>
                <div className="space-y-3">
                  <div className="p-4 bg-secondary/20 rounded-2xl border border-secondary/30">
                    <p className="text-xs font-black text-accent mb-1">Meal is late?</p>
                    <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">Our riders aim for your slot. If it's more than 15 mins late, please use the WhatsApp button for live tracking.</p>
                  </div>
                  <div className="p-4 bg-secondary/20 rounded-2xl border border-secondary/30">
                    <p className="text-xs font-black text-accent mb-1">Dietary Concerns?</p>
                    <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">All meals are kid-safe and balanced. If you notice a specific allergy issue, call us immediately to pause production.</p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="p-8 pt-0"><Button onClick={() => setIsHelpDialogOpen(false)} className="w-full h-12 rounded-xl bg-slate-900 font-bold">Close Support</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

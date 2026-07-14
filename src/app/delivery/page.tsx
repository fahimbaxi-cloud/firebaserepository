"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Order, User, OrderStatus } from '@/lib/types';
import { 
  Phone, 
  MapPin, 
  Clock, 
  Leaf, 
  Flame, 
  Loader2, 
  Package, 
  Calendar as CalendarIcon, 
  ChevronDown, 
  Search, 
  FilterX, 
  ArrowUpDown, 
  ChevronUp, 
  User as UserIcon, 
  CheckCircle2, 
  UtensilsCrossed, 
  Layers, 
  ArrowUpDown as SortIcon, 
  Printer, 
  FileDown 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, isSameDay, parseISO } from 'date-fns';
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, getDocs, limit } from 'firebase/firestore';
import { downloadPDF } from '@/lib/pdf-export';

const StatusRadio = ({ active, onClick, activeColor, isHeader = false }: { active: boolean, onClick: () => void, activeColor: string, isHeader?: boolean }) => (
  <div 
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className={cn(
      "w-6 h-6 rounded-full border-2 cursor-pointer flex items-center justify-center transition-all mx-auto",
      active ? activeColor : isHeader ? "border-white/40 bg-white/10 hover:bg-white/20" : "border-slate-200 bg-white hover:border-blue-300"
    )}
  >
    {(active || isHeader) && <div className={cn("w-2.5 h-2.5 rounded-full bg-white shadow-sm", isHeader && !active && "opacity-20")} />}
  </div>
);

const ColumnFilter = ({ placeholder, value, onChange }: { placeholder: string, value: string, onChange: (v: string) => void }) => (
  <div className="relative mt-2" onClick={(e) => e.stopPropagation()}>
    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40" />
    <Input 
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 pl-7 pr-2 text-[10px] bg-white/10 border-none text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/30 rounded-lg font-normal normal-case tracking-normal"
    />
  </div>
);

const getOrderDateStatus = (order: Order, date: Date) => {
  if (order.type === 'Subscription') {
    const dateKey = format(date, 'yyyy-MM-dd');
    return order.dailyStatuses?.[dateKey] || 'Pending';
  }
  return order.status;
};

export default function DeliveryDashboard() {
  const router = useRouter();
  const firestore = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [customRouteOrder, setCustomRouteOrder] = useState<string[]>([]);
  
  const [activeFilters, setActiveFilters] = useState({
    morning: false,
    noon: false,
    veg: false,
    nonVeg: false
  });

  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Default sorting by createdAt Descending as requested
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isRouteOrder, setIsRouteOrder] = useState(false);

  const [colFilters, setColFilters] = useState({
    order: '',
    customer: '',
    package: '',
    qty: '',
    status: ''
  });

  const { toast } = useToast();

  const ordersQuery = useMemoFirebase(() => collection(firestore, 'orders'), [firestore]);
  const { data: orders = [], isLoading: ordersLoading } = useCollection<Order>(ordersQuery);
  const packagesQuery = useMemoFirebase(() => collection(firestore, 'packages'), [firestore]);
  const { data: allPackages = [] } = useCollection<any>(packagesQuery);
  const menuQuery = useMemoFirebase(() => collection(firestore, 'menu_items'), [firestore]);
  const { data: menu = [] } = useCollection<any>(menuQuery);

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
        const docSnap = snap.docs[0];
        const userData = { ...docSnap.data(), id: docSnap.id } as User;
        if (userData.role === 'delivery') {
          setCurrentUser(userData);
          setIsAuthorized(true);
          
          const savedOrder = localStorage.getItem(`bb_address_priority_${userData.id}`);
          if (savedOrder) {
            try {
              setCustomRouteOrder(JSON.parse(savedOrder));
            } catch (e) {
              console.error("Failed to parse saved route", e);
            }
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

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    const head = [['#', 'Order Details', 'Customer Hub', 'Package Info', 'Qty', 'Status']];
    const body = filteredOrders.map((o, idx) => [
      idx + 1,
      `ID: #${o.id.substr(0,8)}\nSlot: ${o.slot}\nTime: ${o.deliveryTime}`,
      `${o.customerName}\nAddr: ${o.address}\nTel: ${o.mobile}`,
      o.type === 'Subscription' 
        ? `${o.packageName || 'Subscription'} (Day ${(selectedDate || new Date()).getDate()})` 
        : (o.packageName || 'Custom Meal'),
      o.packageQuantity || 1,
      getOrderDateStatus(o, selectedDate || new Date())
    ]);
    downloadPDF('Daily Delivery Manifest', head, body, `daily_tasks_${currentUser?.bacchabiteId}`);
  };

  const handleGlobalSortChange = (value: string) => {
    const [field, direction] = value.split('-');
    setIsRouteOrder(field === 'route');
    setSortField(field === 'route' ? 'address' : field);
    setSortDirection(direction as 'asc' | 'desc');
  };

  const handleSort = (key: string) => {
    setIsRouteOrder(false);
    if (sortField === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(key);
      setSortDirection('asc');
    }
  };

  const SortTrigger = ({ label, sortKey, className }: { label: string, sortKey: string, className?: string }) => (
    <div 
      className={cn("flex items-center gap-1 cursor-pointer group select-none hover:text-white/80 transition-colors", className)}
      onClick={() => handleSort(sortKey)}
    >
      <span>{label}</span>
      {sortField === sortKey && !isRouteOrder ? (
        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-white" /> : <ChevronDown className="w-3 h-3 text-white" />
      ) : (
        <ArrowUpDown className="w-3 h-3 text-white/30 group-hover:text-white" />
      )}
    </div>
  );

  const getPackageItems = (order: Order, targetDate: Date = new Date()) => {
    if (!allPackages || !menu) return [];
    const pkg = allPackages.find((p: any) => p.name === order.packageName);
    if (pkg) {
      if (pkg.type === 'monthly') {
        if (pkg.monthlyAssignments) {
          const dateKey = format(targetDate, 'yyyy-MM-dd');
          const dayItems = pkg.monthlyAssignments[dateKey] || [];
          if (dayItems.length > 0) {
            return dayItems.map((id: string) => {
              const menuItem = menu.find((m: any) => m.id === id);
              return { name: menuItem?.name || "Unknown Item", type: menuItem?.type || "Veg", quantity: order.packageQuantity || 1, show: menuItem?.show };
            }).filter((item: any) => item.show !== false);
          }
          return [];
        }
        if (pkg.items && pkg.items.length > 0) {
          const dayOfMonth = targetDate.getDate();
          const idx = (dayOfMonth - 1) % pkg.items.length;
          const id = pkg.items[idx];
          const menuItem = menu.find((m: any) => m.id === id);
          if (menuItem && menuItem.show !== false) {
            return [{ name: menuItem.name || "Unknown Item", type: menuItem.type || "Veg", quantity: order.packageQuantity || 1 }];
          }
          return [];
        }
      } else if (pkg.items) {
        return pkg.items.map((id: string) => {
          const menuItem = menu.find((m: any) => m.id === id);
          return { name: menuItem?.name || "Unknown Item", type: menuItem?.type || "Veg", quantity: order.packageQuantity || 1, show: menuItem?.show };
        }).filter((item: any) => item.show !== false);
      }
    }
    return (order.items || []).filter((item: any) => {
      const menuItem = menu.find((m: any) => m.id === item.menuItemId || m.name === item.name);
      return !menuItem || menuItem.show !== false;
    });
  };

  const filteredOrders = useMemo(() => {
    if (!isAuthorized || !currentUser || !currentUser.id || !orders) return [];
    
    const filtered = orders.filter(o => {
      const isAssignedToMe = o.assignedTo === currentUser.id;
      
      const targetDate = selectedDate || new Date();
      let isCorrectDate = false;
      
      if (o.type === 'Subscription') {
        const pkg = allPackages.find(p => p.name === o.packageName);
        if (pkg && (pkg.type === 'monthly' || pkg.type === 'scheme')) {
          try {
            const targetMonthStr = format(targetDate, 'MMMM yyyy');
            const isMonthCorrect = pkg.dateContext === targetMonthStr;
            if (isMonthCorrect) {
              const assignments = pkg.type === 'monthly' ? pkg.monthlyAssignments : pkg.schemeAssignments;
              if (assignments) {
                const dateKey = pkg.type === 'monthly' ? format(targetDate, 'yyyy-MM-dd') : String(targetDate.getDate());
                const dayItems = assignments[dateKey] || [];
                isCorrectDate = dayItems.length > 0;
              } else {
                isCorrectDate = pkg.items && pkg.items.length > 0;
              }
            } else {
              isCorrectDate = false;
            }
          } catch (e) {
            console.error(e);
            isCorrectDate = false;
          }
        }
      } else {
        const orderDate = o.referenceDate ? parseISO(o.referenceDate) : (typeof o.createdAt === 'string' ? parseISO(o.createdAt) : o.createdAt);
        isCorrectDate = !selectedDate || isSameDay(orderDate, selectedDate);
      }
      
      if (!isAssignedToMe || !isCorrectDate) return false;

      const slotActive = activeFilters.morning || activeFilters.noon;
      const dietaryActive = activeFilters.veg || activeFilters.nonVeg;

      const slotMatch = !slotActive || 
                       (activeFilters.morning && o.slot === 'Morning') || 
                       (activeFilters.noon && o.slot === 'Noon');
      
      const orderItems = getPackageItems(o, targetDate);
      const dietaryMatch = !dietaryActive || 
                          (activeFilters.veg && orderItems.every((item: any) => item.type === 'Veg')) || 
                          (activeFilters.nonVeg && orderItems.some((item: any) => item.type === 'Non-Veg'));

      if (!slotMatch || !dietaryMatch) return false;

      const orderText = `${o.id} ${o.slot} ${o.deliveryTime}`.toLowerCase();
      const customerText = `${o.customerName} ${o.address} ${o.mobile}`.toLowerCase();
      const packageText = (o.packageName || '').toLowerCase();
      const statusText = getOrderDateStatus(o, targetDate).toLowerCase();
      const qtyText = (o.packageQuantity || 1).toString();

      return (
        orderText.includes(colFilters.order.toLowerCase()) &&
        customerText.includes(colFilters.customer.toLowerCase()) &&
        packageText.includes(colFilters.package.toLowerCase()) &&
        statusText.includes(colFilters.status.toLowerCase()) &&
        qtyText.includes(colFilters.qty.toLowerCase())
      );
    });

    return [...filtered].sort((a, b) => {
      // Priority 1: Custom Route Order
      if (isRouteOrder && customRouteOrder.length > 0) {
        const addrA = (a.address || '').trim();
        const addrB = (b.address || '').trim();
        const indexA = customRouteOrder.findIndex(addr => addr.trim() === addrA);
        const indexB = customRouteOrder.findIndex(addr => addr.trim() === addrB);
        if (indexA !== -1 && indexB !== -1) return sortDirection === 'asc' ? indexA - indexB : indexB - indexA;
        if (indexA !== -1) return sortDirection === 'asc' ? -1 : 1;
        if (indexB !== -1) return sortDirection === 'asc' ? 1 : -1;
        return addrA.localeCompare(addrB);
      }

      // Priority 2: Specialized Date sorting for createdAt
      if (sortField === 'createdAt') {
        const getT = (o: any) => {
          const d = o.createdAt;
          if (d instanceof Date) return d.getTime();
          if (typeof d === 'string') return parseISO(d).getTime();
          if (d && typeof d === 'object' && 'seconds' in d) return d.seconds * 1000;
          return 0;
        };
        const tA = getT(a);
        const tB = getT(b);
        return sortDirection === 'asc' ? tA - tB : tB - tA;
      }

      // Priority 3: Fallback generic sorting
      let valA: any = (a as any)[sortField];
      let valB: any = (b as any)[sortField];
      
      if (sortField === 'customer') { valA = a.customerName; valB = b.customerName; }
      if (valA === undefined) valA = '';
      if (valB === undefined) valB = '';
      
      if (valA instanceof Date && valB instanceof Date) {
        return sortDirection === 'asc' ? valA.getTime() - valB.getTime() : valB.getTime() - valA.getTime();
      }
      
      const strA = valA.toString();
      const strB = valB.toString();
      return sortDirection === 'asc' 
        ? strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' }) 
        : strB.localeCompare(strA, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [isAuthorized, currentUser, selectedDate, orders, colFilters, sortField, sortDirection, isRouteOrder, customRouteOrder, activeFilters, allPackages, menu]);

  const totalQuantity = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (o.packageQuantity || 1), 0);
  }, [filteredOrders]);

  const updateStatus = (orderId: string, newStatus: OrderStatus) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const orderRef = doc(firestore, 'orders', orderId);
    if (order.type === 'Subscription') {
      const dateKey = format(selectedDate || new Date(), 'yyyy-MM-dd');
      const updatedDailyStatuses = {
        ...(order.dailyStatuses || {}),
        [dateKey]: newStatus,
      };
      updateDocumentNonBlocking(orderRef, { dailyStatuses: updatedDailyStatuses });
    } else {
      updateDocumentNonBlocking(orderRef, { status: newStatus });
    }
    toast({ title: "Status Updated", description: `Order #${orderId} for ${format(selectedDate || new Date(), 'MMM dd, yyyy')} is now ${newStatus}.` });
  };

  const bulkUpdateStatus = (newStatus: OrderStatus) => {
    if (filteredOrders.length === 0) return;
    filteredOrders.forEach(o => {
      const orderRef = doc(firestore, 'orders', o.id);
      if (o.type === 'Subscription') {
        const dateKey = format(selectedDate || new Date(), 'yyyy-MM-dd');
        const updatedDailyStatuses = {
          ...(o.dailyStatuses || {}),
          [dateKey]: newStatus,
        };
        updateDocumentNonBlocking(orderRef, { dailyStatuses: updatedDailyStatuses });
      } else {
        updateDocumentNonBlocking(orderRef, { status: newStatus });
      }
    });
    toast({ title: "Bulk Update Applied", description: `All ${filteredOrders.length} filtered orders marked as ${newStatus}.` });
  };

  const handleFilterChange = (key: keyof typeof colFilters, val: string) => {
    setColFilters(prev => ({ ...prev, [key]: val }));
  };

  const toggleFilter = (key: keyof typeof activeFilters) => {
    setActiveFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const clearFilters = () => {
    setColFilters({ order: '', customer: '', package: '', status: '', qty: '' });
    setActiveFilters({ morning: false, noon: false, veg: false, nonVeg: false });
    setSelectedDate(undefined);
    setSortField('createdAt');
    setSortDirection('desc');
    setIsRouteOrder(false);
  };

  const openOrderDetails = (order: Order) => {
    setSelectedOrderForDetails(order);
    setIsDetailsOpen(true);
  };

  if (!isAuthorized || !currentUser) return null;

  return (
    <div className="pb-24 md:pb-0 md:pt-16 min-h-screen bg-blue-50/30">
      <Navbar role="delivery" />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6 print:mb-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-headline font-bold text-blue-600">Tasks Today</h1>
              <p className="text-muted-foreground">Managing your assigned delivery registry from Cloud Firestore.</p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              {(Object.values(colFilters).some(v => v !== '') || Object.values(activeFilters).some(v => v) || selectedDate) && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="rounded-full h-8 px-3 text-blue-600 hover:bg-blue-100 font-bold text-[10px] uppercase tracking-wider">
                  <FilterX className="w-3.5 h-3.5 mr-1.5" /> Clear Filters
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-full h-10 px-4 bg-white border-blue-100 text-blue-600 font-bold gap-2">
                <Printer className="w-4 h-4" /> Print
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-full h-10 px-4 bg-white border-blue-100 text-blue-600 font-bold gap-2">
                <FileDown className="w-4 h-4" /> Export PDF
              </Button>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 print:hidden">
            <div className="flex bg-white/50 p-1 rounded-2xl gap-1 border border-blue-100/50">
              <Button 
                size="sm" 
                variant={activeFilters.morning ? "default" : "ghost"} 
                className={cn("rounded-xl h-9 px-4 font-bold transition-all text-[10px] uppercase", activeFilters.morning ? "bg-blue-600 text-white shadow-md" : "text-blue-600")}
                onClick={() => toggleFilter('morning')}
              >
                Morning Slot
              </Button>
              <Button 
                size="sm" 
                variant={activeFilters.noon ? "default" : "ghost"} 
                className={cn("rounded-xl h-9 px-4 font-bold transition-all text-[10px] uppercase", activeFilters.noon ? "bg-blue-600 text-white shadow-md" : "text-blue-600")}
                onClick={() => toggleFilter('noon')}
              >
                Noon Slot
              </Button>
            </div>

            <div className="flex bg-white/50 p-1 rounded-2xl gap-1 border border-blue-100/50">
              <Button 
                size="sm" 
                variant={activeFilters.veg ? "default" : "ghost"} 
                className={cn("rounded-xl h-9 px-4 font-bold transition-all text-[10px] uppercase", activeFilters.veg ? "bg-blue-600 text-white shadow-md" : "text-blue-600")}
                onClick={() => toggleFilter('veg')}
              >
                Veg Only
              </Button>
              <Button 
                size="sm" 
                variant={activeFilters.nonVeg ? "default" : "ghost"} 
                className={cn("rounded-xl h-9 px-4 font-bold transition-all text-[10px] uppercase", activeFilters.nonVeg ? "bg-blue-600 text-white shadow-md" : "text-blue-600")}
                onClick={() => toggleFilter('nonVeg')}
              >
                Non-Veg Only
              </Button>
            </div>

            <div className="flex flex-col gap-1.5">
              <Select value={`${isRouteOrder ? 'route' : sortField}-${sortDirection}`} onValueChange={handleGlobalSortChange}>
                <SelectTrigger className="w-full sm:w-[220px] h-12 rounded-2xl bg-white border-blue-100 shadow-sm px-4 font-bold">
                  <div className="flex items-center gap-2">
                    <SortIcon className="w-4 h-4 text-blue-600" />
                    <SelectValue placeholder="Sort Order" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-xl">
                  <SelectItem value="createdAt-desc">Date (Newest First)</SelectItem>
                  <SelectItem value="createdAt-asc">Date (Oldest First)</SelectItem>
                  <SelectItem value="id-asc">Order Number (Low-High)</SelectItem>
                  <SelectItem value="id-desc">Order Number (High-Low)</SelectItem>
                  <SelectItem value="customerName-asc">Customer Name (A-Z)</SelectItem>
                  <SelectItem value="customerName-desc">Customer Name (Z-A)</SelectItem>
                  <SelectItem value="slot-asc">Slot (Morning First)</SelectItem>
                  <SelectItem value="deliveryTime-asc">Delivery Time (Soonest)</SelectItem>
                  <SelectItem value="address-asc">Address (Alphabetical)</SelectItem>
                  <SelectItem value="route-asc">Address (Route Order)</SelectItem>
                  <SelectItem value="mobile-asc">Phone Number</SelectItem>
                  <SelectItem value="packageName-asc">Package Name (A-Z)</SelectItem>
                  <SelectItem value="type-asc">Package Type (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-[200px] h-12 justify-start text-left font-bold rounded-2xl bg-white border-blue-100 shadow-sm px-4">
                  <CalendarIcon className="mr-2 h-4 w-4 text-blue-600" />
                  {mounted && selectedDate ? format(selectedDate, "MMM dd, yyyy") : <span>All Dates</span>}
                  <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-3xl border-none shadow-2xl" align="end">
                <Calendar mode="single" selected={selectedDate} onSelect={(date) => {
                  setSelectedDate(date);
                  setIsDatePickerOpen(false);
                }} initialFocus className="rounded-3xl" />
              </PopoverContent>
            </Popover>
          </div>
        </header>

        <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white print:shadow-none print:rounded-none">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-blue-600 hover:bg-blue-600 border-none">
                  <TableHead className="text-white font-bold py-5 pl-8 uppercase text-[10px] tracking-widest w-[50px]">#</TableHead>
                  <TableHead className="text-white font-bold py-5 uppercase text-[10px] tracking-widest min-w-[180px]">
                    <div className="flex flex-col gap-1">
                      <SortTrigger label="Order Info" sortKey="id" />
                      <ColumnFilter placeholder="Search ID/Slot..." value={colFilters.order} onChange={(v) => handleFilterChange('order', v)} />
                    </div>
                  </TableHead>
                  <TableHead className="text-white font-bold uppercase text-[10px] tracking-widest min-w-[220px]">
                    <div className="flex flex-col gap-1">
                      <SortTrigger label="Customer Hub" sortKey="customerName" />
                      <ColumnFilter placeholder="Search Name/Addr..." value={colFilters.customer} onChange={(v) => handleFilterChange('customer', v)} />
                    </div>
                  </TableHead>
                  <TableHead className="text-white font-bold uppercase text-[10px] tracking-widest min-w-[200px]">
                    <div className="flex flex-col gap-1">
                      <SortTrigger label="Package Details" sortKey="packageName" />
                      <ColumnFilter placeholder="Search Package..." value={colFilters.package} onChange={(v) => handleFilterChange('package', v)} />
                    </div>
                  </TableHead>
                  <TableHead className="text-white font-bold uppercase text-[10px] tracking-widest text-center min-w-[60px]">
                    <div className="flex flex-col items-center gap-1">
                      <SortTrigger label="Qty" sortKey="packageQuantity" className="justify-center" />
                      <ColumnFilter placeholder="Qty..." value={colFilters.qty} onChange={(v) => handleFilterChange('qty', v)} />
                    </div>
                  </TableHead>
                  <TableHead className="text-white font-bold uppercase text-[10px] tracking-widest text-center min-w-[80px] print:hidden">
                    <div className="flex flex-col items-center gap-2"><span>Cancel</span><StatusRadio active={false} isHeader onClick={() => bulkUpdateStatus('Cancelled')} activeColor="bg-red-500" /></div>
                  </TableHead>
                  <TableHead className="text-white font-bold uppercase text-[10px] tracking-widest text-center min-w-[80px] print:hidden">
                    <div className="flex flex-col items-center gap-2"><span>To Pickup</span><StatusRadio active={false} isHeader onClick={() => bulkUpdateStatus('Assigned')} activeColor="bg-blue-500" /></div>
                  </TableHead>
                  <TableHead className="text-white font-bold uppercase text-[10px] tracking-widest text-center min-w-[80px] print:hidden">
                    <div className="flex flex-col items-center gap-2"><span>Picked Up</span><StatusRadio active={false} isHeader onClick={() => bulkUpdateStatus('Picked Up')} activeColor="bg-orange-500" /></div>
                  </TableHead>
                  <TableHead className="text-white font-bold uppercase text-[10px] tracking-widest text-center min-w-[80px] print:hidden">
                    <div className="flex flex-col items-center gap-2"><span>To Delivery</span><StatusRadio active={false} isHeader onClick={() => bulkUpdateStatus('Out for Delivery')} activeColor="bg-amber-500" /></div>
                  </TableHead>
                  <TableHead className="text-white font-bold uppercase text-[10px] tracking-widest text-center pr-8 min-w-[80px]">
                    <div className="flex flex-col items-center gap-2"><span>Delivered</span><div className="print:hidden"><StatusRadio active={false} isHeader onClick={() => bulkUpdateStatus('Delivered')} activeColor="bg-green-500" /></div></div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-64 text-center">
                      <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-600" />
                      <p className="mt-2 text-sm font-bold text-muted-foreground">Loading tasks...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredOrders.length > 0 ? (
                  filteredOrders.map((order, idx) => (
                    <TableRow key={order.id} className="hover:bg-blue-50/30 border-b border-blue-50 transition-colors cursor-pointer group" onClick={() => openOrderDetails(order)}>
                      <TableCell className="py-6 pl-8 font-black text-blue-600/40 text-xs align-top">{idx + 1}</TableCell>
                      <TableCell className="py-6 align-top">
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter bg-blue-50 px-2 py-0.5 rounded">#{order.id.substr(0,8)}</span>
                          <div className="flex items-center gap-2 mt-2">
                            <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
                            <span className="text-xs font-black text-slate-900">
                              {order.type === 'Subscription' 
                                ? format(selectedDate || new Date(), 'MMMM d, yyyy')
                                : order.packageName 
                                  ? (allPackages.find(p => p.name === order.packageName)?.dateContext || 'Meal Date') 
                                  : 'Custom Date'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-blue-600" />
                            <span className="text-xs font-bold text-slate-700">{order.slot} • {order.deliveryTime}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top py-6">
                        <div className="space-y-3">
                          <p className="font-black text-lg text-accent leading-none group-hover:text-primary transition-colors">{order.customerName}</p>
                          <div className="flex items-start gap-2 max-w-[200px]"><MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" /><p className="text-[11px] font-medium leading-relaxed text-muted-foreground">{order.address}</p></div>
                          <div className="flex items-center gap-4 print:hidden">
                            <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-[11px] font-bold">{order.mobile}</span></div>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); window.open(`tel:${order.mobile}`); }} className="h-7 px-2 rounded-lg text-blue-600 hover:bg-blue-50 hover:text-blue-700 font-bold text-[10px] border border-blue-100"><Phone className="w-3 h-3 mr-1" /> Call</Button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top py-6">
                        <div className="space-y-3">
                          <Badge variant="outline" className="bg-slate-50 text-[10px] font-black border-slate-200 h-6 text-slate-700 uppercase flex items-center gap-1 px-3 w-fit">
                            <Package className="w-3 h-3" />
                            {order.type === 'Subscription' 
                              ? `${order.packageName || "Subscription"} (Day ${(selectedDate || new Date()).getDate()})` 
                              : (order.packageName || "Custom")}
                          </Badge>
                          <div className="space-y-1.5">
                            {getPackageItems(order, selectedDate || new Date()).map((item: any, i: number) => (
                              <div key={i} className="flex items-center gap-2">{item.type === 'Veg' ? <Leaf className="w-3 h-3 text-green-500" /> : <Flame className="w-3 h-3 text-red-500" />}<span className="text-[11px] font-bold text-slate-600">{item.quantity}x {item.name}</span></div>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center align-top py-6">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-black text-blue-600 shadow-sm">
                            {order.packageQuantity || 1}
                          </div>
                          <span className="text-[8px] font-black uppercase text-blue-600/60 tracking-tighter">Sets</span>
                        </div>
                      </TableCell>
                      {(() => {
                        const currentStatus = getOrderDateStatus(order, selectedDate || new Date());
                        return (
                          <>
                            <TableCell className="text-center align-top py-8 print:hidden"><StatusRadio active={currentStatus === 'Cancelled'} onClick={() => updateStatus(order.id, 'Cancelled')} activeColor="bg-red-500 border-red-500" /></TableCell>
                            <TableCell className="text-center align-top py-8 print:hidden"><StatusRadio active={currentStatus === 'Assigned'} onClick={() => updateStatus(order.id, 'Assigned')} activeColor="bg-blue-500 border-blue-500" /></TableCell>
                            <TableCell className="text-center align-top py-8 print:hidden"><StatusRadio active={currentStatus === 'Picked Up'} onClick={() => updateStatus(order.id, 'Picked Up')} activeColor="bg-orange-500 border-orange-500" /></TableCell>
                            <TableCell className="text-center align-top py-8 print:hidden"><StatusRadio active={currentStatus === 'Out for Delivery'} onClick={() => updateStatus(order.id, 'Out for Delivery')} activeColor="bg-amber-500 border-amber-500" /></TableCell>
                            <TableCell className="text-center align-top py-8 pr-8">
                              <div className="print:hidden">
                                <StatusRadio active={currentStatus === 'Delivered'} onClick={() => updateStatus(order.id, 'Delivered')} activeColor="bg-green-500 border-green-500" />
                              </div>
                              <div className="hidden print:block text-[10px] font-bold uppercase">{currentStatus}</div>
                            </TableCell>
                          </>
                        );
                      })()}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="h-96 text-center">
                      <div className="flex flex-col items-center justify-center space-y-4 opacity-40"><div className="p-6 bg-blue-50 rounded-full"><Package className="w-16 h-16 text-blue-600" /></div><div><p className="text-xl font-bold text-slate-900">No tasks found</p></div></div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="rounded-[2.5rem] max-w-2xl overflow-hidden p-0 border-none shadow-2xl">
            {selectedOrderForDetails && (
              <>
                <DialogHeader className="bg-blue-600 p-8 text-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <Badge variant="outline" className="bg-white/10 text-white border-white/20 uppercase font-black text-[10px] tracking-widest mb-2">Order Summary</Badge>
                      <DialogTitle className="text-3xl font-headline font-bold leading-none">#{selectedOrderForDetails.id}</DialogTitle>
                    </div>
                    <Badge className="bg-white text-blue-600 border-none font-black text-[10px] rounded-lg">
                      {getOrderDateStatus(selectedOrderForDetails, selectedDate || new Date())}
                    </Badge>
                  </div>
                </DialogHeader>
                <div className="p-8 bg-white space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Customer Hub</Label>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="font-black text-slate-900">{selectedOrderForDetails.customerName}</p>
                        <p className="text-xs font-bold text-blue-600 mt-1">{selectedOrderForDetails.mobile}</p>
                        <p className="text-xs text-muted-foreground mt-2">{selectedOrderForDetails.address}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Task Details</Label>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-xs font-bold">{selectedOrderForDetails.slot} • {selectedOrderForDetails.deliveryTime}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Package: {selectedOrderForDetails.type === 'Subscription' 
                            ? `${selectedOrderForDetails.packageName || "Subscription"} (Day ${(selectedDate || new Date()).getDate()})` 
                            : (selectedOrderForDetails.packageName || "Custom")}
                        </p>
                        <p className="font-black text-blue-600 mt-2">{selectedOrderForDetails.packageQuantity || 1} Sets</p>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter className="bg-slate-50 p-6 flex justify-center">
                  <Button onClick={() => setIsDetailsOpen(false)} className="bg-slate-900 text-white rounded-xl px-10 font-bold">Close Details</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

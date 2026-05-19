
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Order, OrderStatus, User, TimeSlot } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { 
  Package, 
  Clock, 
  CheckCircle, 
  PlusCircle, 
  Eye, 
  Truck, 
  XCircle, 
  CheckCircle2,
  MapPin,
  Phone,
  User as UserIcon,
  Calendar as CalendarIcon,
  Edit,
  Tag,
  FilterX,
  ChevronDown,
  RefreshCcw,
  Wallet,
  Archive,
  CreditCard,
  ArrowUpDown,
  ChevronUp,
  Loader2,
  UserCheck,
  Search,
  Printer,
  FileDown,
  CalendarDays
} from 'lucide-react';
import { format, isSameDay, parseISO, isValid } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { downloadPDF } from '@/lib/pdf-export';

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

const ColumnFilter = ({ placeholder, value, onChange }: { placeholder: string, value: string, onChange: (v: string) => void }) => (
  <div className="relative mt-2 print:hidden" onClick={(e) => e.stopPropagation()}>
    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
    <Input 
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 pl-7 pr-2 text-[10px] bg-secondary/30 border-none placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/30 rounded-lg font-normal normal-case tracking-normal"
    />
  </div>
);

export default function AdminDashboard() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();

  const ordersQuery = useMemoFirebase(() => collection(firestore, 'orders'), [firestore]);
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const purchasesQuery = useMemoFirebase(() => collection(firestore, 'purchases'), [firestore]);
  const paymentsQuery = useMemoFirebase(() => collection(firestore, 'payments'), [firestore]);
  const packagesQuery = useMemoFirebase(() => collection(firestore, 'packages'), [firestore]);

  const { data: orders = [], isLoading: ordersLoading } = useCollection<Order>(ordersQuery);
  const { data: users = [], isLoading: usersLoading } = useCollection<User>(usersQuery);
  const { data: purchases = [] } = useCollection<any>(purchasesQuery);
  const { data: payments = [] } = useCollection<any>(paymentsQuery);
  const { data: allPackages = [] } = useCollection<any>(packagesQuery);

  const [activeFilters, setActiveFilters] = useState({
    morning: false,
    noon: false,
    veg: false,
    nonVeg: false
  });
  
  const [columnFilters, setColFilters] = useState({
    date: '',
    customer: '',
    package: '',
    qty: '',
    slot: '',
    status: ''
  });

  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [statsDate, setStatsDate] = useState<Date | undefined>(undefined);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: 'createdAt', direction: 'desc' });

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const deliveryBoys = useMemo(() => (users || []).filter(u => u.role === 'delivery'), [users]);

  const statsOrders = useMemo(() => {
    const safeOrders = orders || [];
    if (!statsDate) return safeOrders;
    return safeOrders.filter(o => {
      const d = parseDateSafe(o.createdAt);
      return isSameDay(d, statsDate);
    });
  }, [orders, statsDate]);

  const pendingReceivable = useMemo(() => {
    const safeOrders = orders || [];
    return safeOrders.filter(o => o.status === 'Delivered' && o.paymentStatus !== 'paid').reduce((sum, o) => sum + o.total, 0);
  }, [orders]);

  const pendingPayable = useMemo(() => {
    const totalPurchases = (purchases || []).reduce((sum, p) => sum + p.totalAmount, 0);
    const totalPayments = (payments || []).reduce((sum, p) => sum + p.amount, 0);
    return Math.max(0, totalPurchases - totalPayments);
  }, [purchases, payments]);

  const stats = useMemo(() => [
    { label: statsDate ? 'Day Total Orders' : 'Total Orders', value: statsOrders.length.toString(), icon: Package, color: 'text-primary' },
    { label: statsDate ? 'Day Pending' : 'Pending', value: statsOrders.filter(o => o.status === 'Pending').length.toString(), icon: Clock, color: 'text-yellow-500' },
    { label: statsDate ? 'Day Delivered' : 'Delivered', value: statsOrders.filter(o => o.status === 'Delivered').length.toString(), icon: CheckCircle, color: 'text-green-500' },
    { label: 'Pending Receivable', value: `${pendingReceivable}`, icon: Wallet, color: 'text-blue-500' },
    { label: 'Closing Stock (Val)', value: '12,450', icon: Archive, color: 'text-orange-500' },
    { label: 'Pending Payable', value: `${pendingPayable}`, icon: CreditCard, color: 'text-red-500' },
  ], [statsOrders, statsDate, pendingReceivable, pendingPayable]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredOrders = useMemo(() => {
    const safeOrders = orders || [];
    const data = safeOrders.filter(order => {
      const orderDate = parseDateSafe(order.createdAt);
      
      if (filterDate && !isSameDay(orderDate, filterDate)) {
        return false;
      }

      const slotActive = activeFilters.morning || activeFilters.noon;
      const dietaryActive = activeFilters.veg || activeFilters.nonVeg;

      const slotMatch = !slotActive || 
                       (activeFilters.morning && order.slot === 'Morning') || 
                       (activeFilters.noon && order.slot === 'Noon');
      
      let dietaryMatch = true;
      if (dietaryActive) {
        const orderItems = order.items || [];
        const isVegOnly = orderItems.length > 0 && orderItems.every(item => item.type === 'Veg');
        const isNonVeg = orderItems.some(item => item.type === 'Non-Veg');

        if (activeFilters.veg && activeFilters.nonVeg) {
          dietaryMatch = isVegOnly || isNonVeg;
        } else if (activeFilters.veg) {
          dietaryMatch = isVegOnly;
        } else if (activeFilters.nonVeg) {
          dietaryMatch = isNonVeg;
        }
      }

      if (!slotMatch || !dietaryMatch) return false;

      const dateStr = format(orderDate, 'MMM dd, yyyy').toLowerCase();
      const customerStr = `${order.customerName} ${order.mobile}`.toLowerCase();
      const packageStr = (order.packageName || '').toLowerCase();
      const qtyStr = (order.packageQuantity || 1).toString();
      const slotStr = `${order.slot} ${order.deliveryTime}`.toLowerCase();
      const statusStr = order.status.toLowerCase();

      return (
        dateStr.includes(columnFilters.date.toLowerCase()) &&
        customerStr.includes(columnFilters.customer.toLowerCase()) &&
        packageStr.includes(columnFilters.package.toLowerCase()) &&
        qtyStr.includes(columnFilters.qty.toLowerCase()) &&
        slotStr.includes(columnFilters.slot.toLowerCase()) &&
        statusStr.includes(columnFilters.status.toLowerCase())
      );
    });

    if (sortConfig.key && sortConfig.direction) {
      data.sort((a, b) => {
        let valA = (a as any)[sortConfig.key];
        let valB = (b as any)[sortConfig.key];
        if (valA === undefined) valA = '';
        if (valB === undefined) valB = '';
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [orders, activeFilters, filterDate, sortConfig, columnFilters]);

  const totalFilteredQty = useMemo(() => {
    return (filteredOrders || []).reduce((sum, order) => sum + (order.packageQuantity || 1), 0);
  }, [filteredOrders]);

  const totalFilteredAmount = useMemo(() => {
    return (filteredOrders || []).reduce((sum, order) => sum + order.total, 0);
  }, [filteredOrders]);

  const handleStatusUpdate = (orderId: string, newStatus: OrderStatus) => {
    const safeOrders = orders || [];
    const orderToUpdate = safeOrders.find(o => o.id === orderId);
    if (!orderToUpdate) return;

    if (newStatus === 'Assigned') {
      setSelectedOrder(orderToUpdate);
      setIsAssignOpen(true);
      return;
    }

    const orderRef = doc(firestore, 'orders', orderId);
    const update: any = { status: newStatus };
    if (newStatus === 'Pending') update.assignedTo = null;
    
    updateDocumentNonBlocking(orderRef, update);

    toast({
      title: "Status Updated",
      description: `Order #${orderId} is now marked as ${newStatus}.`,
    });
  };

  const handleAssignDelivery = (deliveryBoy: User) => {
    if (!selectedOrder) return;
    const orderRef = doc(firestore, 'orders', selectedOrder.id);
    updateDocumentNonBlocking(orderRef, { status: 'Assigned', assignedTo: deliveryBoy.id });
    
    toast({
      title: "Delivery Assigned",
      description: `Order #${selectedOrder.id} assigned to ${deliveryBoy.firstName}.`,
    });
    setIsAssignOpen(false);
  };

  const openDetails = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailsOpen(true);
  };

  const toggleFilter = (key: keyof typeof activeFilters) => {
    setActiveFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleColFilterChange = (key: keyof typeof columnFilters, val: string) => {
    setColFilters(prev => ({ ...prev, [key]: val }));
  };

  const resetFilters = () => {
    setActiveFilters({ morning: false, noon: false, veg: false, nonVeg: false });
    setColFilters({ date: '', customer: '', package: '', qty: '', slot: '', status: '' });
    setFilterDate(undefined);
    setSortConfig({ key: 'createdAt', direction: 'desc' });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    const head = [['Order Date / Time', 'Customer', 'Package', 'Qty', 'Slot', 'Total', 'Status']];
    const body = filteredOrders.map(o => {
      const d = o.referenceDate ? parseISO(o.referenceDate) : parseDateSafe(o.createdAt);
      return [
        format(d, 'MMM dd, yyyy hh:mm a'),
        o.customerName,
        o.packageName || 'Custom',
        o.packageQuantity || 1,
        `${o.slot} (${o.deliveryTime})`,
        o.total,
        o.status
      ];
    });
    downloadPDF('Dashboard Orders Summary Report', head, body, 'dashboard_orders');
  };

  const isAnyFilterActive = Object.values(activeFilters).some(v => v) || 
                           filterDate !== undefined || 
                           Object.values(columnFilters).some(v => v !== '');

  const SortTrigger = ({ label, sortKey, className }: { label: string, sortKey: string, className?: string }) => (
    <div 
      className={cn("flex items-center gap-1 cursor-pointer group select-none hover:text-primary transition-colors", className)}
      onClick={() => handleSort(sortKey)}
    >
      <span>{label}</span>
      {sortConfig.key === sortKey ? (
        sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
      ) : (
        <ArrowUpDown className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary transition-colors" />
      )}
    </div>
  );

  const StatusActionIcon = ({ 
    label, 
    active, 
    icon: Icon, 
    activeClass, 
    onClick, 
    disabled 
  }: { 
    label: string, 
    active: boolean, 
    icon: any, 
    activeClass: string, 
    onClick: () => void,
    disabled?: boolean
  }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg transition-all border-2",
              active 
                ? cn("shadow-sm", activeClass) 
                : "border-transparent bg-secondary/20 text-muted-foreground/40 hover:bg-secondary/50 hover:text-muted-foreground",
              disabled && "opacity-40 cursor-not-allowed bg-secondary/20 border-secondary/10"
            )}
          >
            <Icon className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="rounded-lg font-bold text-[10px] uppercase">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Admin Console</h1>
          <p className="text-muted-foreground mt-1">Manage your BacchaBite business with live Cloud Firestore data.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl font-bold bg-white gap-2">
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl font-bold bg-white gap-2">
            <FileDown className="w-4 h-4" /> Export PDF
          </Button>
          <Button 
            onClick={() => router.push('/admin/orders/new')}
            className="bg-accent hover:bg-accent/90 text-white rounded-2xl h-12 px-6 font-bold shadow-lg shadow-accent/20"
          >
            <PlusCircle className="w-5 h-5 mr-2" />
            New Offline Order
          </Button>
        </div>
      </header>

      <Card className="rounded-3xl border-none shadow-sm overflow-hidden bg-white mb-8 print:shadow-none print:rounded-none">
        <CardHeader className="p-6 pb-4">
          <div className="flex items-center justify-between mb-6">
            <CardTitle className="text-xl font-bold">Recent Orders</CardTitle>
            <Button variant="outline" size="sm" className="rounded-xl print:hidden" onClick={resetFilters}>View All</Button>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <div className="bg-secondary/30 p-1 rounded-2xl">
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={cn(
                      "h-9 px-4 rounded-xl font-bold transition-all gap-2",
                      filterDate ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-primary"
                    )}
                  >
                    <CalendarIcon className="w-4 h-4" />
                    {mounted && filterDate ? format(filterDate, 'MMM dd, yyyy') : "All Dates"}
                    <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-3xl border-none shadow-2xl" align="start">
                  <Calendar
                    mode="single"
                    selected={filterDate}
                    onSelect={setFilterDate}
                    initialFocus
                    className="rounded-3xl"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex bg-secondary/30 p-1 rounded-2xl gap-1">
              <Button 
                size="sm" 
                variant={activeFilters.morning ? "default" : "ghost"} 
                className={cn("rounded-xl h-9 px-4 font-bold transition-all", activeFilters.morning && "shadow-md")}
                onClick={() => toggleFilter('morning')}
              >
                Morning Slot
              </Button>
              <Button 
                size="sm" 
                variant={activeFilters.noon ? "default" : "ghost"} 
                className={cn("rounded-xl h-9 px-4 font-bold transition-all", activeFilters.noon && "shadow-md")}
                onClick={() => toggleFilter('noon')}
              >
                Noon Slot
              </Button>
            </div>

            <div className="flex bg-secondary/30 p-1 rounded-2xl gap-1">
              <Button 
                size="sm" 
                variant={activeFilters.veg ? "default" : "ghost"} 
                className={cn("rounded-xl h-9 px-4 font-bold transition-all", activeFilters.veg && "shadow-md")}
                onClick={() => toggleFilter('veg')}
              >
                Veg Only
              </Button>
              <Button 
                size="sm" 
                variant={activeFilters.nonVeg ? "default" : "ghost"} 
                className={cn("rounded-xl h-9 px-4 font-bold transition-all", activeFilters.nonVeg && "shadow-md")}
                onClick={() => toggleFilter('nonVeg')}
              >
                Non-Veg Only
              </Button>
            </div>

            {isAnyFilterActive && (
              <Button 
                size="sm" 
                variant="ghost" 
                className="rounded-xl h-9 px-3 text-muted-foreground hover:text-destructive font-bold"
                onClick={resetFilters}
              >
                <FilterX className="w-4 h-4 mr-1.5" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-secondary/20 border-none">
                <TableHead className="font-bold py-4">
                  <SortTrigger label="Order Given / Ref Date" sortKey="createdAt" />
                  <ColumnFilter placeholder="Filter date..." value={columnFilters.date} onChange={(v) => handleColFilterChange('date', v)} />
                </TableHead>
                <TableHead className="font-bold">
                  <SortTrigger label="Customer / Rider" sortKey="customerName" />
                  <ColumnFilter placeholder="Filter customer..." value={columnFilters.customer} onChange={(v) => handleColFilterChange('customer', v)} />
                </TableHead>
                <TableHead className="font-bold">
                  <SortTrigger label="Package" sortKey="packageName" />
                  <ColumnFilter placeholder="Filter package..." value={columnFilters.package} onChange={(v) => handleColFilterChange('package', v)} />
                </TableHead>
                <TableHead className="font-bold text-center">
                  <SortTrigger label="Qty" sortKey="packageQuantity" className="justify-center" />
                  <ColumnFilter placeholder="Qty" value={columnFilters.qty} onChange={(v) => handleColFilterChange('qty', v)} />
                </TableHead>
                <TableHead className="font-bold">
                  <SortTrigger label="Slot / Time" sortKey="slot" />
                  <ColumnFilter placeholder="Filter slot..." value={columnFilters.slot} onChange={(v) => handleColFilterChange('slot', v)} />
                </TableHead>
                <TableHead className="font-bold min-w-[120px] print:hidden">
                  <span>Status Management</span>
                  <ColumnFilter placeholder="Filter status..." value={columnFilters.status} onChange={(v) => handleColFilterChange('status', v)} />
                </TableHead>
                <TableHead className="font-bold text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => {
                  const safeUsers = users || [];
                  const assignedRider = order.assignedTo ? safeUsers.find(u => u.id === order.assignedTo) : null;
                  const orderDate = order.referenceDate ? parseISO(order.referenceDate) : parseDateSafe(order.createdAt);
                  
                  return (
                    <TableRow key={order.id} className="hover:bg-secondary/10 border-b border-secondary/20 last:border-none group">
                      <TableCell className="py-4">
                        <div className="font-bold text-sm">
                          {mounted ? format(orderDate, 'MMM dd, yyyy') : '...'}
                        </div>
                        <div className="text-[10px] text-primary font-black uppercase tracking-tighter mt-0.5">
                          {mounted ? format(orderDate, 'hh:mm a') : '...'}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="font-bold">{order.customerName}</div>
                        <div className="text-xs text-muted-foreground">{order.mobile}</div>
                        {assignedRider && (
                          <div className="mt-1 flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md w-fit border border-blue-100">
                            <Truck className="w-3 h-3" />
                            <span className="text-[10px] font-black uppercase tracking-tight">Rider: {assignedRider.firstName}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-sm text-accent">
                          {order.packageName || "Custom Selection"}
                        </div>
                        <div className="flex flex-col gap-0.5 mt-1">
                          <div className="text-[9px] font-black uppercase text-muted-foreground/60 flex items-center gap-1">
                            <CalendarDays className="w-2.5 h-2.5" />
                            {order.packageName ? (allPackages.find(p => p.name === order.packageName)?.dateContext || 'Meal Date') : 'Custom Date'}
                          </div>
                          <div className="text-[9px] text-muted-foreground font-medium italic">
                            {(order.items || []).length} items included
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-black text-primary">
                        {order.packageQuantity || 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black uppercase text-muted-foreground/70 bg-secondary px-1.5 py-0.5 rounded leading-none">
                              {order.type}
                            </span>
                            <Badge variant="outline" className="rounded-lg font-medium border-secondary py-0 h-5">
                              {order.slot}
                            </Badge>
                          </div>
                          <div className="text-[10px] text-muted-foreground">{order.deliveryTime}</div>
                        </div>
                      </TableCell>
                      <TableCell className="print:hidden">
                        <div className="grid grid-cols-3 gap-1 w-fit">
                          <StatusActionIcon 
                            label="Pending" 
                            active={order.status === 'Pending'} 
                            icon={Clock} 
                            activeClass="bg-yellow-50 text-yellow-600 border-yellow-200" 
                            onClick={() => handleStatusUpdate(order.id, 'Pending')} 
                          />
                          <StatusActionIcon 
                            label="Assigned" 
                            active={order.status === 'Assigned'} 
                            icon={UserCheck} 
                            activeClass="bg-blue-50 text-blue-600 border-blue-200" 
                            onClick={() => handleStatusUpdate(order.id, 'Assigned')} 
                          />
                          <StatusActionIcon 
                            label="Picked Up" 
                            active={order.status === 'Picked Up'} 
                            icon={Package} 
                            activeClass="bg-orange-50 text-orange-600 border-orange-200" 
                            onClick={() => handleStatusUpdate(order.id, 'Picked Up')}
                            disabled={order.status === 'Pending'}
                          />
                          <StatusActionIcon 
                            label="To Deliver" 
                            active={order.status === 'Out for Delivery'} 
                            icon={Truck} 
                            activeClass="bg-purple-50 text-purple-600 border-purple-200" 
                            onClick={() => handleStatusUpdate(order.id, 'Out for Delivery')}
                            disabled={order.status === 'Pending'}
                          />
                          <StatusActionIcon 
                            label="Completed" 
                            active={order.status === 'Delivered'} 
                            icon={CheckCircle2} 
                            activeClass="bg-green-50 text-green-600 border-green-200" 
                            onClick={() => handleStatusUpdate(order.id, 'Delivered')}
                            disabled={order.status === 'Pending'}
                          />
                          <StatusActionIcon 
                            label="Cancelled" 
                            active={order.status === 'Cancelled'} 
                            icon={XCircle} 
                            activeClass="bg-red-50 text-red-600 border-red-200" 
                            onClick={() => handleStatusUpdate(order.id, 'Cancelled')} 
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1 print:hidden">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/5"
                                  onClick={() => openDetails(order)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>View Details</p></TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-accent hover:bg-accent/5"
                                  onClick={() => router.push(`/admin/orders/edit/${order.id}`)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Full Edit Page</p></TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
                                  onClick={() => handleStatusUpdate(order.id, 'Assigned')}
                                  disabled={order.status === 'Delivered' || order.status === 'Cancelled'}
                                >
                                  <UserCheck className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Assign Rider</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="hidden print:block text-[10px] font-bold uppercase">{order.status}</div>
                      </TableCell>
                    </TableRow>
                  )
                }
              )) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2 opacity-40">
                      {ordersLoading ? <Loader2 className="w-10 h-10 animate-spin" /> : <FilterX className="w-10 h-10" />}
                      <p className="font-bold">{ordersLoading ? "Loading orders..." : "No orders match these filters."}</p>
                      {!ordersLoading && <Button variant="link" size="sm" onClick={resetFilters} className="font-bold text-primary">Clear all filters</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter className="bg-secondary/10 border-t-2 border-secondary/30">
              <TableRow>
                <TableCell colSpan={3} className="text-right font-bold py-5">Summary Totals:</TableCell>
                <TableCell className="text-center font-black text-xl text-primary">{totalFilteredQty} Sets</TableCell>
                <TableCell colSpan={4} className="font-black text-2xl text-accent pl-8">{totalFilteredAmount.toFixed(2)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <section className="mt-12 space-y-6 print:hidden">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/50 p-4 rounded-[2rem] border border-secondary/30">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-accent rounded-2xl shadow-lg shadow-accent/20">
              <RefreshCcw className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-headline font-bold">Business Pulse</h3>
              <p className="text-xs text-muted-foreground font-medium">Real-time Cloud Firestore metrics.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className={cn(
                    "h-12 px-6 rounded-2xl font-bold transition-all gap-2 border-none shadow-sm",
                    statsDate ? "bg-primary text-white" : "bg-white text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="w-4 h-4" />
                  {mounted && statsDate ? format(statsDate, 'MMM dd, yyyy') : "All Time Stats"}
                  <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-3xl border-none shadow-2xl" align="end">
                <Calendar
                  mode="single"
                  selected={statsDate}
                  onSelect={setStatsDate}
                  initialFocus
                  className="rounded-3xl"
                />
              </PopoverContent>
            </Popover>
            {statsDate && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setStatsDate(undefined)}
                className="rounded-full h-12 w-12 hover:bg-destructive/10 text-destructive"
              >
                <FilterX className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Card key={i} className="rounded-3xl border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{stat.label}</CardTitle>
                  <div className={cn("p-2 rounded-xl bg-secondary/50 group-hover:scale-110 transition-transform")}>
                    <Icon className={cn("w-4 h-4", stat.color)} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black text-accent">{stat.value}</div>
                  <div className="mt-1 flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-primary" />
                    <span className="text-[10px] font-bold text-muted-foreground">Database Sync Active</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {selectedOrder && (
        <>
          <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
            <DialogContent className="rounded-[2.5rem] max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-headline">Order Details</DialogTitle>
                <DialogDescription>Reviewing full information for Order #{selectedOrder.id}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-secondary/20 p-4 rounded-2xl">
                    <div className="p-2 bg-white rounded-xl shadow-sm"><UserIcon className="w-5 h-5 text-primary" /></div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Customer</p>
                      <p className="font-bold">{selectedOrder.customerName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-secondary/20 p-4 rounded-2xl">
                    <div className="p-2 bg-white rounded-xl shadow-sm"><MapPin className="w-5 h-5 text-primary" /></div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Delivery Address</p>
                      <p className="text-xs font-medium">{selectedOrder.address}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-secondary/20 p-4 rounded-2xl">
                    <div className="p-2 bg-white rounded-xl shadow-sm"><Clock className="w-5 h-5 text-primary" /></div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Delivery Time</p>
                      <p className="font-bold">{selectedOrder.slot} • {selectedOrder.deliveryTime}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-secondary/20 p-4 rounded-2xl">
                    <div className="p-2 bg-white rounded-xl shadow-sm"><Tag className="w-5 h-5 text-primary" /></div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Amount Status</p>
                      <p className="font-bold">{selectedOrder.total} • {selectedOrder.paymentStatus?.toUpperCase() || 'PENDING'}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-secondary/10 p-6 rounded-[2rem] space-y-3">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Order Content</p>
                {(selectedOrder.items || []).map((item, i) => (
                  <div key={i} className="flex justify-between items-center text-sm font-bold bg-white p-3 rounded-xl shadow-sm">
                    <span>{item.quantity}x {item.name}</span>
                    <Badge variant="outline" className="text-[9px] h-4">{item.type}</Badge>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button onClick={() => setIsDetailsOpen(false)} className="rounded-xl h-12 px-8 font-bold">Close Details</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
            <DialogContent className="rounded-[2.5rem] max-md">
              <DialogHeader>
                <DialogTitle className="text-2xl font-headline flex items-center gap-2">
                  <UserCheck className="w-6 h-6 text-blue-600" />
                  Assign Rider
                </DialogTitle>
                <DialogDescription>Select a delivery partner for Order #{selectedOrder.id}</DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-300 mt-4 pr-4">
                <div className="space-y-3">
                  {deliveryBoys.map((db) => (
                    <Button 
                      key={db.id}
                      variant="outline" 
                      className="w-full h-16 justify-between rounded-2xl border-secondary hover:border-blue-600 hover:bg-blue-50 group transition-all"
                      onClick={() => handleAssignDelivery(db)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-primary group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          {db.firstName[0]}
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-sm text-slate-900">{db.firstName} {db.lastName}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-black">ID: {db.bacchabiteId}</p>
                        </div>
                      </div>
                      <Truck className="w-5 h-5 text-muted-foreground group-hover:text-blue-600" />
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

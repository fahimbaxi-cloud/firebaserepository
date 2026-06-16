"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Order, User, OrderStatus } from '@/lib/types';
import { 
  BarChart3, 
  CalendarDays, 
  Search, 
  FilterX, 
  ArrowUpDown, 
  ChevronUp, 
  ChevronDown, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Package,
  FileText,
  User as UserIcon,
  MapPin,
  Clock,
  Calendar as CalendarIcon,
  Phone,
  Printer,
  FileDown,
  ArrowUpDown as SortIcon
} from 'lucide-react';
import { format, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { downloadPDF } from '@/lib/pdf-export';

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

export default function DeliveryReportsPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [customRouteOrder, setCustomRouteOrder] = useState<string[]>([]);
  
  // Details Dialog State
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Firestore Data
  const ordersQuery = useMemoFirebase(() => collection(firestore, 'orders'), [firestore]);
  const { data: allOrders = [], isLoading: ordersLoading } = useCollection<Order>(ordersQuery);
  const packagesQuery = useMemoFirebase(() => collection(firestore, 'packages'), [firestore]);
  const { data: allPackages = [] } = useCollection<any>(packagesQuery);
  const menuQuery = useMemoFirebase(() => collection(firestore, 'menu_items'), [firestore]);
  const { data: menu = [] } = useCollection<any>(menuQuery);

  // Sorting State
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isRouteOrder, setIsRouteOrder] = useState(false);

  // Column Filters State
  const [colFilters, setColFilters] = useState({
    date: '',
    id: '',
    customer: '',
    address: '',
    package: '',
    qty: '',
    status: ''
  });

  // Range Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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
    const head = [['Date', 'Order ID', 'Customer', 'Address', 'Package', 'Qty', 'Status']];
    const body = filteredOrders.map(o => {
      const orderDate = typeof o.createdAt === 'string' ? parseISO(o.createdAt) : o.createdAt;
      return [
        format(orderDate, 'MMM dd, yyyy'),
        o.id.substr(0,8),
        o.customerName,
        o.address,
        o.packageName || 'Custom',
        o.packageQuantity || 1,
        o.status
      ];
    });
    downloadPDF('Partner Delivery History Report', head, body, `delivery_report_${currentUser?.bacchabiteId}`);
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

  const filteredOrders = useMemo(() => {
    if (!currentUser || !currentUser.id || !allOrders) return [];

    let data = allOrders.filter(o => o.assignedTo === currentUser.id);

    if (startDate || endDate) {
      const start = startDate ? startOfDay(parseISO(startDate)) : new Date(0);
      const end = endDate ? endOfDay(parseISO(endDate)) : new Date(8640000000000000);
      data = data.filter(o => {
        const orderDate = typeof o.createdAt === 'string' ? parseISO(o.createdAt) : o.createdAt;
        return isWithinInterval(orderDate, { start, end });
      });
    }

    data = data.filter(o => {
      const orderDate = typeof o.createdAt === 'string' ? parseISO(o.createdAt) : o.createdAt;
      const dateStr = format(orderDate, 'MMM dd, yyyy').toLowerCase();
      const idStr = o.id.toLowerCase();
      const customerStr = `${o.customerName} ${o.mobile}`.toLowerCase();
      const addressStr = (o.address || '').toLowerCase();
      const packageStr = (o.packageName || '').toLowerCase();
      const qtyStr = (o.packageQuantity || 1).toString();
      const statusStr = o.status.toLowerCase();

      return (
        dateStr.includes(colFilters.date.toLowerCase()) &&
        idStr.includes(colFilters.id.toLowerCase()) &&
        customerStr.includes(colFilters.customer.toLowerCase()) &&
        addressStr.includes(colFilters.address.toLowerCase()) &&
        packageStr.includes(colFilters.package.toLowerCase()) &&
        qtyStr.includes(colFilters.qty.toLowerCase()) &&
        statusStr.includes(colFilters.status.toLowerCase())
      );
    });

    return [...data].sort((a, b) => {
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
  }, [currentUser, allOrders, startDate, endDate, colFilters, sortField, sortDirection, isRouteOrder, customRouteOrder]);

  const stats = useMemo(() => {
    const total = filteredOrders.length;
    const deliveredCount = filteredOrders.filter(o => o.status === 'Delivered').length;
    const cancelled = filteredOrders.filter(o => o.status === 'Cancelled').length;
    const totalQtyInList = filteredOrders.reduce((sum, o) => sum + (o.packageQuantity || 1), 0);
    return { total, deliveredCount, cancelled, totalQtyInList };
  }, [filteredOrders]);

  const clearFilters = () => {
    setStartDate(''); setEndDate('');
    setColFilters({ date: '', id: '', customer: '', address: '', package: '', qty: '', status: '' });
    setSortField('createdAt');
    setSortDirection('desc');
    setIsRouteOrder(false);
  };

  const handleFilterChange = (key: keyof typeof colFilters, val: string) => {
    setColFilters(prev => ({ ...prev, [key]: val }));
  };

  const getPackageItems = (order: Order) => {
    if (!allPackages || !menu) return [];
    const pkg = allPackages.find(p => p.name === order.packageName);
    if (pkg && pkg.items) {
      return pkg.items.map((id: string) => {
        const menuItem = menu.find(m => m.id === id);
        return { name: menuItem?.name || "Unknown Item", type: menuItem?.type || "Veg", quantity: order.packageQuantity || 1, show: menuItem?.show };
      }).filter((item: any) => item.show !== false);
    }
    return (order.items || []).filter((item: any) => {
      const menuItem = menu.find(m => m.id === item.menuItemId || m.name === item.name);
      return !menuItem || menuItem.show !== false;
    });
  };

  const openOrderDetails = (order: Order) => {
    setSelectedOrderDetails(order);
    setIsDetailsOpen(true);
  };

  if (!isAuthorized || !currentUser) return null;

  return (
    <div className="pb-24 md:pb-0 md:pt-16 min-h-screen bg-blue-50/30">
      <Navbar role="delivery" />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 print:mb-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-headline font-bold text-blue-600">Performance Reports</h1>
              <p className="text-muted-foreground">Review your delivery history and task statistics.</p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              {(Object.values(colFilters).some(v => v !== '') || startDate || endDate) && (
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
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Sort Reports By</Label>
              <Select value={`${isRouteOrder ? 'route' : sortField}-${sortDirection}`} onValueChange={handleGlobalSortChange}>
                <SelectTrigger className="w-full sm:w-[220px] h-12 rounded-2xl bg-white border-blue-100 shadow-sm px-4 font-bold">
                  <div className="flex items-center gap-2">
                    <SortIcon className="w-4 h-4 text-blue-600" />
                    <SelectValue placeholder="Sort Reports" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-xl">
                  <SelectItem value="id-asc">Order Number (Low-High)</SelectItem>
                  <SelectItem value="id-desc">Order Number (High-Low)</SelectItem>
                  <SelectItem value="createdAt-asc">Date (Oldest First)</SelectItem>
                  <SelectItem value="createdAt-desc">Date (Newest First)</SelectItem>
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

            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Range Select</Label>
              <div className="flex items-center gap-2 bg-white p-1 rounded-2xl shadow-sm border border-blue-100/50">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 border-none bg-blue-50/50 rounded-xl text-xs w-[130px]" />
                <span className="text-muted-foreground text-xs font-bold">to</span>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 border-none bg-blue-50/50 rounded-xl text-xs w-[130px]" />
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 print:mb-4">
          <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 bg-blue-100 rounded-2xl text-blue-600"><FileText className="w-6 h-6" /></div>
              <div><p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Total Tasks</p><p className="text-2xl font-black">{stats.total}</p></div>
            </CardContent>
          </Card>
          <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 bg-green-100 rounded-2xl text-green-600"><CheckCircle2 className="w-6 h-6" /></div>
              <div><p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Successful</p><p className="text-2xl font-black">{stats.deliveredCount}</p></div>
            </CardContent>
          </Card>
          <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 bg-red-100 rounded-2xl text-red-600"><XCircle className="w-6 h-6" /></div>
              <div><p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Cancelled</p><p className="text-2xl font-black">{stats.cancelled}</p></div>
            </CardContent>
          </Card>
          <Card className="rounded-3xl border-none shadow-sm bg-blue-600 text-white overflow-hidden">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 bg-white/20 rounded-2xl"><Package className="w-6 h-6" /></div>
              <div><p className="text-[10px] font-black text-white/70 uppercase tracking-wider">Total Items</p><p className="text-2xl font-black">{stats.totalQtyInList}</p></div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white print:shadow-none print:rounded-none">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-blue-600 hover:bg-blue-600 border-none">
                  <TableHead className="text-white font-bold py-5 pl-8 uppercase text-[10px] tracking-widest w-[50px]">#</TableHead>
                  <TableHead className="text-white font-bold py-5 uppercase text-[10px] tracking-widest">
                    <div className="flex flex-col gap-1">
                      <SortTrigger label="Date" sortKey="createdAt" />
                      <div className="print:hidden">
                        <ColumnFilter placeholder="Search Date..." value={colFilters.date} onChange={v => handleFilterChange('date', v)} />
                      </div>
                    </div>
                  </TableHead>
                  <TableHead className="text-white font-bold uppercase text-[10px] tracking-widest">
                    <div className="flex flex-col gap-1">
                      <SortTrigger label="Order ID" sortKey="id" />
                      <div className="print:hidden">
                        <ColumnFilter placeholder="Search ID..." value={colFilters.id} onChange={v => handleFilterChange('id', v)} />
                      </div>
                    </div>
                  </TableHead>
                  <TableHead className="text-white font-bold uppercase text-[10px] tracking-widest">
                    <div className="flex flex-col gap-1">
                      <SortTrigger label="Customer" sortKey="customer" />
                      <div className="print:hidden">
                        <ColumnFilter placeholder="Search Name..." value={colFilters.customer} onChange={v => handleFilterChange('customer', v)} />
                      </div>
                    </div>
                  </TableHead>
                  <TableHead className="text-white font-bold uppercase text-[10px] tracking-widest">
                    <div className="flex flex-col gap-1">
                      <SortTrigger label="Address" sortKey="address" />
                      <div className="print:hidden">
                        <ColumnFilter placeholder="Search Address..." value={colFilters.address} onChange={v => handleFilterChange('address', v)} />
                      </div>
                    </div>
                  </TableHead>
                  <TableHead className="text-white font-bold uppercase text-[10px] tracking-widest">
                    <div className="flex flex-col gap-1">
                      <SortTrigger label="Package" sortKey="packageName" />
                      <div className="print:hidden">
                        <ColumnFilter placeholder="Search Package..." value={colFilters.package} onChange={v => handleFilterChange('package', v)} />
                      </div>
                    </div>
                  </TableHead>
                  <TableHead className="text-white font-bold uppercase text-[10px] tracking-widest text-center">
                    <div className="flex flex-col items-center gap-1">
                      <SortTrigger label="Qty" sortKey="packageQuantity" className="justify-center" />
                      <div className="print:hidden">
                        <ColumnFilter placeholder="Qty..." value={colFilters.qty} onChange={v => handleFilterChange('qty', v)} />
                      </div>
                    </div>
                  </TableHead>
                  <TableHead className="text-white font-bold uppercase text-[10px] tracking-widest text-right pr-8">
                    <div className="flex flex-col items-end gap-1">
                      <SortTrigger label="Status" sortKey="status" className="justify-end" />
                      <div className="print:hidden">
                        <ColumnFilter placeholder="Status..." value={colFilters.status} onChange={v => handleFilterChange('status', v)} />
                      </div>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersLoading ? (
                  <TableRow><TableCell colSpan={8} className="h-64 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></TableCell></TableRow>
                ) : filteredOrders.length > 0 ? (
                  filteredOrders.map((order, idx) => {
                    const orderDate = typeof order.createdAt === 'string' ? parseISO(order.createdAt) : order.createdAt;
                    return (
                      <TableRow key={order.id} className="hover:bg-blue-50/30 border-b border-blue-50 transition-colors cursor-pointer group" onClick={() => openOrderDetails(order)}>
                        <TableCell className="py-6 pl-8 font-black text-blue-600/40 text-xs">{idx + 1}</TableCell>
                        <TableCell className="py-6 font-bold text-sm">{mounted ? format(orderDate, 'MMM dd, yyyy') : '...'}</TableCell>
                        <TableCell><span className="font-black text-xs text-blue-600 uppercase group-hover:text-primary">#{order.id.substr(0,8)}</span></TableCell>
                        <TableCell><div className="font-bold text-sm">{order.customerName}</div><div className="text-[10px] text-muted-foreground font-medium">{order.mobile}</div></TableCell>
                        <TableCell><div className="flex items-start gap-1.5 max-w-[180px]"><MapPin className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" /><span className="text-[10px] font-medium leading-relaxed text-slate-600 line-clamp-2">{order.address}</span></div></TableCell>
                        <TableCell><div className="flex items-center gap-2"><Package className="w-3.5 h-3.5 text-blue-400" /><span className="text-xs font-bold text-slate-700">{order.packageName || "Custom"}</span></div></TableCell>
                        <TableCell className="text-center"><div className="font-black text-base text-blue-600">{order.packageQuantity || 1}</div></TableCell>
                        <TableCell className="text-right pr-8"><Badge variant="secondary" className={cn("rounded-lg border-none font-bold uppercase text-[9px] px-2.5 py-0.5", order.status === 'Delivered' ? "bg-green-100 text-green-700" : order.status === 'Cancelled' ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700")}>{order.status}</Badge></TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3 opacity-40"><BarChart3 className="w-12 h-12 text-blue-600" /><p className="font-bold text-slate-900">No records found</p></div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {filteredOrders.length > 0 && (
                <TableFooter className="bg-blue-50 border-t-2 border-blue-100">
                  <TableRow><TableCell colSpan={6} className="text-right font-black py-5 uppercase text-[10px] tracking-widest text-blue-600/60">Total Items in List:</TableCell><TableCell className="text-center font-black text-2xl text-blue-600">{stats.totalQtyInList}</TableCell><TableCell className="pr-8"></TableCell></TableRow>
                </TableFooter>
              )}
            </Table>
          </CardContent>
        </Card>

        {/* Order Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="rounded-[2.5rem] max-w-2xl overflow-hidden p-0 border-none shadow-2xl">
            {selectedOrderDetails && (
              <>
                <DialogHeader className="bg-blue-600 p-8 text-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <Badge variant="outline" className="bg-white/10 text-white border-white/20 uppercase font-black text-[10px] tracking-widest mb-2">Order Archive</Badge>
                      <DialogTitle className="text-3xl font-headline font-bold leading-none">#{selectedOrderDetails.id}</DialogTitle>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase text-blue-100 tracking-widest">Final Status</p>
                      <Badge className="bg-white text-blue-600 border-none font-black text-[10px] rounded-lg mt-1">{selectedOrderDetails.status}</Badge>
                    </div>
                  </div>
                </DialogHeader>
                <div className="p-8 space-y-8 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Customer Profile</Label>
                        <div className="flex items-start gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0"><UserIcon className="w-6 h-6 text-blue-600" /></div>
                          <div className="flex-1">
                            <p className="font-black text-slate-900 text-lg leading-tight">{selectedOrderDetails.customerName}</p>
                            <p className="text-xs font-bold text-blue-600 mt-1 flex items-center gap-1.5"><Phone className="w-3 h-3" /> {selectedOrderDetails.mobile}</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Address History</Label>
                        <div className="flex items-start gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0"><MapPin className="w-6 h-6 text-green-600" /></div>
                          <div className="flex-1"><p className="text-xs font-bold text-slate-700 leading-relaxed">{selectedOrderDetails.address}</p></div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Task Timeline</Label>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                          <div className="flex items-center gap-3"><CalendarIcon className="w-4 h-4 text-blue-600" /><div><p className="text-[9px] font-black uppercase text-muted-foreground">Date</p><p className="text-xs font-bold text-slate-900">{format(typeof selectedOrderDetails.createdAt === 'string' ? parseISO(selectedOrderDetails.createdAt) : selectedOrderDetails.createdAt, 'PPP')}</p></div></div>
                          <div className="flex items-center gap-3"><Clock className="w-4 h-4 text-blue-600" /><div><p className="text-[9px] font-black uppercase text-muted-foreground">Slot & Time</p><p className="text-xs font-bold text-slate-900">{selectedOrderDetails.slot} • {selectedOrderDetails.deliveryTime}</p></div></div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Package Overview</Label>
                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><Package className="w-5 h-5 text-blue-600" /><p className="font-black text-slate-900">{selectedOrderDetails.packageName || "Custom"}</p></div>
                            <Badge className="bg-blue-600 text-white border-none font-black text-sm">{selectedOrderDetails.packageQuantity || 1} Sets</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter className="bg-slate-50 p-6 flex items-center justify-center print:hidden">
                  <Button onClick={() => setIsDetailsOpen(false)} className="bg-slate-900 text-white hover:bg-slate-800 rounded-xl px-10 font-bold">Close View</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

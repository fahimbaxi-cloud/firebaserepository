"use client";

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { CustomerReceipt, User, Order } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ReceiptText, Calendar, User as UserIcon, Plus, Search, CheckCircle2, Wallet, Edit, Trash2, FilterX, CalendarDays, ArrowUpDown, ChevronUp, ChevronDown, ChevronRight, Loader2, Printer, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { downloadPDF } from '@/lib/pdf-export';

export default function ReceiptManagementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);

  // Firestore Data
  const receiptsQuery = useMemoFirebase(() => collection(firestore, 'receipts'), [firestore]);
  const { data: receiptsData, isLoading: receiptsLoading } = useCollection<CustomerReceipt>(receiptsQuery);
  const receipts = receiptsData || [];

  const ordersQuery = useMemoFirebase(() => collection(firestore, 'orders'), [firestore]);
  const { data: ordersData } = useCollection<Order>(ordersQuery);
  const orders = ordersData || [];

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: usersData } = useCollection<User>(usersQuery);
  const users = usersData || [];

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: 'date', direction: 'desc' });

  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<User | null>(null);
  
  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    paymentMethod: 'UPI' as 'Cash' | 'UPI' | 'Bank Transfer',
    notes: '',
    selectedOrderIds: [] as string[]
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortTrigger = ({ label, sortKey, className }: { label: string, sortKey: string, className?: string }) => (
    <div className={cn("flex items-center gap-1 cursor-pointer group select-none hover:text-primary transition-colors", className)} onClick={() => handleSort(sortKey)}>
      <span>{label}</span>
      {sortConfig.key === sortKey ? (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />) : <ArrowUpDown className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary" />}
    </div>
  );

  const filteredReceipts = useMemo(() => {
    let data = receipts.filter(r => {
      const customerName = (r.customerName || '').toLowerCase();
      const refId = (r.id || '').toLowerCase();
      const query = searchTerm.toLowerCase();
      const matchesSearch = customerName.includes(query) || refId.includes(query);
      const matchesStart = !startDate || r.date >= startDate;
      const matchesEnd = !endDate || r.date <= endDate;
      return matchesSearch && matchesStart && matchesEnd;
    });

    if (sortConfig.key && sortConfig.direction) {
      data.sort((a, b) => {
        const valA = (a as any)[sortConfig.key];
        const valB = (b as any)[sortConfig.key];
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [receipts, searchTerm, startDate, endDate, sortConfig]);

  const totalFilteredReceiptAmount = useMemo(() => filteredReceipts.reduce((sum, r) => sum + r.amount, 0), [filteredReceipts]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    const head = [['Receipt No', 'Customer', 'Date', 'Method', 'Amount']];
    const body = filteredReceipts.map(r => [
      r.id.substr(0,8),
      r.customerName,
      format(new Date(r.date), 'MMM dd, yyyy'),
      r.paymentMethod,
      r.amount
    ]);
    downloadPDF('Customer Receipt Report', head, body, 'receipts_report');
  };

  const customerList = useMemo(() => {
    return (users || []).filter(u => 
      u.role === 'customer' && 
      (`${u.firstName} ${u.lastName} ${u.bacchabiteId}`).toLowerCase().includes(customerSearch.toLowerCase())
    );
  }, [users, customerSearch]);

  const outstandingOrders = useMemo(() => {
    if (!selectedCustomer || !orders) return [];
    
    // Get all order IDs already covered by any existing receipt
    // This makes the list consistent with the Ledger view
    const ordersInReceipts = new Set(receipts.flatMap(r => r.orderIds || []));
    
    // If we are editing, we need to allow the orders associated with THIS receipt to show up
    const currentReceiptOrderIds = editingId ? (receipts.find(r => r.id === editingId)?.orderIds || []) : [];

    return orders.filter(o => 
      o.customerId === selectedCustomer.id && 
      o.status !== 'Cancelled' &&
      (!ordersInReceipts.has(o.id) || currentReceiptOrderIds.includes(o.id))
    );
  }, [selectedCustomer, orders, editingId, receipts]);

  const totalSelectedAmount = useMemo(() => {
    return outstandingOrders
      .filter(o => form.selectedOrderIds.includes(o.id))
      .reduce((sum, o) => sum + o.total, 0);
  }, [outstandingOrders, form.selectedOrderIds]);

  const handleToggleOrder = (orderId: string) => {
    setForm(prev => {
      const current = prev.selectedOrderIds;
      const updated = current.includes(orderId) ? current.filter(id => id !== orderId) : [...current, orderId];
      return { ...prev, selectedOrderIds: updated };
    });
  };

  const handleEdit = (receipt: CustomerReceipt) => {
    setEditingId(receipt.id);
    const customer = (users || []).find(u => u.id === receipt.customerId);
    setSelectedCustomer(customer || null);
    setForm({ date: receipt.date, paymentMethod: receipt.paymentMethod, notes: receipt.notes || '', selectedOrderIds: receipt.orderIds });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    const ref = doc(firestore, 'receipts', id);
    deleteDocumentNonBlocking(ref);
    toast({ title: "Receipt Deleted", description: "Record has been removed from ledger." });
  };

  const handleSaveReceipt = () => {
    if (!selectedCustomer) return;
    
    const receiptData: any = {
      customerId: selectedCustomer.id,
      customerName: `${selectedCustomer.firstName} ${selectedCustomer.lastName}`,
      orderIds: form.selectedOrderIds,
      amount: totalSelectedAmount,
      paymentMethod: form.paymentMethod,
      date: form.date,
      notes: form.notes,
      updatedAt: new Date().toISOString()
    };

    if (editingId) {
      const ref = doc(firestore, 'receipts', editingId);
      updateDocumentNonBlocking(ref, receiptData);
      toast({ title: "Receipt Updated", description: "The record has been modified." });
    } else {
      const ref = collection(firestore, 'receipts');
      addDocumentNonBlocking(ref, { ...receiptData, createdAt: new Date().toISOString() });
      
      form.selectedOrderIds.forEach(orderId => {
        const orderRef = doc(firestore, 'orders', orderId);
        updateDocumentNonBlocking(orderRef, { paymentStatus: 'paid' });
      });

      toast({ title: "Receipt Recorded", description: `Amount of ${totalSelectedAmount} received from ${receiptData.customerName}.` });
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null); setSelectedCustomer(null); setCustomerSearch('');
    setForm({ date: format(new Date(), 'yyyy-MM-dd'), paymentMethod: 'UPI', notes: '', selectedOrderIds: [] });
  };

  return (
    <div className="space-y-8">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 print:mb-4">
        <div><h1 className="text-3xl font-headline font-bold text-accent">Customer Receipts</h1><p className="text-muted-foreground mt-1 font-medium">Record and manage receipts received from customers.</p></div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl font-bold bg-white gap-2">
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl font-bold bg-white gap-2">
            <FileDown className="w-4 h-4" /> Export PDF
          </Button>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="bg-primary hover:bg-primary/90 text-white rounded-2xl h-12 px-6 font-bold shadow-lg shadow-primary/20"><Plus className="w-5 h-5 mr-2" />Add New Receipt</Button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-4 mb-6 print:hidden">
        <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search by Receipt No, Customer or Notes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-11 h-12 rounded-2xl bg-white border-none shadow-sm focus-visible:ring-primary/20" /></div>
        <div className="flex items-center gap-3 bg-white p-1 rounded-2xl shadow-sm border border-secondary/20">
          <div className="flex items-center gap-2 px-3 h-10"><CalendarDays className="w-4 h-4 text-muted-foreground" /><span className="text-[10px] font-black uppercase tracking-tighter">Range</span></div>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 border-none bg-secondary/20 rounded-xl text-xs w-full sm:w-32" /><span className="text-muted-foreground text-xs font-bold">to</span><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 border-none bg-secondary/20 rounded-xl text-xs w-full sm:w-32" />
        </div>
        {(searchTerm || startDate || endDate) && <Button variant="ghost" onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); }} className="rounded-2xl h-12 px-4 text-muted-foreground hover:text-destructive"><FilterX className="w-4 h-4 mr-2" />Clear</Button>}
      </div>

      <Card className="rounded-[2rem] border-none shadow-sm overflow-hidden bg-white print:shadow-none print:rounded-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow className="bg-secondary/20 hover:bg-secondary/20 border-none"><TableHead className="font-bold py-5 pl-8 text-xs uppercase tracking-wider"><SortTrigger label="Receipt No" sortKey="id" /></TableHead><TableHead className="font-bold text-xs uppercase tracking-wider"><SortTrigger label="Customer" sortKey="customerName" /></TableHead><TableHead className="font-bold text-xs uppercase tracking-wider"><SortTrigger label="Date" sortKey="date" /></TableHead><TableHead className="font-bold text-xs uppercase tracking-wider"><SortTrigger label="Method" sortKey="paymentMethod" /></TableHead><TableHead className="font-bold text-xs uppercase tracking-wider">Settled Orders</TableHead><TableHead className="font-bold text-xs uppercase tracking-wider"><SortTrigger label="Amount" sortKey="amount" /></TableHead><TableHead className="font-bold text-xs uppercase tracking-wider text-right pr-8 print:hidden">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {receiptsLoading ? (
                <TableRow><TableCell colSpan={7} className="h-64 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : receipts.length > 0 ? (
                receipts.map((r) => (
                  <TableRow key={r.id} className="hover:bg-secondary/5 border-b border-secondary/10"><TableCell className="py-6 pl-8"><div className="font-black text-sm text-accent">{(r.id || '').substr(0,8)}</div><div className="text-[10px] text-muted-foreground font-bold">{r.notes || 'No notes'}</div></TableCell><TableCell><div className="flex items-center gap-2"><div className="p-1.5 bg-secondary rounded-lg"><UserIcon className="w-3.5 h-3.5 text-muted-foreground" /></div><span className="font-bold text-sm">{r.customerName}</span></div></TableCell><TableCell><div className="flex items-center gap-2 font-bold text-sm"><Calendar className="w-4 h-4 text-muted-foreground" />{mounted ? format(new Date(r.date), 'MMM dd, yyyy') : '...'}</div></TableCell><TableCell><Badge variant="secondary" className="bg-secondary/50 text-muted-foreground border-none font-bold uppercase text-[9px] px-2 py-0.5">{r.paymentMethod}</Badge></TableCell><TableCell><div className="flex gap-1 flex-wrap">{r.orderIds?.map(id => <Badge key={id} variant="outline" className="text-[8px] h-4 border-secondary text-muted-foreground">#{id.substr(0,6)}</Badge>)}</div></TableCell><TableCell><div className="font-black text-lg text-primary">{r.amount}</div></TableCell><TableCell className="text-right pr-8 print:hidden"><div className="flex justify-end gap-2"><Button variant="ghost" size="icon" onClick={() => handleEdit(r)} className="rounded-full h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/5"><Edit className="w-4 h-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)} className="rounded-full h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/5"><Trash2 className="w-4 h-4" /></Button></div></TableCell></TableRow>
                ))
              ) : <TableRow><TableCell colSpan={7} className="h-64 text-center"><div className="p-4 bg-secondary rounded-full inline-block mb-3"><ReceiptText className="w-8 h-8 text-muted-foreground/30" /></div><p className="text-muted-foreground font-medium">No receipts recorded.</p></TableCell></TableRow>}
            </TableBody>
            <TableFooter className="bg-secondary/10 border-t-2 border-secondary/30"><TableRow><TableCell colSpan={5} className="text-right font-black py-5 uppercase text-xs tracking-widest text-muted-foreground">Total Filtered Receipt Amount:</TableCell><TableCell colSpan={2} className="font-black text-2xl text-primary pl-4">{totalFilteredReceiptAmount.toFixed(2)}</TableCell></TableRow></TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-8 pb-0 shrink-0"><DialogTitle className="text-2xl font-headline flex items-center gap-2"><ReceiptText className="w-6 h-6 text-primary" />{editingId ? 'Edit Receipt' : 'Record Customer Receipt'}</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto px-8 py-4"><div className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-4"><div className="lg:col-span-5 space-y-6">{!selectedCustomer ? (<div className="space-y-4"><Label className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">1. Find Customer</Label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search by ID or Name..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="pl-10 h-12 rounded-xl bg-secondary/20 border-none" /></div><ScrollArea className="h-[300px] border-2 border-secondary/30 rounded-2xl bg-secondary/5"><div className="p-2 space-y-1">{customerList.map((user) => (<div key={user.id} onClick={() => setSelectedCustomer(user)} className="flex items-center justify-between p-3 rounded-xl hover:bg-primary/5 cursor-pointer transition-colors"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center font-bold text-xs text-primary">{user.firstName[0]}</div><div><p className="text-sm font-bold">{user.firstName} {user.lastName}</p><p className="text-[10px] text-muted-foreground uppercase font-black">{user.bacchabiteId}</p></div></div><ChevronRight className="w-4 h-4 text-muted-foreground" /></div>))}</div></ScrollArea></div>) : (<div className="space-y-4"><Label className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Selected Customer</Label><div className="p-4 bg-primary/5 border-2 border-primary/10 rounded-2xl flex items-center justify-between"><div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-primary" /><div><p className="text-sm font-black text-accent">{selectedCustomer.firstName} {selectedCustomer.lastName}</p><p className="text-[10px] text-muted-foreground font-bold">{selectedCustomer.bacchabiteId}</p></div></div>{!editingId && <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)} className="text-primary font-bold hover:bg-primary/10">Change</Button>}</div><div className="space-y-4 pt-4"><div className="space-y-2"><Label>Receipt Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="rounded-xl h-11" /></div><div className="space-y-2"><Label>Receipt Method</Label><Select value={form.paymentMethod} onValueChange={(v: any) => setForm({ ...form, paymentMethod: v })}><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="UPI">UPI / GPay / PhonePe</SelectItem><SelectItem value="Cash">Cash Receipt</SelectItem><SelectItem value="Bank Transfer">Bank Transfer</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Internal Notes</Label><Textarea placeholder="Optional reference info..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl min-h-[80px]" /></div></div></div>)}</div><div className="lg:col-span-7 space-y-6"><div className="space-y-4"><Label className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">2. Select Outstanding Orders</Label><Card className="border-2 border-secondary/30 rounded-[2rem] overflow-hidden bg-secondary/5 min-h-[400px]">{selectedCustomer ? (outstandingOrders.length > 0 ? (<ScrollArea className="h-[450px]"><div className="p-4 space-y-3">{outstandingOrders.map((order) => (<div key={order.id} onClick={() => handleToggleOrder(order.id)} className={cn("p-4 rounded-2xl border-2 transition-all cursor-pointer", form.selectedOrderIds.includes(order.id) ? "bg-white border-primary shadow-sm" : "bg-white/50 border-transparent hover:border-secondary")}><div className="flex items-start justify-between"><div className="flex gap-3"><Checkbox checked={form.selectedOrderIds.includes(order.id)} className="mt-1" /><div><div className="flex items-center gap-2"><p className="font-black text-sm">#{order.id.substr(0,6)}</p><Badge variant="secondary" className="text-[8px] h-4 uppercase">{order.type}</Badge></div><p className="text-[10px] text-muted-foreground font-bold mt-0.5">{mounted ? format(new Date(order.createdAt), 'PP') : '...'} • {order.slot}</p></div></div><div className="text-right"><p className="font-black text-accent text-lg">{order.total}</p><Badge className={cn("border-none text-[8px] h-4", order.paymentStatus === 'paid' ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>{order.paymentStatus.toUpperCase()}</Badge></div></div></div>))}</div></ScrollArea>) : (<div className="flex flex-col items-center justify-center h-[400px] text-center p-8 opacity-40"><CheckCircle2 className="w-12 h-12 mb-4 text-green-600" /><p className="font-bold">No outstanding orders found.</p></div>)) : (<div className="flex flex-col items-center justify-center h-[400px] text-center p-8 opacity-40"><UserIcon className="w-12 h-12 mb-4" /><p className="font-bold">Select a customer to see orders</p></div>)}</Card></div></div></div></div><DialogFooter className="p-8 pt-4 bg-secondary/5 border-t border-secondary/20 shrink-0"><div className="flex-1 flex flex-col justify-center"><span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Settlement Total</span><span className="text-2xl font-black text-primary">{totalSelectedAmount}</span></div><div className="flex gap-2"><Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl h-12">Cancel</Button><Button onClick={handleSaveReceipt} disabled={!selectedCustomer || form.selectedOrderIds.length === 0} className="bg-primary hover:bg-primary/90 rounded-xl h-12 px-8 font-bold shadow-lg shadow-primary/20">{editingId ? 'Update Receipt' : 'Confirm & Save Receipt'}</Button></div></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

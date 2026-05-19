
"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Payment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, Calendar, User, Plus, History, Wallet, CheckCircle2, Edit, Trash2, Search, FilterX, CalendarDays, Loader2, ArrowUpDown, ChevronUp, ChevronDown, Printer, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { downloadPDF } from '@/lib/pdf-export';

export default function PaymentManagementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  // Firestore Data
  const paymentsQuery = useMemoFirebase(() => collection(firestore, 'payments'), [firestore]);
  const { data: paymentsData, isLoading: paymentsLoading } = useCollection<Payment>(paymentsQuery);
  const payments = paymentsData || [];

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: 'date', direction: 'desc' });

  const [form, setForm] = useState({
    supplierName: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    paymentMethod: 'UPI' as 'Cash' | 'UPI' | 'Bank Transfer',
    notes: ''
  });

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

  const filteredPayments = useMemo(() => {
    let data = payments.filter(p => {
      const supplierName = (p.supplierName || '').toLowerCase();
      const refId = (p.id || '').toLowerCase();
      const notes = (p.notes || '').toLowerCase();
      const query = searchTerm.toLowerCase();
      const matchesSearch = supplierName.includes(query) || refId.includes(query) || notes.includes(query);
      const matchesStart = !startDate || p.date >= startDate;
      const matchesEnd = !endDate || p.date <= endDate;
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
  }, [payments, searchTerm, startDate, endDate, sortConfig]);

  const totalFilteredPayments = useMemo(() => filteredPayments.reduce((sum, p) => sum + p.amount, 0), [filteredPayments]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    const head = [['Ref ID', 'Supplier', 'Date', 'Method', 'Amount']];
    const body = filteredPayments.map(p => [
      p.id.substr(0,8),
      p.supplierName,
      format(new Date(p.date), 'MMM dd, yyyy'),
      p.paymentMethod,
      p.amount
    ]);
    downloadPDF('Supplier Payment Report', head, body, 'payments_report');
  };

  const handleEdit = (payment: Payment) => {
    setEditingId(payment.id);
    setForm({ supplierName: payment.supplierName, date: payment.date, amount: payment.amount.toString(), paymentMethod: payment.paymentMethod, notes: payment.notes || '' });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    const ref = doc(firestore, 'payments', id);
    deleteDocumentNonBlocking(ref);
    toast({ title: "Payment Deleted", description: "Record removed from Firestore." });
  };

  const handleSave = () => {
    if (!form.supplierName || !form.amount) {
      toast({ title: "Required Fields", description: "Please fill in supplier name and amount.", variant: "destructive" });
      return;
    }

    const paymentData: any = { ...form, amount: Number(form.amount), updatedAt: new Date().toISOString() };

    if (editingId) {
      const ref = doc(firestore, 'payments', editingId);
      updateDocumentNonBlocking(ref, paymentData);
      toast({ title: "Payment Updated", description: "The record has been updated." });
    } else {
      const ref = collection(firestore, 'payments');
      addDocumentNonBlocking(ref, { ...paymentData, createdAt: new Date().toISOString() });
      toast({ title: "Payment Recorded", description: `Amount of ${form.amount} paid to ${form.supplierName}.` });
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ supplierName: '', date: format(new Date(), 'yyyy-MM-dd'), amount: '', paymentMethod: 'UPI', notes: '' });
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:mb-4">
        <div><h1 className="text-3xl font-headline font-bold text-accent">Supplier Payment</h1><p className="text-muted-foreground mt-1 font-medium">Manage and track outgoing payments to suppliers.</p></div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl font-bold bg-white gap-2">
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl font-bold bg-white gap-2">
            <FileDown className="w-4 h-4" /> Export PDF
          </Button>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="bg-accent hover:bg-accent/90 text-white rounded-2xl h-12 px-6 font-bold shadow-lg shadow-accent/20"><Plus className="w-5 h-5 mr-2" />Record Payment</Button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-4 mb-6 print:hidden">
        <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search by ID, Supplier or Notes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-11 h-12 rounded-2xl bg-white border-none shadow-sm focus-visible:ring-primary/20" /></div>
        <div className="flex items-center gap-3 bg-white p-1 rounded-2xl shadow-sm border border-secondary/20">
          <div className="flex items-center gap-2 px-3 h-10"><CalendarDays className="w-4 h-4 text-muted-foreground" /><span className="text-[10px] font-black uppercase tracking-tighter">Range</span></div>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 border-none bg-secondary/20 rounded-xl text-xs w-full sm:w-32" /><span className="text-muted-foreground text-xs font-bold">to</span><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 border-none bg-secondary/20 rounded-xl text-xs w-full sm:w-32" />
        </div>
        {(searchTerm || startDate || endDate) && <Button variant="ghost" onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); }} className="rounded-2xl h-12 px-4 text-muted-foreground hover:text-destructive"><FilterX className="w-4 h-4 mr-2" />Clear</Button>}
      </div>

      <Card className="rounded-[2rem] border-none shadow-sm overflow-hidden bg-white print:shadow-none print:rounded-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow className="bg-secondary/20 hover:bg-secondary/20 border-none"><TableHead className="font-bold py-5 pl-8 text-xs uppercase tracking-wider"><SortTrigger label="Transaction Ref" sortKey="id" /></TableHead><TableHead className="font-bold text-xs uppercase tracking-wider"><SortTrigger label="Supplier" sortKey="supplierName" /></TableHead><TableHead className="font-bold text-xs uppercase tracking-wider"><SortTrigger label="Date" sortKey="date" /></TableHead><TableHead className="font-bold text-xs uppercase tracking-wider"><SortTrigger label="Method" sortKey="paymentMethod" /></TableHead><TableHead className="font-bold text-xs uppercase tracking-wider"><SortTrigger label="Amount" sortKey="amount" /></TableHead><TableHead className="font-bold text-right pr-8 text-xs uppercase tracking-wider print:hidden">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {paymentsLoading ? (
                <TableRow><TableCell colSpan={6} className="h-64 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : filteredPayments.length > 0 ? (
                filteredPayments.map((p) => (
                  <TableRow key={p.id} className="hover:bg-secondary/5 border-b border-secondary/10 group"><TableCell className="py-6 pl-8"><div className="font-black text-sm text-accent">{(p.id || '').substr(0,8)}</div><div className="text-[10px] text-muted-foreground font-bold">{p.notes || 'No notes added'}</div></TableCell><TableCell><div className="flex items-center gap-2"><div className="p-1.5 bg-secondary rounded-lg"><User className="w-3.5 h-3.5 text-muted-foreground" /></div><span className="font-bold text-sm">{p.supplierName}</span></div></TableCell><TableCell><div className="flex items-center gap-2 font-bold text-sm"><Calendar className="w-4 h-4 text-muted-foreground" />{format(new Date(p.date), 'MMM dd, yyyy')}</div></TableCell><TableCell><Badge variant="secondary" className="bg-secondary/50 text-muted-foreground border-none font-bold uppercase text-[9px] px-2 py-0.5">{p.paymentMethod}</Badge></TableCell><TableCell><div className="font-black text-lg text-primary">{p.amount}</div></TableCell><TableCell className="text-right pr-8 print:hidden"><div className="flex justify-end gap-2"><Button variant="ghost" size="icon" onClick={() => handleEdit(p)} className="rounded-full h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/5"><Edit className="w-4 h-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="rounded-full h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/5"><Trash2 className="w-4 h-4" /></Button></div></TableCell></TableRow>
                ))
              ) : <TableRow><TableCell colSpan={6} className="h-64 text-center"><div className="p-4 bg-secondary rounded-full inline-block mb-3"><CreditCard className="w-8 h-8 text-muted-foreground/30" /></div><p className="text-muted-foreground font-medium">No payment records found.</p></TableCell></TableRow>}
            </TableBody>
            <TableFooter className="bg-secondary/10 border-t-2 border-secondary/30"><TableRow><TableCell colSpan={4} className="text-right font-black py-5 uppercase text-xs tracking-widest text-muted-foreground">Total Filtered Payment:</TableCell><TableCell colSpan={2} className="font-black text-2xl text-primary pl-4">{totalFilteredPayments.toFixed(2)}</TableCell></TableRow></TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-lg">
          <DialogHeader><DialogTitle className="text-2xl font-headline flex items-center gap-2"><CreditCard className="w-6 h-6 text-accent" />{editingId ? 'Edit Payment' : 'Record Payment'}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-5"><div className="space-y-2"><Label className="font-bold">Supplier Name</Label><Input placeholder="Who are you paying?" value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} className="rounded-xl h-11" /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Payment Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="rounded-xl h-11" /></div><div className="space-y-2"><Label>Amount</Label><Input type="number" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="rounded-xl h-11 font-black text-primary" /></div></div><div className="space-y-2"><Label>Payment Method</Label><Select value={form.paymentMethod} onValueChange={(v: any) => setForm({ ...form, paymentMethod: v })}><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="UPI">UPI / GPay / PhonePe</SelectItem><SelectItem value="Cash">Cash Payment</SelectItem><SelectItem value="Bank Transfer">Bank Transfer (IMPS/NEFT)</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Transaction Notes</Label><Textarea placeholder="Add details like Bill No or Transfer ID..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl min-h-[80px]" /></div></div><DialogFooter><Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl h-12">Cancel</Button><Button onClick={handleSave} className="bg-accent hover:bg-accent/90 rounded-xl h-12 px-8 font-bold text-white shadow-lg shadow-accent/20">{editingId ? 'Update Payment' : 'Record Payment'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

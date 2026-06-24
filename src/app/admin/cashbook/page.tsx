
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
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { GeneralTransaction, ExpenseCategory, IncomeCategory } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Wallet, TrendingUp, TrendingDown, Plus, Search, FilterX, CalendarDays, Edit, Trash2, ArrowUpDown, ChevronUp, ChevronDown, Coins, Landmark, Loader2, Printer, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { downloadPDF } from '@/lib/pdf-export';

export default function CashbookPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  // Firestore Data
  const txQuery = useMemoFirebase(() => collection(firestore, 'general_transactions'), [firestore]);
  const { data: txData, isLoading: txLoading } = useCollection<GeneralTransaction>(txQuery);
  const transactions = txData || [];

  const exQuery = useMemoFirebase(() => collection(firestore, 'expense_categories'), [firestore]);
  const { data: exData } = useCollection<ExpenseCategory>(exQuery);
  const expenseCategories = exData || [];

  const inQuery = useMemoFirebase(() => collection(firestore, 'income_categories'), [firestore]);
  const { data: inData } = useCollection<IncomeCategory>(inQuery);
  const incomeCategories = inData || [];

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Income' | 'Expense'>('All');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: 'date', direction: 'desc' });

  const [form, setForm] = useState({
    type: 'Expense' as 'Income' | 'Expense',
    categoryId: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    paymentMethod: 'Cash' as 'Cash' | 'UPI' | 'Bank Transfer',
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

  const filteredTransactions = useMemo(() => {
    let data = transactions.filter(t => {
      const categoryName = (t.categoryName || '').toLowerCase();
      const notes = (t.notes || '').toLowerCase();
      const query = searchTerm.toLowerCase();
      const matchesSearch = categoryName.includes(query) || notes.includes(query);
      const matchesType = typeFilter === 'All' || t.type === typeFilter;
      const matchesStart = !startDate || t.date >= startDate;
      const matchesEnd = !endDate || t.date <= endDate;
      return matchesSearch && matchesType && matchesStart && matchesEnd;
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
  }, [transactions, searchTerm, startDate, endDate, typeFilter, sortConfig]);

  const stats = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
    const expense = filteredTransactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [filteredTransactions]);

  const handleEdit = (tx: GeneralTransaction) => {
    setEditingId(tx.id);
    setForm({ type: tx.type, categoryId: tx.categoryId, amount: tx.amount.toString(), date: tx.date, paymentMethod: tx.paymentMethod, notes: tx.notes || '' });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    const ref = doc(firestore, 'general_transactions', id);
    deleteDocumentNonBlocking(ref);
    toast({ title: "Entry Deleted", description: "The transaction has been removed." });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    const head = [['Date', 'Type', 'Category', 'Method', 'Amount', 'Notes']];
    const body = filteredTransactions.map(t => [
      format(new Date(t.date), 'MMM dd, yyyy'),
      t.type,
      t.categoryName,
      t.paymentMethod,
      t.amount,
      t.notes || '-'
    ]);
    downloadPDF('Income and Expense Registry', head, body, 'cashbook_report');
  };

  const handleSave = () => {
    if (!form.categoryId || !form.amount) {
      toast({ title: "Required Fields", description: "Please fill in category and amount.", variant: "destructive" });
      return;
    }

    const categoryName = form.type === 'Income' 
      ? incomeCategories.find(c => c.id === form.categoryId)?.name || 'General'
      : expenseCategories.find(c => c.id === form.categoryId)?.name || 'General';

    const txData: any = { ...form, categoryName, amount: Number(form.amount), updatedAt: new Date().toISOString() };

    if (editingId) {
      const ref = doc(firestore, 'general_transactions', editingId);
      updateDocumentNonBlocking(ref, txData);
      toast({ title: "Entry Updated", description: "The record has been modified." });
    } else {
      const ref = collection(firestore, 'general_transactions');
      addDocumentNonBlocking(ref, { ...txData, createdAt: new Date().toISOString() });
      toast({ title: "Entry Saved", description: `${form.type} recorded.` });
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ type: 'Expense', categoryId: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), paymentMethod: 'Cash', notes: '' });
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:mb-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-accent">Income and Expense</h1>
          <p className="text-muted-foreground mt-1 font-medium">Record general business incomes and expenses.</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl font-bold bg-white gap-2">
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl font-bold bg-white gap-2">
            <FileDown className="w-4 h-4" /> Export PDF
          </Button>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="bg-primary hover:bg-primary/90 text-white rounded-2xl h-12 px-6 font-bold shadow-lg shadow-primary/20">
            <Plus className="w-5 h-5 mr-2" />Add Transaction
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:mb-4">
        <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden"><CardContent className="p-6 flex items-center gap-4"><div className="p-4 bg-green-100 rounded-2xl text-green-600"><TrendingUp className="w-6 h-6" /></div><div><p className="text-xs font-bold text-muted-foreground uppercase">Period Income</p><p className="text-2xl font-black">{stats.income}</p></div></CardContent></Card>
        <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden"><CardContent className="p-6 flex items-center gap-4"><div className="p-4 bg-red-100 rounded-2xl text-red-600"><TrendingDown className="w-6 h-6" /></div><div><p className="text-xs font-bold text-muted-foreground uppercase">Period Expense</p><p className="text-2xl font-black">{stats.expense}</p></div></CardContent></Card>
        <Card className="rounded-3xl border-none shadow-sm bg-accent text-white overflow-hidden"><CardContent className="p-6 flex items-center gap-4"><div className="p-4 bg-white/20 rounded-2xl"><Wallet className="w-6 h-6" /></div><div><p className="text-xs font-bold text-white/70 uppercase">Net Flow</p><p className="text-2xl font-black">{stats.balance}</p></div></CardContent></Card>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 mb-6 print:hidden">
        <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search by category or notes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-11 h-12 rounded-2xl bg-white border-none shadow-sm focus-visible:ring-primary/20" /></div>
        <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)} className="bg-white p-1 rounded-2xl shadow-sm border border-secondary/20"><TabsList className="bg-transparent border-none"><TabsTrigger value="All" className="rounded-xl h-10 px-4 font-bold data-[state=active]:bg-secondary/50">All</TabsTrigger><TabsTrigger value="Income" className="rounded-xl h-10 px-4 font-bold data-[state=active]:bg-green-100 data-[state=active]:text-green-700">Incomes</TabsTrigger><TabsTrigger value="Expense" className="rounded-xl h-10 px-4 font-bold data-[state=active]:bg-red-100 data-[state=active]:text-red-700">Expenses</TabsTrigger></TabsList></Tabs>
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-1 rounded-2xl shadow-sm border border-secondary/20">
          <div className="flex items-center gap-2 px-3 h-10"><CalendarDays className="w-4 h-4 text-muted-foreground" /><span className="text-[10px] font-black uppercase tracking-tighter">Period</span></div>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 border-none bg-secondary/20 rounded-xl text-xs w-full sm:w-32" /><span className="text-muted-foreground text-xs font-bold">to</span><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 border-none bg-secondary/20 rounded-xl text-xs w-full sm:w-32" />
        </div>
        {(searchTerm || startDate || endDate || typeFilter !== 'All') && <Button variant="ghost" size="icon" onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); setTypeFilter('All'); }} className="h-12 w-12 rounded-2xl text-muted-foreground hover:text-destructive"><FilterX className="w-5 h-5" /></Button>}
      </div>

      <Card className="rounded-[2rem] border-none shadow-sm overflow-hidden bg-white print:shadow-none print:rounded-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow className="bg-secondary/20 hover:bg-secondary/20 border-none"><TableHead className="font-bold py-5 pl-8 text-xs uppercase tracking-wider"><SortTrigger label="Date" sortKey="date" /></TableHead><TableHead className="font-bold text-xs uppercase tracking-wider"><SortTrigger label="Type" sortKey="type" /></TableHead><TableHead className="font-bold text-xs uppercase tracking-wider"><SortTrigger label="Category" sortKey="categoryName" /></TableHead><TableHead className="font-bold text-xs uppercase tracking-wider"><SortTrigger label="Method" sortKey="paymentMethod" /></TableHead><TableHead className="font-bold text-xs uppercase tracking-wider"><SortTrigger label="Amount" sortKey="amount" /></TableHead><TableHead className="font-bold text-right pr-8 text-xs uppercase tracking-wider print:hidden">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {txLoading ? (
                <TableRow><TableCell colSpan={6} className="h-64 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => (
                  <TableRow key={tx.id} className="hover:bg-secondary/5 border-b border-secondary/10 group"><TableCell className="py-6 pl-8 font-bold text-sm">{format(new Date(tx.date), 'MMM dd, yyyy')}</TableCell><TableCell><Badge className={cn("rounded-lg border-none font-bold uppercase text-[9px] px-2 py-0.5", tx.type === 'Income' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>{tx.type}</Badge></TableCell><TableCell><div className="font-bold text-sm">{tx.categoryName}</div><div className="text-[10px] text-muted-foreground italic truncate max-w-[200px]">{tx.notes || 'No notes'}</div></TableCell><TableCell><div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">{tx.paymentMethod === 'Cash' ? <Coins className="w-3 h-3" /> : <Landmark className="w-3 h-3" />}{tx.paymentMethod}</div></TableCell><TableCell><div className={cn("font-black text-lg", tx.type === 'Income' ? "text-green-600" : "text-red-600")}>{tx.amount}</div></TableCell><TableCell className="text-right pr-8 print:hidden"><div className="flex justify-end gap-2"><Button variant="ghost" size="icon" onClick={() => handleEdit(tx)} className="rounded-full h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/5"><Edit className="w-4 h-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDelete(tx.id)} className="rounded-full h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/5"><Trash2 className="w-4 h-4" /></Button></div></TableCell></TableRow>
                ))
              ) : <TableRow><TableCell colSpan={6} className="h-64 text-center"><div className="flex flex-col items-center justify-center space-y-3 opacity-40"><Search className="w-10 h-10" /><p className="font-bold">No transactions found.</p></div></TableCell></TableRow>}
            </TableBody>
            <TableFooter className="bg-secondary/10 border-t-2 border-secondary/30"><TableRow><TableCell colSpan={4} className="text-right font-black py-5 uppercase text-xs tracking-widest text-muted-foreground">Net Period Total:</TableCell><TableCell colSpan={2} className={cn("font-black text-2xl pl-4", stats.balance >= 0 ? "text-green-600" : "text-red-600")}>{Math.abs(stats.balance)}<span className="text-xs ml-1 uppercase">{stats.balance >= 0 ? 'Surplus' : 'Deficit'}</span></TableCell></TableRow></TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-lg">
          <DialogHeader><DialogTitle className="text-2xl font-headline flex items-center gap-2"><Wallet className="w-6 h-6 text-accent" />{editingId ? 'Edit Entry' : 'New Transaction'}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-5"><div className="space-y-2"><Label className="font-bold">Transaction Type</Label><Tabs value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v, categoryId: '' })}><TabsList className="grid grid-cols-2 w-full h-12 rounded-xl bg-secondary/30 p-1"><TabsTrigger value="Income" className="rounded-lg font-bold data-[state=active]:bg-green-100 data-[state=active]:text-green-700">Income</TabsTrigger><TabsTrigger value="Expense" className="rounded-lg font-bold data-[state=active]:bg-red-100 data-[state=active]:text-red-700">Expense</TabsTrigger></TabsList></Tabs></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="rounded-xl h-11" /></div><div className="space-y-2"><Label>Amount</Label><Input type="number" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={cn("rounded-xl h-11 font-black", form.type === 'Income' ? "text-green-600" : "text-red-600")} /></div></div><div className="space-y-2">
  <Label>Category (from Master)</Label>
  <SearchableSelect 
    value={form.categoryId || ''} 
    onChange={(v) => setForm({ ...form, categoryId: v })} 
    options={form.type === 'Income' ? incomeCategories : expenseCategories}
    placeholder="Select Category"
    searchPlaceholder="Search category..."
    triggerClassName="h-11 border border-secondary/50"
  />
</div><div className="space-y-2"><Label>Payment Method</Label><Select value={form.paymentMethod} onValueChange={(v: any) => setForm({ ...form, paymentMethod: v })}><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="Cash">Cash</SelectItem><SelectItem value="UPI">UPI / Digital</SelectItem><SelectItem value="Bank Transfer">Bank Transfer</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Notes</Label><Textarea placeholder="Details about the transaction..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl min-h-[80px]" /></div></div><DialogFooter><Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl h-12">Cancel</Button><Button onClick={handleSave} className="bg-primary hover:bg-primary/90 rounded-xl h-12 px-8 font-bold">{editingId ? 'Update Entry' : 'Save Transaction'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

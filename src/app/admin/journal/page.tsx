"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { JournalEntry, Supplier, User, ExpenseCategory, IncomeCategory, GLAccount } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { BookText, Plus, Search, FilterX, Edit, Trash2, ArrowUpDown, ChevronUp, ChevronDown, ArrowRightLeft, Loader2, Printer, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { downloadPDF } from '@/lib/pdf-export';

export default function JournalVoucherPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  // Firestore Data
  const jvQuery = useMemoFirebase(() => collection(firestore, 'journal_entries'), [firestore]);
  const { data: jvData, isLoading: jvLoading } = useCollection<JournalEntry>(jvQuery);
  const entries = jvData || [];

  const suppliersQuery = useMemoFirebase(() => collection(firestore, 'suppliers'), [firestore]);
  const { data: suppliers } = useCollection<Supplier>(suppliersQuery);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users } = useCollection<User>(usersQuery);

  const exQuery = useMemoFirebase(() => collection(firestore, 'expense_categories'), [firestore]);
  const { data: expenseCategories } = useCollection<ExpenseCategory>(exQuery);

  const inQuery = useMemoFirebase(() => collection(firestore, 'income_categories'), [firestore]);
  const { data: incomeCategories } = useCollection<IncomeCategory>(inQuery);

  const glQuery = useMemoFirebase(() => collection(firestore, 'gl_accounts'), [firestore]);
  const { data: glAccounts } = useCollection<GLAccount>(glQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: 'date', direction: 'desc' });

  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    debitAccountId: '',
    creditAccountId: '',
    amount: '',
    notes: ''
  });

  const accountHeads = useMemo(() => {
    const heads: { id: string, name: string, group: string }[] = [];

    // All heads now come dynamically from Masters
    (glAccounts || []).forEach(a => heads.push({ id: a.id, name: a.name, group: a.group }));
    (suppliers || []).forEach(s => heads.push({ id: s.id, name: `${s.name} (Supplier)`, group: 'Suppliers' }));
    (users || []).filter(u => u.role === 'customer').forEach(c => heads.push({ id: c.id, name: `${c.firstName} ${c.lastName} (Customer)`, group: 'Customers' }));
    (expenseCategories || []).forEach(e => heads.push({ id: e.id, name: `${e.name} (Expense)`, group: 'Expenses' }));
    (incomeCategories || []).forEach(i => heads.push({ id: i.id, name: `${i.name} (Income)`, group: 'Incomes' }));

    return heads;
  }, [suppliers, users, expenseCategories, incomeCategories, glAccounts]);

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

  const filteredEntries = useMemo(() => {
    let data = entries.filter(e => {
      const notes = (e.notes || '').toLowerCase();
      const dr = (e.debitAccountName || '').toLowerCase();
      const cr = (e.creditAccountName || '').toLowerCase();
      const query = searchTerm.toLowerCase();
      return notes.includes(query) || dr.includes(query) || cr.includes(query) || e.id.toLowerCase().includes(query);
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
  }, [entries, searchTerm, sortConfig]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    const head = [['Date', 'JV Ref', 'Debit Account', 'Credit Account', 'Amount']];
    const body = filteredEntries.map(e => [
      format(new Date(e.date), 'MMM dd, yyyy'),
      e.id.substr(0,8),
      e.debitAccountName,
      e.creditAccountName,
      e.amount
    ]);
    downloadPDF('Journal Voucher Report', head, body, 'journal_report');
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setForm({ date: entry.date, debitAccountId: entry.debitAccountId, creditAccountId: entry.creditAccountId, amount: entry.amount.toString(), notes: entry.notes });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    const ref = doc(firestore, 'journal_entries', id);
    deleteDocumentNonBlocking(ref);
    toast({ title: "JV Deleted", description: "Entry removed from books." });
  };

  const handleSave = () => {
    if (!form.debitAccountId || !form.creditAccountId || !form.amount || !form.notes) {
      toast({ title: "Required Fields", description: "All fields are mandatory for JV.", variant: "destructive" });
      return;
    }
    if (form.debitAccountId === form.creditAccountId) {
      toast({ title: "Invalid Entry", description: "Debit and Credit accounts must be different.", variant: "destructive" });
      return;
    }

    const drName = accountHeads.find(h => h.id === form.debitAccountId)?.name || '';
    const crName = accountHeads.find(h => h.id === form.creditAccountId)?.name || '';

    const jvData: any = { ...form, debitAccountName: drName, creditAccountName: crName, amount: Number(form.amount), updatedAt: new Date().toISOString() };

    if (editingId) {
      const ref = doc(firestore, 'journal_entries', editingId);
      updateDocumentNonBlocking(ref, jvData);
      toast({ title: "JV Updated", description: "The manual adjustment has been saved." });
    } else {
      const ref = collection(firestore, 'journal_entries');
      addDocumentNonBlocking(ref, { ...jvData, createdAt: new Date().toISOString() });
      toast({ title: "JV Recorded", description: "New journal entry successfully posted." });
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ date: format(new Date(), 'yyyy-MM-dd'), debitAccountId: '', creditAccountId: '', amount: '', notes: '' });
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:mb-4">
        <div><h1 className="text-3xl font-headline font-bold text-accent">Journal Voucher</h1><p className="text-muted-foreground mt-1 font-medium">Post manual adjustments and inter-account transfers.</p></div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl font-bold bg-white gap-2">
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl font-bold bg-white gap-2">
            <FileDown className="w-4 h-4" /> Export PDF
          </Button>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="bg-primary hover:bg-primary/90 text-white rounded-2xl h-12 px-6 font-bold shadow-lg shadow-primary/20"><Plus className="w-5 h-5 mr-2" />New Journal Entry</Button>
        </div>
      </header>

      <div className="relative print:hidden"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search entries by ID, account or narration..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-11 h-12 rounded-2xl bg-white border-none shadow-sm focus-visible:ring-primary/20" /></div>

      <Card className="rounded-[2rem] border-none shadow-sm overflow-hidden bg-white print:shadow-none print:rounded-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow className="bg-secondary/20 hover:bg-secondary/20 border-none"><TableHead className="font-bold py-5 pl-8 text-xs uppercase tracking-wider"><SortTrigger label="Date" sortKey="date" /></TableHead><TableHead className="font-bold text-xs uppercase tracking-wider"><SortTrigger label="JV Ref" sortKey="id" /></TableHead><TableHead className="font-bold text-xs uppercase tracking-wider">Debit Account</TableHead><TableHead className="font-bold text-xs uppercase tracking-wider">Credit Account</TableHead><TableHead className="font-bold text-xs uppercase tracking-wider"><SortTrigger label="Amount" sortKey="amount" /></TableHead><TableHead className="font-bold text-right pr-8 text-xs uppercase tracking-wider print:hidden">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {jvLoading ? (
                <TableRow><TableCell colSpan={6} className="h-64 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : filteredEntries.length > 0 ? (
                filteredEntries.map((entry) => (
                  <TableRow key={entry.id} className="hover:bg-secondary/5 border-b border-secondary/10 group"><TableCell className="py-6 pl-8 font-bold text-sm">{format(new Date(entry.date), 'MMM dd, yyyy')}</TableCell><TableCell><div className="font-black text-sm text-accent">{(entry.id || '').substr(0,8)}</div><div className="text-[10px] text-muted-foreground italic truncate max-w-[150px]">{entry.notes}</div></TableCell><TableCell><Badge className="bg-green-100 text-green-700 border-none rounded-lg text-[9px] font-bold px-2 py-0.5 mb-1 block w-fit">DEBIT</Badge><span className="font-bold text-sm">{entry.debitAccountName}</span></TableCell><TableCell><Badge className="bg-red-100 text-red-700 border-none rounded-lg text-[9px] font-bold px-2 py-0.5 mb-1 block w-fit">CREDIT</Badge><span className="font-bold text-sm">{entry.creditAccountName}</span></TableCell><TableCell><div className="font-black text-lg text-primary">{entry.amount}</div></TableCell><TableCell className="text-right pr-8 print:hidden"><div className="flex justify-end gap-2"><Button variant="ghost" size="icon" onClick={() => handleEdit(entry)} className="rounded-full h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/5"><Edit className="w-4 h-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)} className="rounded-full h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/5"><Trash2 className="w-4 h-4" /></Button></div></TableCell></TableRow>
                ))
              ) : <TableRow><TableCell colSpan={6} className="h-64 text-center"><div className="flex flex-col items-center justify-center space-y-3 opacity-40"><BookText className="w-10 h-10" /><p className="font-bold">No journal entries found.</p></div></TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-lg">
          <DialogHeader><DialogTitle className="text-2xl font-headline flex items-center gap-2"><BookText className="w-6 h-6 text-accent" />{editingId ? 'Edit JV Entry' : 'New Journal Entry'}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-5"><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Posting Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="rounded-xl h-11" /></div><div className="space-y-2"><Label>Amount</Label><Input type="number" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="rounded-xl h-11 font-black text-primary" /></div></div><div className="space-y-4 p-4 bg-secondary/20 rounded-2xl border border-secondary/30"><div className="space-y-2"><Label className="flex items-center gap-2 text-green-700 font-bold"><div className="w-2 h-2 rounded-full bg-green-500" />Account to Debit (+)</Label><Select value={form.debitAccountId} onValueChange={(v) => setForm({ ...form, debitAccountId: v })}><SelectTrigger className="bg-white rounded-xl h-11"><SelectValue placeholder="Select Account" /></SelectTrigger><SelectContent className="rounded-xl max-h-[250px]">{accountHeads.map(h => (<SelectItem key={h.id} value={h.id}><span className="text-[10px] text-muted-foreground mr-2 font-black">[{h.group}]</span>{h.name}</SelectItem>))}</SelectContent></Select></div><div className="flex justify-center -my-2 relative z-10"><div className="p-2 bg-white rounded-full shadow-sm border border-secondary"><ArrowRightLeft className="w-4 h-4 text-muted-foreground rotate-90" /></div></div><div className="space-y-2"><Label className="flex items-center gap-2 text-red-700 font-bold"><div className="w-2 h-2 rounded-full bg-red-500" />Account to Credit (-)</Label><Select value={form.creditAccountId} onValueChange={(v) => setForm({ ...form, creditAccountId: v })}><SelectTrigger className="bg-white rounded-xl h-11"><SelectValue placeholder="Select Account" /></SelectTrigger><SelectContent className="rounded-xl max-h-[250px]">{accountHeads.map(h => (<SelectItem key={h.id} value={h.id}><span className="text-[10px] text-muted-foreground mr-2 font-black">[{h.group}]</span>{h.name}</SelectItem>))}</SelectContent></Select></div></div><div className="space-y-2"><Label>Narration / Notes</Label><Textarea placeholder="Reason for this entry..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl min-h-[80px]" /></div></div><DialogFooter><Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl h-12">Cancel</Button><Button onClick={handleSave} className="bg-accent hover:bg-accent/90 rounded-xl h-12 px-8 font-bold text-white shadow-lg shadow-accent/20">{editingId ? 'Post Changes' : 'Post Journal Entry'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

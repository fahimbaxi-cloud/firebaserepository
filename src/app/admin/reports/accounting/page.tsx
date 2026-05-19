
"use client";

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  Search, 
  FilterX, 
  CalendarDays, 
  ArrowRight, 
  X, 
  BookOpen, 
  User, 
  Landmark, 
  Coins, 
  ArrowLeft, 
  Printer, 
  FileDown, 
  ArrowUpDown, 
  ChevronUp, 
  ChevronDown, 
  BookText, 
  Loader2 
} from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay, isBefore, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Order, Purchase, Payment, CustomerReceipt, GeneralTransaction, JournalEntry, User as BBUser, Supplier, GLAccount } from '@/lib/types';
import { downloadPDF } from '@/lib/pdf-export';

type DetailType = 'sales' | 'purchases' | 'inflow' | 'outflow' | 'ledger-supplier' | 'ledger-customer' | 'ledger-delivery' | 'ledger-cash' | 'ledger-bank' | 'ledger-upi' | 'ledger-capital' | 'ledger-pnl' | null;

interface LedgerRow {
  id: string;
  name: string;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
  type: string;
}

interface TransactionRow {
  date: string;
  ref: string;
  debit: number;
  credit: number;
  balance: number;
  notes?: string;
}

const safeParseDate = (d: any): Date => {
  if (!d) return new Date(0);
  if (d instanceof Date) return d;
  if (typeof d === 'object' && 'seconds' in d) return new Date(d.seconds * 1000);
  if (typeof d === 'string') return parseISO(d);
  return new Date(0);
};

function AccountingReportContent() {
  const [mounted, setMounted] = useState(false);
  const searchParams = useSearchParams();
  const firestore = useFirestore();

  // Firestore Collections with Safe Defaulting
  const { data: ordersData, isLoading: ordersLoading } = useCollection<Order>(useMemoFirebase(() => collection(firestore, 'orders'), [firestore]));
  const orders = ordersData || [];

  const { data: purchasesData } = useCollection<Purchase>(useMemoFirebase(() => collection(firestore, 'purchases'), [firestore]));
  const purchases = purchasesData || [];

  const { data: paymentsData } = useCollection<Payment>(useMemoFirebase(() => collection(firestore, 'payments'), [firestore]));
  const payments = paymentsData || [];

  const { data: receiptsData } = useCollection<CustomerReceipt>(useMemoFirebase(() => collection(firestore, 'receipts'), [firestore]));
  const receipts = receiptsData || [];

  const { data: transactionsData } = useCollection<GeneralTransaction>(useMemoFirebase(() => collection(firestore, 'general_transactions'), [firestore]));
  const transactions = transactionsData || [];

  const { data: journalEntriesData } = useCollection<JournalEntry>(useMemoFirebase(() => collection(firestore, 'journal_entries'), [firestore]));
  const journalEntries = journalEntriesData || [];

  const { data: usersData } = useCollection<BBUser>(useMemoFirebase(() => collection(firestore, 'users'), [firestore]));
  const users = usersData || [];

  const { data: suppliersData } = useCollection<Supplier>(useMemoFirebase(() => collection(firestore, 'suppliers'), [firestore]));
  const suppliers = suppliersData || [];

  const { data: glAccountsData } = useCollection<GLAccount>(useMemoFirebase(() => collection(firestore, 'gl_accounts'), [firestore]));
  const glAccounts = glAccountsData || [];

  const [activeDetail, setActiveDetail] = useState<DetailType>(null);
  const [selectedLedgerEntityId, setSelectedLedgerEntityId] = useState<string | null>(null);
  const [selectedLedgerEntityName, setSelectedLedgerEntityName] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: '', direction: null });

  useEffect(() => { setMounted(true); }, []);

  // Handle incoming query params
  useEffect(() => {
    const typeParam = searchParams.get('type');
    const entityIdParam = searchParams.get('entityId');
    if (typeParam) {
      setActiveDetail(typeParam as DetailType);
    }
    if (entityIdParam) {
      setSelectedLedgerEntityId(entityIdParam);
    }
  }, [searchParams]);

  const handlePrint = () => { window.print(); };

  const handleExportPDF = () => {
    let title = "Accounting Report";
    let head: string[][] = [];
    let body: any[][] = [];

    if (selectedLedgerEntityId && dailyLedgerView) {
      title = `Ledger: ${selectedLedgerEntityName}`;
      head = [['Date', 'Ref', 'Description', 'Debit', 'Credit', 'Balance']];
      body = [
        ['-', '-', 'OPENING BALANCE', '-', '-', dailyLedgerView.openingBalance.toFixed(2)],
        ...dailyLedgerView.transactions.map(t => [t.date, t.ref, t.notes, t.debit || '-', t.credit || '-', t.balance.toFixed(2)]),
        ['-', '-', 'CLOSING BALANCE', '-', '-', dailyLedgerView.closingBalance.toFixed(2)]
      ];
    } else if (activeDetail?.startsWith('ledger-')) {
      title = `${activeDetail.replace('ledger-', '').toUpperCase()} Ledger Summary`;
      head = [['Account', 'Opening', 'Debit', 'Credit', 'Closing']];
      body = ledgerData.map(l => [l.name, l.opening.toFixed(2), l.debit.toFixed(2), l.credit.toFixed(2), l.closing.toFixed(2)]);
    } else if (activeDetail) {
      title = `${activeDetail.toUpperCase()} Transaction List`;
      head = [['Date', 'ID', 'Name', 'Amt', 'Status']];
      body = drillDownData.map(d => [d.date, d.id, d.name, d.amount, d.status]);
    }

    downloadPDF(title, head, body, "accounting_report");
  };

  const handleSort = (key: string) => { setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' })); };
  const clearFilters = () => { setSearchTerm(''); setStartDate(''); setEndDate(''); setSortConfig({ key: '', direction: null }); };

  const SortTrigger = ({ label, sortKey, className }: { label: string, sortKey: string, className?: string }) => (
    <div className={cn("flex items-center gap-1 cursor-pointer group select-none", className)} onClick={() => handleSort(sortKey)}>
      <span className="group-hover:text-primary transition-colors">{label}</span>
      {sortConfig.key === sortKey ? (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />) : <ArrowUpDown className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary" />}
    </div>
  );

  const accountingSummary = useMemo(() => {
    const totalSales = orders.filter(o => o.status !== 'Cancelled').reduce((sum, o) => sum + o.total, 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const totalCashInflow = receipts.reduce((sum, r) => sum + r.amount, 0) + transactions.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
    const totalCashOutflow = payments.reduce((sum, p) => sum + p.amount, 0) + transactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0);
    return { totalSales, totalPurchases, totalCashInflow, totalCashOutflow };
  }, [orders, purchases, receipts, transactions, payments]);

  const drillDownData = useMemo(() => {
    if (!activeDetail || activeDetail.startsWith('ledger-')) return [];
    let raw: any[] = [];
    switch (activeDetail) {
      case 'sales': raw = orders.map(o => ({ id: o.id, name: o.customerName, date: safeParseDate(o.createdAt).toISOString().split('T')[0], amount: o.total, status: o.status })); break;
      case 'purchases': raw = purchases.map(p => ({ id: p.id, name: suppliers.find(s => s.id === p.supplierId)?.name || 'Unknown', date: p.date, amount: p.totalAmount, status: p.status })); break;
      case 'inflow': raw = [...receipts.map(r => ({ id: r.id, name: r.customerName, date: r.date, amount: r.amount, status: 'Settled', ref: r.paymentMethod })), ...transactions.filter(t => t.type === 'Income').map(t => ({ id: t.id, name: t.categoryName, date: t.date, amount: t.amount, status: 'Income', ref: t.paymentMethod }))]; break;
      case 'outflow': raw = [...payments.map(p => ({ id: p.id, name: p.supplierName, date: p.date, amount: p.amount, status: 'Paid', ref: p.paymentMethod })), ...transactions.filter(t => t.type === 'Expense').map(t => ({ id: t.id, name: t.categoryName, date: t.date, amount: t.amount, status: 'Expense', ref: t.paymentMethod }))]; break;
    }

    const filtered = raw.filter(item => {
      const partyName = (item.name || '').toLowerCase();
      const partyId = (item.id || '').toLowerCase();
      const query = searchTerm.toLowerCase();
      const matchSearch = partyName.includes(query) || partyId.includes(query);
      const itemDate = safeParseDate(item.date);
      const matchRange = (!startDate || itemDate >= startOfDay(parseISO(startDate))) && (!endDate || itemDate <= endOfDay(parseISO(endDate)));
      return matchSearch && matchRange;
    });

    if (sortConfig.key && sortConfig.direction) {
      filtered.sort((a, b) => {
        const valA = (a as any)[sortConfig.key];
        const valB = (b as any)[sortConfig.key];
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [activeDetail, searchTerm, startDate, endDate, orders, purchases, suppliers, receipts, transactions, payments, sortConfig]);

  const ledgerData = useMemo(() => {
    if (!activeDetail?.startsWith('ledger-')) return [];
    const type = activeDetail.replace('ledger-', '');
    const startFilter = startDate ? startOfDay(parseISO(startDate)) : null;
    const endFilter = endDate ? endOfDay(parseISO(endDate)) : null;
    let rows: LedgerRow[] = [];

    const isInRange = (d: any) => { const dt = safeParseDate(d); return (!startFilter || !isBefore(dt, startFilter)) && (!endFilter || !isAfter(dt, endFilter)); };
    const isBeforeP = (d: any) => { const dt = safeParseDate(d); return startFilter && isBefore(dt, startFilter); };

    if (type === 'supplier') {
      rows = suppliers.map(s => {
        let op = 0, dr = 0, cr = 0;
        purchases.filter(p => p.supplierId === s.id).forEach(p => { if (isBeforeP(p.date)) op += p.totalAmount; else if (isInRange(p.date)) cr += p.totalAmount; });
        payments.filter(p => p.supplierId === s.id).forEach(p => { if (isBeforeP(p.date)) op -= p.amount; else if (isInRange(p.date)) dr += p.amount; });
        return { id: s.id, name: s.name, opening: op, debit: dr, credit: cr, closing: op + cr - dr, type: 'Supplier' };
      });
    } else if (type === 'customer') {
      rows = users.filter(u => u.role === 'customer').map(c => {
        let op = 0, dr = 0, cr = 0;
        orders.filter(o => o.customerId === c.id && o.status !== 'Cancelled').forEach(o => { if (isBeforeP(o.createdAt)) op += o.total; else if (isInRange(o.createdAt)) dr += o.total; });
        receipts.filter(r => r.customerId === c.id).forEach(r => { if (isBeforeP(r.date)) op -= r.amount; else if (isInRange(r.date)) cr += r.amount; });
        return { id: c.id, name: `${c.firstName} ${c.lastName}`, opening: op, debit: dr, credit: cr, closing: op + dr - cr, type: 'Customer' };
      });
    } else if (type === 'delivery') {
      rows = users.filter(u => u.role === 'delivery').map(d => {
        let dr = 0; orders.filter(o => o.assignedTo === d.id && o.status === 'Delivered').forEach(o => { if (isInRange(o.createdAt)) dr += o.total; });
        return { id: d.id, name: `${d.firstName} ${d.lastName}`, opening: 0, debit: dr, credit: 0, closing: dr, type: 'Delivery Partner' };
      });
    } else {
      const heads = glAccounts.filter(a => a.group.toLowerCase() === type || type === 'gl');
      rows = heads.map(a => {
        let op = Number(a.openingBalance || 0); if (a.openingType === 'Credit') op = -op;
        let dr = 0, cr = 0;
        journalEntries.filter(j => j.debitAccountId === a.id || j.creditAccountId === a.id).forEach(j => {
           if (isInRange(j.date)) { if (j.debitAccountId === a.id) dr += j.amount; else cr += j.amount; }
           else if (isBeforeP(j.date)) { op += (j.debitAccountId === a.id ? j.amount : -j.amount); }
        });
        return { id: a.id, name: a.name, opening: op, debit: dr, credit: cr, closing: op + dr - cr, type: a.group };
      });
    }

    const filtered = rows.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (sortConfig.key && sortConfig.direction) {
      filtered.sort((a, b) => {
        const valA = (a as any)[sortConfig.key];
        const valB = (b as any)[sortConfig.key];
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [activeDetail, searchTerm, startDate, endDate, suppliers, purchases, payments, journalEntries, users, orders, receipts, glAccounts, sortConfig]);

  const dailyLedgerView = useMemo(() => {
    if (!selectedLedgerEntityId || !activeDetail) return null;
    const type = activeDetail.replace('ledger-', '');
    let txs: Omit<TransactionRow, 'balance'>[] = [];
    if (type === 'supplier') {
      purchases.filter(p => p.supplierId === selectedLedgerEntityId).forEach(p => txs.push({ date: p.date, ref: p.id, debit: 0, credit: p.totalAmount, notes: 'Purchase' }));
      payments.filter(p => p.supplierId === selectedLedgerEntityId).forEach(p => txs.push({ date: p.date, ref: p.id, debit: p.amount, credit: 0, notes: p.paymentMethod }));
    } else if (type === 'customer') {
      orders.filter(o => o.customerId === selectedLedgerEntityId && o.status !== 'Cancelled').forEach(o => txs.push({ date: safeParseDate(o.createdAt).toISOString().split('T')[0], ref: o.id, debit: o.total, credit: 0, notes: 'Order Sales' }));
      receipts.filter(r => r.customerId === selectedLedgerEntityId).forEach(r => txs.push({ date: r.date, ref: r.id, debit: 0, credit: r.amount, notes: r.paymentMethod }));
    } else {
      journalEntries.filter(j => j.debitAccountId === selectedLedgerEntityId || j.creditAccountId === selectedLedgerEntityId).forEach(j => txs.push({ date: j.date, ref: j.id, debit: j.debitAccountId === selectedLedgerEntityId ? j.amount : 0, credit: j.creditAccountId === selectedLedgerEntityId ? j.amount : 0, notes: j.notes }));
    }
    txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let op = 0; const rangeTxs: TransactionRow[] = []; const isSup = type === 'supplier';
    txs.forEach(t => {
      const imp = isSup ? (t.credit - t.debit) : (t.debit - t.credit);
      if (startDate && isBefore(safeParseDate(t.date), startOfDay(parseISO(startDate)))) op += imp;
      else if ((!startDate || !isBefore(safeParseDate(t.date), startOfDay(parseISO(startDate)))) && (!endDate || !isAfter(safeParseDate(t.date), endOfDay(parseISO(endDate))))) {
        const bal = (rangeTxs.length === 0 ? op : rangeTxs[rangeTxs.length - 1].balance) + imp;
        rangeTxs.push({ ...t, balance: bal });
      }
    });

    if (sortConfig.key && sortConfig.direction) {
      rangeTxs.sort((a, b) => {
        const valA = (a as any)[sortConfig.key];
        const valB = (b as any)[sortConfig.key];
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return { transactions: rangeTxs, openingBalance: op, closingBalance: op + rangeTxs.reduce((s, t) => s + (isSup ? (t.credit - t.debit) : (t.debit - t.credit)), 0) };
  }, [selectedLedgerEntityId, activeDetail, startDate, endDate, purchases, payments, orders, receipts, journalEntries, sortConfig]);

  // Set the entity name when an ID is selected (especially via query params)
  useEffect(() => {
    if (selectedLedgerEntityId && ledgerData.length > 0) {
      const item = ledgerData.find(l => l.id === selectedLedgerEntityId);
      if (item) {
        setSelectedLedgerEntityName(item.name);
      }
    }
  }, [selectedLedgerEntityId, ledgerData]);

  const handleCardClick = (type: DetailType) => {
    setActiveDetail(type); setSelectedLedgerEntityId(null); clearFilters();
    setTimeout(() => document.getElementById('accounting-drill-down')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleLedgerRowClick = (row: LedgerRow) => {
    setSelectedLedgerEntityId(row.id); setSelectedLedgerEntityName(row.name);
    setTimeout(() => document.getElementById('daily-ledger-view')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  if (ordersLoading && orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Accounting Engine Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-headline font-bold text-accent">Accounting Reports</h1>
        <p className="text-muted-foreground mt-1 font-medium">Financial performance and interactive account ledgers.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="rounded-[2rem] border-none bg-white shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="p-5 pb-2 bg-accent/5"><CardTitle className="text-xs font-black uppercase text-accent tracking-widest flex items-center gap-2"><BookOpen className="w-4 h-4" />Finance Hub</CardTitle></CardHeader>
          <CardContent className="p-4 pt-2 flex flex-col gap-1.5 flex-1">
            <div className="grid grid-cols-2 gap-1.5">
              {(['supplier', 'customer', 'delivery', 'cash', 'bank', 'upi', 'capital', 'pnl'] as const).map(l => (
                <Button key={l} variant="ghost" size="sm" onClick={() => handleCardClick(`ledger-${l}`)} className={cn("justify-start h-8 px-2 text-[10px] font-black rounded-lg hover:bg-secondary/50 capitalize", activeDetail === `ledger-${l}` && "bg-secondary text-accent")}>{l}</Button>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card onClick={() => handleCardClick('sales')} className={cn("rounded-[2rem] border-2 cursor-pointer transition-all", activeDetail === 'sales' ? "border-primary bg-primary/5" : "border-transparent bg-white")}>
          <CardContent className="p-6"><div className="flex justify-between items-start mb-6"><div className="p-3 bg-green-100 rounded-2xl text-green-600"><TrendingUp className="w-6 h-6" /></div><p className="text-2xl font-black">{accountingSummary.totalSales}</p></div><Badge className="bg-green-100 text-green-700 text-[9px] border-none uppercase">Sales</Badge></CardContent>
        </Card>
        <Card onClick={() => handleCardClick('purchases')} className={cn("rounded-[2rem] border-2 cursor-pointer transition-all", activeDetail === 'purchases' ? "border-primary bg-primary/5" : "border-transparent bg-white")}>
          <CardContent className="p-6"><div className="flex justify-between items-start mb-6"><div className="p-3 bg-red-100 rounded-2xl text-red-600"><TrendingDown className="w-6 h-6" /></div><p className="text-2xl font-black">{accountingSummary.totalPurchases}</p></div><Badge className="bg-red-100 text-red-700 text-[9px] border-none uppercase">Purchases</Badge></CardContent>
        </Card>
        <Card onClick={() => handleCardClick('inflow')} className={cn("rounded-[2rem] border-2 cursor-pointer transition-all", activeDetail === 'inflow' ? "border-primary bg-primary/5" : "border-transparent bg-white")}>
          <CardContent className="p-6"><div className="flex justify-between items-start mb-6"><div className="p-3 bg-blue-100 rounded-2xl text-blue-600"><Wallet className="w-6 h-6" /></div><p className="text-2xl font-black">{accountingSummary.totalCashInflow}</p></div><Badge className="bg-blue-100 text-blue-700 text-[9px] border-none uppercase">Inflow</Badge></CardContent>
        </Card>
        <Card onClick={() => handleCardClick('outflow')} className={cn("rounded-[2rem] border-2 cursor-pointer transition-all", activeDetail === 'outflow' ? "border-primary bg-primary/5" : "border-transparent bg-white")}>
          <CardContent className="p-6"><div className="flex justify-between items-start mb-6"><div className="p-3 bg-orange-100 rounded-2xl text-orange-600"><CreditCard className="w-6 h-6" /></div><p className="text-2xl font-black">{accountingSummary.totalCashOutflow}</p></div><Badge className="bg-orange-100 text-orange-700 text-[9px] border-none uppercase">Outflow</Badge></CardContent>
        </Card>
      </div>

      {activeDetail && (
        <div id="accounting-drill-down" className="space-y-6 animate-in slide-in-from-top-4 duration-500">
          <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white">
            <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                {selectedLedgerEntityId && <Button variant="ghost" size="icon" onClick={() => setSelectedLedgerEntityId(null)} className="rounded-full bg-white shadow-sm h-10 w-10"><ArrowLeft className="w-5 h-5" /></Button>}
                <CardTitle className="text-2xl font-headline font-bold capitalize">{selectedLedgerEntityId ? selectedLedgerEntityName : `${activeDetail.replace('ledger-', '')} List`}</CardTitle>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl gap-2 font-bold bg-white"><Printer className="w-4 h-4 mr-2" /> Print</Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl gap-2 font-bold bg-white"><FileDown className="w-4 h-4 mr-2" /> Export PDF</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!selectedLedgerEntityId ? (
                <>
                  <div className="p-8 pt-0 flex flex-col lg:flex-row gap-4 print:hidden">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="Search records..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-11 h-12 rounded-2xl bg-secondary/20 border-none" />
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-1 rounded-2xl shadow-sm border border-secondary/20">
                      <div className="flex items-center gap-2 px-3 h-10"><CalendarDays className="w-4 h-4 text-muted-foreground" /><span className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Period</span></div>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 border-none bg-secondary/20 rounded-xl text-xs w-full sm:w-32" />
                      <span className="text-muted-foreground text-xs font-bold">to</span>
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 border-none bg-secondary/20 rounded-xl text-xs w-full sm:w-32" />
                      {(startDate || endDate || searchTerm) && <Button variant="ghost" size="icon" onClick={clearFilters} className="h-10 w-10 text-muted-foreground hover:text-destructive"><FilterX className="w-4 h-4" /></Button>}
                    </div>
                  </div>
                  {activeDetail.startsWith('ledger-') ? (
                    <Table>
                      <TableHeader><TableRow className="bg-secondary/20"><TableHead className="pl-8 py-5"><SortTrigger label="Account Name" sortKey="name" /></TableHead><TableHead className="text-right"><SortTrigger label="Opening" sortKey="opening" /></TableHead><TableHead className="text-right"><SortTrigger label="Debit" sortKey="debit" /></TableHead><TableHead className="text-right"><SortTrigger label="Credit" sortKey="credit" /></TableHead><TableHead className="pr-8 text-right"><SortTrigger label="Closing" sortKey="closing" /></TableHead></TableRow></TableHeader>
                      <TableBody>{ledgerData.map((row, i) => (<TableRow key={i} className="hover:bg-primary/5 cursor-pointer border-b border-secondary/10" onClick={() => handleLedgerRowClick(row)}><TableCell className="py-6 pl-8"><div className="font-bold text-sm group flex items-center gap-2">{row.name} <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 print:hidden" /></div><div className="text-[10px] text-muted-foreground font-bold">{row.type}</div></TableCell><TableCell className="text-right font-black">{(row.opening || 0).toFixed(2)}</TableCell><TableCell className="text-right font-black text-green-600">{(row.debit || 0).toFixed(2)}</TableCell><TableCell className="text-right font-black text-red-600">{(row.credit || 0).toFixed(2)}</TableCell><TableCell className="pr-8 text-right"><div className={cn("font-black text-lg", row.closing >= 0 ? "text-primary" : "text-destructive")}>{(Math.abs(row.closing) || 0).toFixed(2)}<span className="text-[10px] ml-1 uppercase">{row.closing >= 0 ? 'DR' : 'CR'}</span></div></TableCell></TableRow>))}</TableBody>
                    </Table>
                  ) : (
                    <Table>
                      <TableHeader><TableRow className="bg-secondary/20"><TableHead className="pl-8 py-5"><SortTrigger label="Date" sortKey="date" /></TableHead><TableHead><SortTrigger label="Party Name" sortKey="name" /></TableHead><TableHead><SortTrigger label="Reference" sortKey="id" /></TableHead><TableHead className="text-right"><SortTrigger label="Amount" sortKey="amount" /></TableHead><TableHead className="pr-8 text-right"><SortTrigger label="Status" sortKey="status" /></TableHead></TableRow></TableHeader>
                      <TableBody>{drillDownData.map((item, i) => (
                        <TableRow key={i} className="hover:bg-secondary/5 border-b border-secondary/10">
                          <TableCell className="py-6 pl-8 font-medium">{item.date}</TableCell>
                          <TableCell className="font-bold text-sm">{item.name}</TableCell>
                          <TableCell className="font-black text-[10px] uppercase text-accent">{item.id}</TableCell>
                          <TableCell className="text-right font-black text-lg text-primary">{item.amount}</TableCell>
                          <TableCell className="pr-8 text-right"><Badge variant="outline" className="text-[9px] uppercase">{item.status}</Badge></TableCell>
                        </TableRow>
                      ))}</TableBody>
                    </Table>
                  )}
                </>
              ) : (
                <div id="daily-ledger-view" className="animate-in slide-in-from-right-4 duration-300"><Table><TableHeader><TableRow className="bg-secondary/10"><TableHead className="pl-8 py-5"><SortTrigger label="Date" sortKey="date" /></TableHead><TableHead><SortTrigger label="Ref" sortKey="ref" /></TableHead><TableHead>Description</TableHead><TableHead className="text-right"><SortTrigger label="Debit" sortKey="debit" /></TableHead><TableHead className="text-right"><SortTrigger label="Credit" sortKey="credit" /></TableHead><TableHead className="pr-8 text-right"><SortTrigger label="Balance" sortKey="balance" /></TableHead></TableRow></TableHeader><TableBody><TableRow className="bg-secondary/5 font-bold italic"><TableCell className="pl-8 py-5">Start</TableCell><TableCell>-</TableCell><TableCell>OPENING BALANCE</TableCell><TableCell className="text-right">-</TableCell><TableCell className="text-right">-</TableCell><TableCell className="text-right pr-8">{(dailyLedgerView?.openingBalance || 0).toFixed(2)}</TableCell></TableRow>{dailyLedgerView?.transactions.map((t, idx) => (<TableRow key={idx} className="border-b"><TableCell className="pl-8 py-4">{t.date}</TableCell><TableCell className="font-black text-xs">{t.ref}</TableCell><TableCell className="text-xs font-bold">{t.notes}</TableCell><TableCell className="text-right text-green-600">{t.debit > 0 ? t.debit.toFixed(2) : '-'}</TableCell><TableCell className="text-right text-red-600">{t.credit > 0 ? t.credit.toFixed(2) : '-'}</TableCell><TableCell className="pr-8 text-right font-black">{t.balance.toFixed(2)}</TableCell></TableRow>))}<TableRow className="bg-primary/5 font-black"><TableCell className="pl-8 py-5">End</TableCell><TableCell>-</TableCell><TableCell>CLOSING BALANCE</TableCell><TableCell className="text-right">-</TableCell><TableCell className="text-right">-</TableCell><TableCell className="text-right pr-8 text-xl">{(dailyLedgerView?.closingBalance || 0).toFixed(2)}</TableCell></TableRow></TableBody></Table></div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function AccountingReportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
      <AccountingReportContent />
    </Suspense>
  );
}

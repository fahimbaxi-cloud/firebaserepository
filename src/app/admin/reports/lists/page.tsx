
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Wallet, 
  Search, 
  FilterX, 
  CalendarDays, 
  X, 
  User, 
  Truck, 
  Package, 
  UserCircle, 
  Users, 
  ReceiptText, 
  ClipboardList, 
  ShoppingCart, 
  LayoutGrid, 
  Printer, 
  FileDown, 
  ArrowUpDown, 
  ChevronUp, 
  ChevronDown, 
  Calculator, 
  BookText, 
  Loader2, 
  MapPin,
  Clock,
  Phone,
  ZoomIn,
  Factory,
  Utensils,
  History,
  CreditCard,
  ArrowRight,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay, isBefore, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Order, Purchase, Payment, CustomerReceipt, ManufacturingLog, GeneralTransaction, JournalEntry, RawItem, User as BBUser, Supplier, Category, Unit, BroadcastPackage, MenuItem, GLAccount, ExpenseCategory, IncomeCategory } from '@/lib/types';
import { downloadPDF } from '@/lib/pdf-export';

type LogType = 'items' | 'packages' | 'orders' | 'order-summary' | 'suppliers' | 'customers' | 'delivery' | 'mfg-logs' | 'payments' | 'receipts' | 'transactions' | 'trial-balance' | 'journal' | 'menu-master' | null;

const safeParseDate = (d: any): Date => {
  if (!d) return new Date(0);
  if (d instanceof Date) return d;
  if (typeof d === 'object' && 'seconds' in d) return new Date(d.seconds * 1000);
  if (typeof d === 'string') return parseISO(d);
  return new Date(0);
};

const FilterInput = ({ placeholder, value, onChange }: { placeholder: string, value: string, onChange: (v: string) => void }) => (
  <Input
    placeholder={placeholder}
    value={value || ''}
    onChange={(e) => onChange(e.target.value)}
    className="h-7 text-[10px] px-2 rounded-md bg-white/50 border-none placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/30 mt-1 print:hidden font-normal normal-case tracking-normal"
  />
);

export default function ListsReportPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const firestore = useFirestore();

  // Firestore Collections
  const { data: ordersData = [] } = useCollection<Order>(useMemoFirebase(() => collection(firestore, 'orders'), [firestore]));
  const orders = ordersData || [];

  const { data: purchasesData = [] } = useCollection<Purchase>(useMemoFirebase(() => collection(firestore, 'purchases'), [firestore]));
  const purchases = purchasesData || [];

  const { data: paymentsData = [] } = useCollection<Payment>(useMemoFirebase(() => collection(firestore, 'payments'), [firestore]));
  const payments = paymentsData || [];

  const { data: receiptsData = [] } = useCollection<CustomerReceipt>(useMemoFirebase(() => collection(firestore, 'receipts'), [firestore]));
  const receipts = receiptsData || [];

  const { data: mfgLogsData = [] } = useCollection<ManufacturingLog>(useMemoFirebase(() => collection(firestore, 'manufacturing_logs'), [firestore]));
  const mfgLogs = mfgLogsData || [];

  const { data: transactionsData = [] } = useCollection<GeneralTransaction>(useMemoFirebase(() => collection(firestore, 'general_transactions'), [firestore]));
  const transactions = transactionsData || [];

  const { data: journalEntriesData = [] } = useCollection<JournalEntry>(useMemoFirebase(() => collection(firestore, 'journal_entries'), [firestore]));
  const journalEntries = journalEntriesData || [];

  const { data: rawItemsData = [] } = useCollection<RawItem>(useMemoFirebase(() => collection(firestore, 'raw_items'), [firestore]));
  const rawItems = rawItemsData || [];

  const { data: usersData = [] } = useCollection<BBUser>(useMemoFirebase(() => collection(firestore, 'users'), [firestore]));
  const users = usersData || [];

  const { data: suppliersData = [] } = useCollection<Supplier>(useMemoFirebase(() => collection(firestore, 'suppliers'), [firestore]));
  const suppliers = suppliersData || [];

  const { data: categoriesData = [] } = useCollection<Category>(useMemoFirebase(() => collection(firestore, 'categories'), [firestore]));
  const categories = categoriesData || [];

  const { data: unitsData = [] } = useCollection<Unit>(useMemoFirebase(() => collection(firestore, 'units'), [firestore]));
  const units = unitsData || [];

  const { data: packagesData = [] } = useCollection<any>(useMemoFirebase(() => collection(firestore, 'packages'), [firestore]));
  const packages = packagesData || [];

  const { data: menuData = [] } = useCollection<MenuItem>(useMemoFirebase(() => collection(firestore, 'menu_items'), [firestore]));
  const menu = menuData || [];

  const { data: glAccountsData = [] } = useCollection<GLAccount>(useMemoFirebase(() => collection(firestore, 'gl_accounts'), [firestore]));
  const glAccounts = glAccountsData || [];

  const { data: exCatsData = [] } = useCollection<ExpenseCategory>(useMemoFirebase(() => collection(firestore, 'expense_categories'), [firestore]));
  const expenseCats = exCatsData || [];

  const { data: inCatsData = [] } = useCollection<IncomeCategory>(useMemoFirebase(() => collection(firestore, 'income_categories'), [firestore]));
  const incomeCats = inCatsData || [];

  const [activeLogType, setActiveLogType] = useState<LogType>(null);
  const [selectedMasterRecord, setSelectedMasterRecord] = useState<any>(null);
  const [isMasterDetailOpen, setIsMasterDetailOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: '', direction: null });

  useEffect(() => { setMounted(true); }, []);

  const handlePrint = () => { window.print(); };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const SortTrigger = ({ label, sortKey, className }: { label: string, sortKey: string, className?: string }) => (
    <div 
      className={cn("flex items-center gap-1 cursor-pointer group select-none", className)}
      onClick={() => handleSort(sortKey)}
    >
      <span className="group-hover:text-primary transition-colors">{label}</span>
      {sortConfig.key === sortKey ? (
        sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
      ) : (
        <ArrowUpDown className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary" />
      )}
    </div>
  );

  const getComputedItemStock = (rawItemId: string, upToDate?: string) => {
    const item = rawItems.find(ri => ri.id === rawItemId);
    if (!item) return { qty: 0, value: 0, unit: '' };
    const unit = units.find(u => u.id === item.baseUnitId);
    
    let qty = Number(item.openingStock || 0);
    let val = Number(item.openingValue || 0);
    let wac = qty > 0 ? val / qty : 0;
    
    const cutoff = upToDate ? endOfDay(parseISO(upToDate)) : null;
    const movements: any[] = [];
    
    purchases.filter(p => p.status === 'Received').forEach(p => {
      const pDate = safeParseDate(p.date);
      if (cutoff && isAfter(pDate, cutoff)) return;
      const i = p.items?.find((x: any) => x.rawItemId === rawItemId);
      if (i) movements.push({ date: p.date, type: 'In', qty: Number(i.quantity), rate: Number(i.rate), amount: Number(i.amount) });
    });
    mfgLogs.forEach(l => {
      const lDate = safeParseDate(l.date);
      if (cutoff && isAfter(lDate, cutoff)) return;
      const i = l.ingredientsUsed?.find((x: any) => x.rawItemId === rawItemId);
      if (i) movements.push({ date: l.date.split('T')[0], type: 'Out', qty: Number(i.quantity) });
    });

    movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    movements.forEach(m => {
      if (m.type === 'In') {
        const prevQty = qty;
        qty += m.qty;
        if (prevQty <= 0) wac = m.rate; else wac = (val + m.amount) / qty;
        val += m.amount;
      } else {
        qty -= m.qty;
        val = qty * wac;
      }
    });
    return { qty: Math.max(0, qty), value: Math.max(0, val), unit: unit?.name || '' };
  };

  const handleColFilterChange = (key: string, val: string) => {
    setColFilters(prev => ({ ...prev, [key]: val }));
  };

  const logTableData = useMemo(() => {
    if (!activeLogType) return [];
    let data: any[] = [];

    const asOfEnd = (d: any) => {
      const dt = safeParseDate(d);
      if (endDate && isAfter(dt, endOfDay(parseISO(endDate)))) return false;
      return true;
    };

    switch (activeLogType) {
      case 'items': data = rawItems.map(i => ({ ...i, category: categories.find(c => c.id === i.categoryId)?.name || 'Unknown', unit: units.find(u => u.id === i.baseUnitId)?.name || '' })); break;
      case 'packages': data = packages; break;
      case 'orders': 
      case 'order-summary': data = orders.map(o => ({ ...o, date: safeParseDate(o.createdAt).toISOString().split('T')[0] })); break;
      case 'suppliers': data = suppliers; break;
      case 'customers': data = users.filter(u => u.role === 'customer'); break;
      case 'delivery': data = users.filter(u => u.role === 'delivery'); break;
      case 'mfg-logs': data = mfgLogs; break;
      case 'payments': data = payments; break;
      case 'receipts': data = receipts; break;
      case 'transactions': data = transactions; break;
      case 'journal': data = journalEntries; break;
      case 'menu-master': data = menu; break;
      case 'trial-balance':
        const customersSummary = users.filter(u => u.role === 'customer').map(c => {
          const dr = orders.filter(o => o.customerId === c.id && o.status !== 'Cancelled' && asOfEnd(o.createdAt)).reduce((s, o) => s + o.total, 0) +
                     journalEntries.filter(j => j.debitAccountId === c.id && asOfEnd(j.date)).reduce((s, j) => s + j.amount, 0);
          const cr = receipts.filter(r => r.customerId === c.id && asOfEnd(r.date)).reduce((s, r) => s + r.amount, 0) +
                     journalEntries.filter(j => j.creditAccountId === c.id && asOfEnd(j.date)).reduce((s, j) => s + j.amount, 0);
          const bal = dr - cr;
          return { id: c.id, name: `${c.firstName} ${c.lastName} (Customer)`, debit: Math.max(0, bal), credit: Math.max(0, -bal), ledgerType: 'ledger-customer', entityId: c.id };
        });

        const suppliersSummary = suppliers.map(s => {
          const dr = payments.filter(p => p.supplierId === s.id && asOfEnd(p.date)).reduce((sum, p) => sum + p.amount, 0) +
                     journalEntries.filter(j => j.debitAccountId === s.id && asOfEnd(j.date)).reduce((s, j) => s + j.amount, 0);
          const cr = purchases.filter(p => p.supplierId === s.id && asOfEnd(p.date)).reduce((sum, p) => sum + p.totalAmount, 0) +
                     journalEntries.filter(j => j.creditAccountId === s.id && asOfEnd(j.date)).reduce((s, j) => s + j.amount, 0);
          const bal = dr - cr;
          return { id: s.id, name: `${s.name} (Supplier)`, debit: Math.max(0, bal), credit: Math.max(0, -bal), ledgerType: 'ledger-supplier', entityId: s.id };
        });

        const glSummary = glAccounts.map(acc => {
          let bal = acc.openingType === 'Debit' ? acc.openingBalance : -acc.openingBalance;
          const methodMap: Record<string, string> = { Cash: 'CASH', 'Bank Transfer': 'BANK', UPI: 'UPI' };
          const accCode = acc.id.toUpperCase();
          if (['CASH', 'BANK', 'UPI'].includes(accCode)) {
            const label = accCode === 'CASH' ? 'Cash' : accCode === 'BANK' ? 'Bank Transfer' : 'UPI';
            const inflow = receipts.filter(r => r.paymentMethod === label && asOfEnd(r.date)).reduce((s, r) => s + r.amount, 0) +
                           transactions.filter(t => t.type === 'Income' && t.paymentMethod === label && asOfEnd(t.date)).reduce((s, t) => s + t.amount, 0);
            const outflow = payments.filter(p => p.paymentMethod === label && asOfEnd(p.date)).reduce((s, p) => s + p.amount, 0) +
                            transactions.filter(t => t.type === 'Expense' && t.paymentMethod === label && asOfEnd(t.date)).reduce((s, t) => s + t.amount, 0);
            bal += (inflow - outflow);
          }
          const jvImpact = journalEntries.filter(j => (j.debitAccountId === acc.id || j.creditAccountId === acc.id) && asOfEnd(j.date))
                            .reduce((sum, j) => sum + (j.debitAccountId === acc.id ? j.amount : -j.amount), 0);
          bal += jvImpact;
          return { id: acc.id, name: `${acc.name} (${acc.group})`, debit: Math.max(0, bal), credit: Math.max(0, -bal), ledgerType: `ledger-${acc.group.toLowerCase()}`, entityId: acc.id };
        });

        const expensesSummary = expenseCats.map(cat => {
          const dr = transactions.filter(t => t.categoryId === cat.id && t.type === 'Expense' && asOfEnd(t.date)).reduce((s, t) => s + t.amount, 0) +
                     journalEntries.filter(j => j.debitAccountId === cat.id && asOfEnd(j.date)).reduce((s, j) => s + j.amount, 0);
          const cr = journalEntries.filter(j => j.creditAccountId === cat.id && asOfEnd(j.date)).reduce((s, j) => s + j.amount, 0);
          const bal = dr - cr;
          return { id: cat.id, name: `${cat.name} (Expense)`, debit: Math.max(0, bal), credit: Math.max(0, -bal), ledgerType: 'ledger-pnl', entityId: 'PNL' };
        });

        const incomesSummary = incomeCats.map(cat => {
          const cr = transactions.filter(t => t.categoryId === cat.id && t.type === 'Income' && asOfEnd(t.date)).reduce((s, t) => s + t.amount, 0) +
                     journalEntries.filter(j => j.creditAccountId === cat.id && asOfEnd(j.date)).reduce((s, j) => s + j.amount, 0);
          const dr = journalEntries.filter(j => j.debitAccountId === cat.id && asOfEnd(j.date)).reduce((s, j) => s + j.amount, 0);
          const bal = cr - dr;
          return { id: cat.id, name: `${cat.name} (Income)`, debit: Math.max(0, -bal), credit: Math.max(0, bal), ledgerType: 'ledger-pnl', entityId: 'PNL' };
        });

        const closingStockVal = rawItems.reduce((sum, item) => sum + getComputedItemStock(item.id, endDate || undefined).value, 0);

        data = [
          ...customersSummary, 
          ...suppliersSummary, 
          ...glSummary, 
          ...expensesSummary, 
          ...incomesSummary, 
          { name: 'Closing Stock (Inventory)', debit: closingStockVal, credit: 0, ledgerType: 'inventory' }
        ].filter(r => r.debit !== 0 || r.credit !== 0);
        break;
    }

    const filtered = data.filter(r => {
      const matchSearch = Object.values(r).some(v => v?.toString().toLowerCase().includes(searchTerm.toLowerCase()));
      
      const startF = startDate ? startOfDay(parseISO(startDate)) : null;
      const endF = endDate ? endOfDay(parseISO(endDate)) : null;
      const rDate = safeParseDate(r.date || r.createdAt);
      const matchRange = (!startF || rDate >= startF) && (!endF || rDate <= endF);

      let c1Val = '', c2Val = '', c3Val = '', c4Val = '', c5Val = '', c6Val = '';
      if (activeLogType === 'order-summary') {
        const d = safeParseDate(r.createdAt);
        c1Val = d ? format(d, 'MMM dd, yyyy') : '';
        c2Val = r.customerName || '';
        c3Val = r.packageName || 'Custom';
        c4Val = (r.packageQuantity || 1).toString();
        c5Val = `${r.type} / ${r.slot}`;
        c6Val = r.status || '';
      } else if (activeLogType === 'trial-balance') {
        c1Val = r.name || '';
        c2Val = (r.debit || 0).toString();
        c3Val = (r.credit || 0).toString();
      } else if (activeLogType === 'journal') {
        c1Val = r.date || '';
        c2Val = r.debitAccountName || '';
        c3Val = r.creditAccountName || '';
        c4Val = (r.amount || 0).toString();
        c5Val = r.notes || '';
      } else if (activeLogType === 'items') {
        c1Val = r.name || '';
        c2Val = r.category || '';
        c3Val = r.unit || '';
        c4Val = r.currentStock?.toString() || '0';
      } else if (activeLogType === 'packages') {
        c1Val = r.name || '';
        c2Val = r.type || '';
        c3Val = r.dateContext || '';
        c4Val = r.price?.toString() || '0';
      } else if (activeLogType === 'orders') {
        c1Val = r.id?.substr(0,8) || '';
        c2Val = r.customerName || '';
        c3Val = r.slot || '';
        c4Val = r.total?.toString() || '0';
      } else if (activeLogType === 'suppliers') {
        c1Val = r.name || '';
        c2Val = r.contactPerson || '';
        c3Val = r.phone || '';
        c4Val = r.email || '';
      } else if (activeLogType === 'customers' || activeLogType === 'delivery') {
        c1Val = `${r.firstName} ${r.lastName}`;
        c2Val = r.bacchabiteId || '';
        c3Val = r.mobileNumber || '';
        c4Val = r.email || '';
      } else if (activeLogType === 'mfg-logs') {
        c1Val = r.date ? format(safeParseDate(r.date), 'PP') : '';
        c2Val = r.packageName || '';
        c3Val = r.quantity?.toString() || '0';
        c4Val = (r.ingredientsUsed?.length || 0).toString();
      } else if (activeLogType === 'payments' || activeLogType === 'receipts') {
        c1Val = r.id?.substr(0,8) || '';
        c2Val = r.supplierName || r.customerName || '';
        c3Val = r.date || '';
        c4Val = (r.amount || 0).toString();
      } else if (activeLogType === 'transactions') {
        c1Val = r.date || '';
        c2Val = r.type || '';
        c3Val = r.categoryName || '';
        c4Val = (r.amount || 0).toString();
      }

      const matchCol1 = !colFilters.c1 || c1Val.toLowerCase().includes(colFilters.c1.toLowerCase());
      const matchCol2 = !colFilters.c2 || c2Val.toLowerCase().includes(colFilters.c2.toLowerCase());
      const matchCol3 = !colFilters.c3 || c3Val.toLowerCase().includes(colFilters.c3.toLowerCase());
      const matchCol4 = !colFilters.c4 || c4Val.toLowerCase().includes(colFilters.c4.toLowerCase());
      const matchCol5 = !colFilters.c5 || c5Val.toLowerCase().includes(colFilters.c5.toLowerCase());
      const matchCol6 = !colFilters.c6 || c6Val.toLowerCase().includes(colFilters.c6.toLowerCase());

      return matchSearch && matchRange && matchCol1 && matchCol2 && matchCol3 && matchCol4 && matchCol5 && matchCol6;
    });

    if (sortConfig.key && sortConfig.direction) {
      filtered.sort((a, b) => {
        let valA: any = '', valB: any = '';
        const keyMap: Record<string, string> = { 
          c1: activeLogType === 'order-summary' ? 'createdAt' : activeLogType === 'trial-balance' ? 'name' : activeLogType === 'journal' ? 'date' : activeLogType === 'items' ? 'name' : activeLogType === 'packages' ? 'name' : activeLogType === 'orders' ? 'id' : activeLogType === 'suppliers' ? 'name' : activeLogType === 'customers' ? 'firstName' : activeLogType === 'delivery' ? 'firstName' : activeLogType === 'mfg-logs' ? 'date' : 'date',
          c2: activeLogType === 'order-summary' ? 'customerName' : activeLogType === 'trial-balance' ? 'debit' : activeLogType === 'journal' ? 'debitAccountName' : activeLogType === 'items' ? 'category' : activeLogType === 'packages' ? 'type' : activeLogType === 'orders' ? 'customerName' : activeLogType === 'suppliers' ? 'contactPerson' : activeLogType === 'customers' ? 'bacchabiteId' : activeLogType === 'delivery' ? 'bacchabiteId' : activeLogType === 'mfg-logs' ? 'packageName' : 'type',
          c3: activeLogType === 'order-summary' ? 'packageName' : activeLogType === 'trial-balance' ? 'credit' : activeLogType === 'journal' ? 'creditAccountName' : activeLogType === 'items' ? 'unit' : activeLogType === 'packages' ? 'dateContext' : activeLogType === 'orders' ? 'slot' : activeLogType === 'suppliers' ? 'phone' : activeLogType === 'customers' ? 'mobileNumber' : activeLogType === 'delivery' ? 'mobileNumber' : activeLogType === 'mfg-logs' ? 'quantity' : 'categoryName',
          c4: activeLogType === 'order-summary' ? 'packageQuantity' : activeLogType === 'journal' ? 'amount' : activeLogType === 'items' ? 'currentStock' : activeLogType === 'packages' ? 'price' : activeLogType === 'orders' ? 'total' : activeLogType === 'suppliers' ? 'email' : activeLogType === 'customers' ? 'email' : activeLogType === 'delivery' ? 'email' : activeLogType === 'mfg-logs' ? 'ingredientsUsed' : 'amount',
          c5: activeLogType === 'order-summary' ? 'type' : activeLogType === 'journal' ? 'notes' : '',
          c6: activeLogType === 'order-summary' ? 'status' : ''
        };
        valA = a[keyMap[sortConfig.key] || sortConfig.key]; 
        valB = b[keyMap[sortConfig.key] || sortConfig.key];
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [activeLogType, searchTerm, startDate, endDate, colFilters, sortConfig, rawItems, categories, units, packages, orders, suppliers, users, mfgLogs, payments, receipts, transactions, journalEntries, glAccounts, expenseCats, incomeCats]);

  const orderSummaryTotals = useMemo(() => {
    if (activeLogType !== 'order-summary') return { qty: 0, amount: 0 };
    return (logTableData || []).reduce((acc, row) => ({ qty: acc.qty + (row.packageQuantity || 1), amount: acc.amount + (row.total || 0) }), { qty: 0, amount: 0 });
  }, [activeLogType, logTableData]);

  const trialBalanceTotals = useMemo(() => {
    if (activeLogType !== 'trial-balance') return { debit: 0, credit: 0 };
    return logTableData.reduce((acc, row) => ({ debit: acc.debit + (row.debit || 0), credit: acc.credit + (row.credit || 0) }), { debit: 0, credit: 0 });
  }, [activeLogType, logTableData]);

  const handleExportPDF = () => {
    const title = `Master List: ${activeLogType?.toUpperCase()}`;
    const head = [['ID', 'Name', 'Detail']];
    const body = logTableData.map(r => [r.id?.substr(0,8) || '-', r.name || `${r.firstName} ${r.lastName}`, r.category || r.status || '-']);
    downloadPDF(title, head, body, "master_list");
  };

  const handleLogClick = (type: LogType) => {
    setActiveLogType(type);
    setSearchTerm('');
    setColFilters({});
  };

  const handleRowClick = (row: any) => {
    if (activeLogType === 'trial-balance') {
      if (row.ledgerType === 'inventory') {
        router.push('/admin/reports/inventory');
      } else if (row.ledgerType) {
        router.push(`/admin/reports/accounting?type=${row.ledgerType}&entityId=${row.entityId || ''}`);
      }
      return;
    }
    setSelectedMasterRecord(row);
    setIsMasterDetailOpen(true);
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-headline font-bold text-accent">Master Registries</h1>
        <p className="text-muted-foreground mt-1 font-medium">Core database logs and master directories.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 print:hidden">
        {[ 
          { id: 'items', label: 'Inventory Items', icon: Package }, 
          { id: 'packages', label: 'Broadcasts', icon: LayoutGrid }, 
          { id: 'orders', label: 'Full Orders', icon: ShoppingCart }, 
          { id: 'order-summary', label: 'Order Summary', icon: ClipboardList }, 
          { id: 'transactions', label: 'Inc / Exp Logs', icon: Wallet }, 
          { id: 'journal', label: 'Journal Logs', icon: BookText }, 
          { id: 'suppliers', label: 'Supplier Master', icon: Truck }, 
          { id: 'customers', label: 'Customer Master', icon: Users }, 
          { id: 'delivery', label: 'Rider Master', icon: UserCircle }, 
          { id: 'mfg-logs', label: 'Production Logs', icon: History }, 
          { id: 'payments', label: 'Payment Logs', icon: CreditCard }, 
          { id: 'receipts', label: 'Receipt Logs', icon: ReceiptText }, 
          { id: 'trial-balance', label: 'Trial Balance', icon: Calculator },
          { id: 'menu-master', label: 'Menu Items', icon: Utensils } 
        ].map((log) => (<Button key={log.id} variant={activeLogType === log.id ? "default" : "outline"} onClick={() => handleLogClick(log.id as any)} className="flex flex-col items-center gap-2 h-auto py-4 rounded-2xl"><log.icon className={cn("w-6 h-6", activeLogType === log.id ? "text-white" : "text-primary")} /><span className="text-[10px] font-black uppercase tracking-tight">{log.label}</span></Button>))}
      </div>

      {activeLogType ? (
        <div id="log-table-view" className="space-y-6 animate-in slide-in-from-top-4 duration-500">
          <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white">
            <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
              <div><CardTitle className="text-2xl font-headline font-bold capitalize">Master {activeLogType.replace('-', ' ')} List</CardTitle></div>
              <div className="flex items-center gap-2 print:hidden">
                <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl gap-2 font-bold"><Printer className="w-4 h-4 mr-2" /> Print</Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl gap-2 font-bold"><FileDown className="w-4 h-4 mr-2" /> Export PDF</Button>
                <Button variant="ghost" size="icon" onClick={() => setActiveLogType(null)} className="rounded-full"><X className="w-5 h-5" /></Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-8 pt-0 flex flex-col lg:flex-row gap-4 print:hidden">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search records..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-11 h-12 rounded-2xl bg-secondary/20 border-none" />
                </div>
                {activeLogType === 'trial-balance' && (
                  <div className="flex items-center gap-2 bg-white p-1 rounded-2xl shadow-sm border border-secondary/20 px-4">
                    <CalendarDays className="w-4 h-4 text-muted-foreground" /><span className="text-xs font-bold mr-2">Balances as of:</span>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 border-none bg-secondary/20 rounded-xl text-xs w-32" />
                  </div>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/20 border-none">
                    {(activeLogType === 'orders' || activeLogType === 'order-summary') && (
                      <>
                        <TableHead className="pl-8 py-5">
                          <SortTrigger label="Date" sortKey="c1" />
                          <FilterInput placeholder="Date..." value={colFilters.c1} onChange={v => handleColFilterChange('c1', v)} />
                        </TableHead>
                        <TableHead>
                          <SortTrigger label="Customer Hub" sortKey="c2" />
                          <FilterInput placeholder="Name..." value={colFilters.c2} onChange={v => handleColFilterChange('c2', v)} />
                        </TableHead>
                        <TableHead>
                          <SortTrigger label="Package Details" sortKey="c3" />
                          <FilterInput placeholder="Pkg..." value={colFilters.c3} onChange={v => handleColFilterChange('c3', v)} />
                        </TableHead>
                        <TableHead className="pr-8 text-right">
                          <SortTrigger label="Total Billing" sortKey="c4" className="justify-end" />
                          <FilterInput placeholder="Amt" value={colFilters.c4} onChange={v => handleColFilterChange('c4', v)} />
                        </TableHead>
                      </>
                    )}
                    {activeLogType === 'items' && (
                      <>
                        <TableHead className="pl-8 py-5">
                          <SortTrigger label="Item Name" sortKey="c1" />
                          <FilterInput placeholder="Name" value={colFilters.c1} onChange={v => handleColFilterChange('c1', v)} />
                        </TableHead>
                        <TableHead>
                          <SortTrigger label="Category" sortKey="c2" />
                          <FilterInput placeholder="Cat" value={colFilters.c2} onChange={v => handleColFilterChange('c2', v)} />
                        </TableHead>
                        <TableHead>
                          <SortTrigger label="Unit" sortKey="c3" />
                          <FilterInput placeholder="Unit" value={colFilters.c3} onChange={v => handleColFilterChange('c3', v)} />
                        </TableHead>
                        <TableHead className="pr-8 text-right">
                          <SortTrigger label="Stock" sortKey="c4" className="justify-end" />
                          <FilterInput placeholder="Qty" value={colFilters.c4} onChange={v => handleColFilterChange('c4', v)} />
                        </TableHead>
                      </>
                    )}
                    {activeLogType === 'packages' && (
                      <>
                        <TableHead className="pl-8 py-5">
                          <SortTrigger label="Package Name" sortKey="c1" />
                          <FilterInput placeholder="Name" value={colFilters.c1} onChange={v => handleColFilterChange('c1', v)} />
                        </TableHead>
                        <TableHead>
                          <SortTrigger label="Type" sortKey="c2" />
                          <FilterInput placeholder="Type" value={colFilters.c2} onChange={v => handleColFilterChange('c2', v)} />
                        </TableHead>
                        <TableHead>
                          <SortTrigger label="Price" sortKey="c4" />
                          <FilterInput placeholder="Amt" value={colFilters.c4} onChange={v => handleColFilterChange('c4', v)} />
                        </TableHead>
                        <TableHead className="pr-8 text-right">Items</TableHead>
                      </>
                    )}
                    {activeLogType === 'suppliers' && (
                      <>
                        <TableHead className="pl-8 py-5">
                          <SortTrigger label="Supplier Name" sortKey="c1" />
                          <FilterInput placeholder="Name" value={colFilters.c1} onChange={v => handleColFilterChange('c1', v)} />
                        </TableHead>
                        <TableHead>
                          <SortTrigger label="Contact" sortKey="c2" />
                          <FilterInput placeholder="Person" value={colFilters.c2} onChange={v => handleColFilterChange('c2', v)} />
                        </TableHead>
                        <TableHead>
                          <SortTrigger label="Phone" sortKey="c3" />
                          <FilterInput placeholder="Tel" value={colFilters.c3} onChange={v => handleColFilterChange('c3', v)} />
                        </TableHead>
                        <TableHead className="pr-8 text-right">
                          <SortTrigger label="Email" sortKey="c4" className="justify-end" />
                          <FilterInput placeholder="Email" value={colFilters.c4} onChange={v => handleColFilterChange('c4', v)} />
                        </TableHead>
                      </>
                    )}
                    {(activeLogType === 'customers' || activeLogType === 'delivery') && (
                      <>
                        <TableHead className="pl-8 py-5">
                          <SortTrigger label="Member Name" sortKey="c1" />
                          <FilterInput placeholder="Name" value={colFilters.c1} onChange={v => handleColFilterChange('c1', v)} />
                        </TableHead>
                        <TableHead>
                          <SortTrigger label="ID" sortKey="c2" />
                          <FilterInput placeholder="ID" value={colFilters.c2} onChange={v => handleColFilterChange('c2', v)} />
                        </TableHead>
                        <TableHead>
                          <SortTrigger label="Mobile" sortKey="c3" />
                          <FilterInput placeholder="Tel" value={colFilters.c3} onChange={v => handleColFilterChange('c3', v)} />
                        </TableHead>
                        <TableHead className="pr-8 text-right">
                          <SortTrigger label="Email" sortKey="c4" className="justify-end" />
                          <FilterInput placeholder="Email" value={colFilters.c4} onChange={v => handleColFilterChange('c4', v)} />
                        </TableHead>
                      </>
                    )}
                    {activeLogType === 'payments' && (
                      <>
                        <TableHead className="pl-8 py-5">
                          <SortTrigger label="ID" sortKey="c1" />
                          <FilterInput placeholder="ID" value={colFilters.c1} onChange={v => handleColFilterChange('c1', v)} />
                        </TableHead>
                        <TableHead>
                          <SortTrigger label="Supplier" sortKey="c2" />
                          <FilterInput placeholder="Name" value={colFilters.c2} onChange={v => handleColFilterChange('c2', v)} />
                        </TableHead>
                        <TableHead>
                          <SortTrigger label="Date" sortKey="c3" />
                          <FilterInput placeholder="Date" value={colFilters.c3} onChange={v => handleColFilterChange('c3', v)} />
                        </TableHead>
                        <TableHead className="pr-8 text-right">
                          <SortTrigger label="Paid Amount" sortKey="c4" className="justify-end" />
                          <FilterInput placeholder="Amt" value={colFilters.c4} onChange={v => handleColFilterChange('c4', v)} />
                        </TableHead>
                      </>
                    )}
                    {activeLogType === 'receipts' && (
                      <>
                        <TableHead className="pl-8 py-5">
                          <SortTrigger label="ID" sortKey="c1" />
                          <FilterInput placeholder="ID" value={colFilters.c1} onChange={v => handleColFilterChange('c1', v)} />
                        </TableHead>
                        <TableHead>
                          <SortTrigger label="Customer" sortKey="c2" />
                          <FilterInput placeholder="Name" value={colFilters.c2} onChange={v => handleColFilterChange('c2', v)} />
                        </TableHead>
                        <TableHead>
                          <SortTrigger label="Date" sortKey="c3" />
                          <FilterInput placeholder="Date" value={colFilters.c3} onChange={v => handleColFilterChange('c3', v)} />
                        </TableHead>
                        <TableHead className="pr-8 text-right">
                          <SortTrigger label="Received Amount" sortKey="c4" className="justify-end" />
                          <FilterInput placeholder="Amt" value={colFilters.c4} onChange={v => handleColFilterChange('c4', v)} />
                        </TableHead>
                      </>
                    )}
                    {activeLogType === 'transactions' && (
                      <>
                        <TableHead className="pl-8 py-5">
                          <SortTrigger label="Date" sortKey="c1" />
                          <FilterInput placeholder="Date" value={colFilters.c1} onChange={v => handleColFilterChange('c1', v)} />
                        </TableHead>
                        <TableHead>
                          <SortTrigger label="Type" sortKey="c2" />
                          <FilterInput placeholder="Type" value={colFilters.c2} onChange={v => handleColFilterChange('c2', v)} />
                        </TableHead>
                        <TableHead>
                          <SortTrigger label="Category" sortKey="c3" />
                          <FilterInput placeholder="Cat" value={colFilters.c3} onChange={v => handleColFilterChange('c3', v)} />
                        </TableHead>
                        <TableHead className="pr-8 text-right">
                          <SortTrigger label="Amount" sortKey="c4" className="justify-end" />
                          <FilterInput placeholder="Amt" value={colFilters.c4} onChange={v => handleColFilterChange('c4', v)} />
                        </TableHead>
                      </>
                    )}
                    {activeLogType === 'journal' && (
                      <>
                        <TableHead className="pl-8 py-5">
                          <SortTrigger label="Date" sortKey="c1" />
                          <FilterInput placeholder="Date" value={colFilters.c1} onChange={v => handleColFilterChange('c1', v)} />
                        </TableHead>
                        <TableHead>
                          <SortTrigger label="Debit Account" sortKey="c2" />
                          <FilterInput placeholder="Dr Account" value={colFilters.c2} onChange={v => handleColFilterChange('c2', v)} />
                        </TableHead>
                        <TableHead>
                          <SortTrigger label="Credit Account" sortKey="c3" />
                          <FilterInput placeholder="Cr Account" value={colFilters.c3} onChange={v => handleColFilterChange('c3', v)} />
                        </TableHead>
                        <TableHead className="pr-8 text-right">
                          <SortTrigger label="Amount" sortKey="c4" className="justify-end" />
                          <FilterInput placeholder="Amt" value={colFilters.c4} onChange={v => handleColFilterChange('c4', v)} />
                        </TableHead>
                      </>
                    )}
                    {activeLogType === 'trial-balance' && (
                      <>
                        <TableHead className="pl-8 py-5">
                          <SortTrigger label="Account Head" sortKey="c1" />
                          <FilterInput placeholder="Account" value={colFilters.c1} onChange={v => handleColFilterChange('c1', v)} />
                        </TableHead>
                        <TableHead className="text-right">
                          <SortTrigger label="Debit" sortKey="c2" className="justify-end" />
                          <FilterInput placeholder="Dr" value={colFilters.c2} onChange={v => handleColFilterChange('c2', v)} />
                        </TableHead>
                        <TableHead className="pr-8 text-right">
                          <SortTrigger label="Credit" sortKey="c3" className="justify-end" />
                          <FilterInput placeholder="Cr" value={colFilters.c3} onChange={v => handleColFilterChange('c3', v)} />
                        </TableHead>
                      </>
                    )}
                    {activeLogType === 'menu-master' && (
                      <>
                        <TableHead className="pl-8 py-5">
                          <SortTrigger label="Item Name" sortKey="c1" />
                          <FilterInput placeholder="Name" value={colFilters.c1} onChange={v => handleColFilterChange('c1', v)} />
                        </TableHead>
                        <TableHead>
                          <SortTrigger label="Type" sortKey="c2" />
                          <FilterInput placeholder="Type" value={colFilters.c2} onChange={v => handleColFilterChange('c2', v)} />
                        </TableHead>
                        <TableHead>
                          <SortTrigger label="Slot" sortKey="c3" />
                          <FilterInput placeholder="Slot" value={colFilters.c3} onChange={v => handleColFilterChange('c3', v)} />
                        </TableHead>
                        <TableHead className="pr-8 text-right">
                          <SortTrigger label="Price" sortKey="c4" className="justify-end" />
                          <FilterInput placeholder="Amt" value={colFilters.c4} onChange={v => handleColFilterChange('c4', v)} />
                        </TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logTableData.map((row, i) => {
                    let c1Val = '', c2Val = '', c3Val = '', c4Val = '', c5Val = '', c6Val = '';
                    if (activeLogType === 'order-summary') {
                      const d = safeParseDate(row.createdAt);
                      c1Val = d ? format(d, 'MMM dd, yyyy') : '';
                      c2Val = row.customerName || '';
                      c3Val = row.packageName || 'Custom';
                      c4Val = (row.packageQuantity || 1).toString();
                      c5Val = `${row.type} / ${row.slot}`;
                      c6Val = row.status || '';
                    } else if (activeLogType === 'trial-balance') {
                      c1Val = row.name || '';
                      c2Val = (row.debit || 0).toFixed(2);
                      c3Val = (row.credit || 0).toFixed(2);
                    } else if (activeLogType === 'journal') {
                      c1Val = row.date || '';
                      c2Val = row.debitAccountName || '';
                      c3Val = row.creditAccountName || '';
                      c4Val = (row.amount || 0).toString();
                      c5Val = row.notes || '';
                    } else if (activeLogType === 'items') {
                      c1Val = row.name || '';
                      c2Val = row.category || '';
                      c3Val = row.unit || '';
                      c4Val = row.currentStock?.toString() || '0';
                    } else if (activeLogType === 'packages') {
                      c1Val = row.name || '';
                      c2Val = row.type || '';
                      c3Val = row.dateContext || '';
                      c4Val = row.price?.toString() || '0';
                    } else if (activeLogType === 'orders') {
                      c1Val = row.id?.substr(0,8) || '';
                      c2Val = row.customerName || '';
                      c3Val = row.slot || '';
                      c4Val = row.total?.toString() || '0';
                    } else if (activeLogType === 'suppliers') {
                      c1Val = row.name || '';
                      c2Val = row.contactPerson || '';
                      c3Val = row.phone || '';
                      c4Val = row.email || '';
                    } else if (activeLogType === 'customers' || activeLogType === 'delivery') {
                      c1Val = `${row.firstName} ${row.lastName}`;
                      c2Val = row.bacchabiteId || '';
                      c3Val = row.mobileNumber || '';
                      c4Val = row.email || '';
                    } else if (activeLogType === 'mfg-logs') {
                      c1Val = row.date ? format(safeParseDate(row.date), 'PP') : '';
                      c2Val = row.packageName || '';
                      c3Val = row.quantity?.toString() || '0';
                      c4Val = (row.ingredientsUsed?.length || 0).toString();
                    } else if (activeLogType === 'payments' || activeLogType === 'receipts') {
                      c1Val = row.id?.substr(0,8) || '';
                      c2Val = row.supplierName || row.customerName || '';
                      c3Val = row.date || '';
                      c4Val = (row.amount || 0).toString();
                    } else if (activeLogType === 'transactions') {
                      c1Val = row.date || '';
                      c2Val = row.type || '';
                      c3Val = row.categoryName || '';
                      c4Val = (row.amount || 0).toString();
                    } else if (activeLogType === 'menu-master') {
                      c1Val = row.name || '';
                      c2Val = row.type || '';
                      c3Val = row.slot || '';
                      c4Val = (row.price || 0).toString();
                    }

                    return (
                      <TableRow key={i} className="hover:bg-primary/5 cursor-pointer border-b border-secondary/10" onClick={() => handleRowClick(row)}>
                        <TableCell className="pl-8 py-4 font-bold text-sm group flex items-center gap-2">
                          {c1Val} <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 print:hidden" />
                        </TableCell>
                        <TableCell>{c2Val}</TableCell>
                        <TableCell>{c3Val}</TableCell>
                        <TableCell className={cn("text-right font-black text-primary", activeLogType === 'order-summary' ? "text-center" : "pr-8")}>{c4Val}</TableCell>
                        {activeLogType === 'order-summary' && (
                          <>
                            <TableCell>{c5Val}</TableCell>
                            <TableCell className="pr-8 text-right"><Badge variant="outline" className="text-[9px] uppercase font-bold">{c6Val}</Badge></TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
                {activeLogType === 'trial-balance' && (
                  <TableFooter className="bg-secondary/10 border-t-2 border-secondary/30">
                    <TableRow>
                      <TableCell className="font-black py-5 pl-8 uppercase text-xs tracking-widest text-muted-foreground">Verification Totals:</TableCell>
                      <TableCell className="text-right font-black text-xl text-primary">{trialBalanceTotals.debit.toFixed(2)}</TableCell>
                      <TableCell className="pr-8 text-right font-black text-xl text-accent">{trialBalanceTotals.credit.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableFooter>
                )}
                {activeLogType === 'order-summary' && (
                   <TableFooter className="bg-secondary/10 border-t-2 border-secondary/30">
                     <TableRow>
                       <TableCell colSpan={3} className="text-right font-black py-5 uppercase text-xs tracking-widest text-muted-foreground">Summary Totals:</TableCell>
                       <TableCell className="text-center font-black text-xl text-primary">{orderSummaryTotals.qty} Sets</TableCell>
                       <TableCell colSpan={2} className="font-black text-2xl text-accent pl-8">{orderSummaryTotals.amount.toFixed(2)}</TableCell>
                     </TableRow>
                   </TableFooter>
                )}
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="p-20 text-center border-4 border-dashed border-secondary rounded-[3rem] opacity-30">
          <ClipboardList className="w-20 h-20 mx-auto mb-4" />
          <p className="text-xl font-bold uppercase tracking-widest">Select a Registry above to begin view</p>
        </div>
      )}

      {/* Master Detail Dialog */}
      <Dialog open={isMasterDetailOpen} onOpenChange={setIsMasterDetailOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-2xl overflow-hidden p-0 border-none shadow-2xl">
          {selectedMasterRecord && (
            <>
              <DialogHeader className="bg-accent p-8 text-white">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge variant="outline" className="bg-white/10 text-white border-white/20 uppercase font-black text-[10px] mb-2">Record Intelligence</Badge>
                    <DialogTitle className="text-3xl font-headline font-bold leading-none">{selectedMasterRecord.name || `${selectedMasterRecord.firstName} ${selectedMasterRecord.lastName}`}</DialogTitle>
                  </div>
                  <Badge className="bg-white text-accent border-none font-black text-[10px] rounded-lg">{activeLogType?.toUpperCase()}</Badge>
                </div>
              </DialogHeader>
              <div className="p-8 bg-white overflow-y-auto max-h-[70vh]">
                <div className="space-y-6">
                  <div className="flex items-center gap-4 bg-secondary/20 p-6 rounded-[2rem] border border-secondary/30">
                    <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                      {activeLogType === 'items' ? <Package className="w-8 h-8 text-primary" /> : <User className="w-8 h-8 text-primary" />}
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900">{selectedMasterRecord.name || `${selectedMasterRecord.firstName} ${selectedMasterRecord.lastName}`}</h3>
                      <Badge variant="outline" className="mt-1 bg-white border-primary/20 text-primary font-black uppercase text-[10px]">{activeLogType?.toUpperCase()}</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(selectedMasterRecord).filter(([k]) => typeof selectedMasterRecord[k] !== 'object' && k !== 'id' && !['ledgerType', 'entityId'].includes(k)).map(([k, v]: any) => (
                      <div key={k} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{k}</p>
                        <p className="font-bold text-sm">{v?.toString() || '-'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter className="bg-slate-50 p-6 flex justify-center"><Button onClick={() => setIsMasterDetailOpen(false)} className="rounded-xl px-10 font-bold h-12">Close Details</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

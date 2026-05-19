"use client";

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  DialogFooter,
  DialogTrigger
} from '@/components/ui/dialog';
import { 
  Wallet, 
  Archive, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  FileText, 
  Search, 
  FilterX, 
  CalendarDays, 
  ArrowRight, 
  X, 
  Info, 
  BookOpen, 
  User, 
  Truck, 
  Landmark, 
  Landmark as BankIcon, 
  Landmark as UpiIcon, 
  Coins, 
  History, 
  ArrowLeft, 
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
  Scale, 
  PieChart, 
  Calculator, 
  BookText, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Loader2, 
  Plus,
  MapPin,
  Clock,
  Phone,
  ImageIcon,
  Sparkles,
  CheckCircle2,
  Calendar as CalendarIcon,
  Hash,
  ArrowRightLeft,
  Factory,
  ZoomIn
} from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay, isBefore, isAfter, subDays, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Order, Purchase, Payment, CustomerReceipt, ManufacturingLog, GeneralTransaction, JournalEntry, RawItem, User as BBUser, Supplier, Category, Unit, ExpenseCategory, IncomeCategory } from '@/lib/types';
import { downloadPDF } from '@/lib/pdf-export';

type DetailType = 'sales' | 'purchases' | 'inflow' | 'outflow' | 'ledger-supplier' | 'ledger-customer' | 'ledger-delivery' | 'ledger-cash' | 'ledger-bank' | 'ledger-upi' | 'ledger-capital' | 'ledger-pnl' | null;
type LogType = 'items' | 'packages' | 'orders' | 'order-summary' | 'suppliers' | 'customers' | 'delivery' | 'mfg-logs' | 'payments' | 'receipts' | 'transactions' | 'trial-balance' | 'journal' | null;

interface StockMovement {
  date: string;
  type: 'Inward' | 'Outward';
  qty: number;
  rate: number;
  amount: number;
  ref: string;
}

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

const FilterInput = ({ placeholder, value, onChange }: { placeholder: string, value: string, onChange: (v: string) => void }) => (
  <Input
    placeholder={placeholder}
    value={value || ''}
    onChange={(e) => onChange(e.target.value)}
    className="h-7 text-[10px] px-2 rounded-md bg-white/50 border-none placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/30 mt-1 print:hidden font-normal normal-case tracking-normal"
  />
);

const safeParseDate = (d: any): Date => {
  if (!d) return new Date(0);
  if (d instanceof Date) return d;
  if (typeof d === 'object' && 'seconds' in d) return new Date(d.seconds * 1000);
  if (typeof d === 'string') return parseISO(d);
  return new Date(0);
};

export default function ReportsPage() {
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

  const { data: expenseCatsData = [] } = useCollection<ExpenseCategory>(useMemoFirebase(() => collection(firestore, 'expense_categories'), [firestore]));
  const expenseCats = expenseCatsData || [];

  const { data: incomeCatsData = [] } = useCollection<IncomeCategory>(useMemoFirebase(() => collection(firestore, 'income_categories'), [firestore]));
  const incomeCats = incomeCatsData || [];

  const { data: packagesData = [] } = useCollection<any>(useMemoFirebase(() => collection(firestore, 'packages'), [firestore]));
  const packages = packagesData || [];

  const { data: menuData = [] } = useCollection<any>(useMemoFirebase(() => collection(firestore, 'menu_items'), [firestore]));
  const menu = menuData || [];

  const [activeTab, setActiveTab] = useState('accounting');
  const [activeDetail, setActiveDetail] = useState<DetailType>(null);
  const [activeLogType, setActiveLogType] = useState<LogType>(null);
  const [selectedStockItemId, setSelectedStockItemId] = useState<string | null>(null);
  
  const [selectedLedgerEntityId, setSelectedLedgerEntityId] = useState<string | null>(null);
  const [selectedLedgerEntityName, setSelectedLedgerEntityName] = useState<string | null>(null);

  const [selectedMasterRecord, setSelectedMasterRecord] = useState<any>(null);
  const [isMasterDetailOpen, setIsMasterDetailOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: '', direction: null });

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    let title = "Report";
    let head: string[][] = [];
    let body: any[][] = [];
    let filename = "report";

    if (activeDetail === 'sales') {
      title = "Sales Report";
      head = [['Date', 'Order ID', 'Customer', 'Package', 'Amount', 'Status']];
      body = drillDownData.map(d => [d.date, d.id, d.name, d.ref, d.amount, d.status]);
      filename = "sales_report";
    } else if (activeDetail === 'purchases') {
      title = "Purchases Report";
      head = [['Date', 'Ref ID', 'Supplier', 'Amount', 'Status']];
      body = drillDownData.map(d => [d.date, d.id, d.name, d.amount, d.status]);
      filename = "purchases_report";
    } else if (activeDetail === 'inflow') {
      title = "Inflow Report";
      head = [['Date', 'ID', 'Source', 'Method', 'Amount']];
      body = drillDownData.map(d => [d.date, d.id, d.name, d.ref, d.amount]);
      filename = "inflow_report";
    } else if (activeDetail === 'outflow') {
      title = "Outflow Report";
      head = [['Date', 'ID', 'Purpose', 'Method', 'Amount']];
      body = drillDownData.map(d => [d.date, d.id, d.name, d.ref, d.amount]);
      filename = "outflow_report";
    } else if (activeDetail?.startsWith('ledger-')) {
      if (selectedLedgerEntityId && dailyLedgerView) {
        title = `Ledger: ${selectedLedgerEntityName}`;
        head = [['Date', 'Ref', 'Description', 'Debit', 'Credit', 'Balance']];
        body = [
          ['-', '-', 'OPENING BALANCE', '-', '-', dailyLedgerView.openingBalance.toFixed(2)],
          ...dailyLedgerView.transactions.map(t => [t.date, t.ref, t.notes, t.debit || '-', t.credit || '-', t.balance.toFixed(2)]),
          ['-', '-', 'CLOSING BALANCE', '-', '-', dailyLedgerView.closingBalance.toFixed(2)]
        ];
        filename = `ledger_${selectedLedgerEntityId}`;
      } else {
        title = "Ledger Summary";
        head = [['Account Name', 'Opening', 'Debit', 'Credit', 'Closing']];
        body = ledgerData.map(l => [l.name, l.opening.toFixed(2), l.debit.toFixed(2), l.credit.toFixed(2), l.closing.toFixed(2)]);
        filename = "ledger_summary";
      }
    } else if (selectedStockItemId && itemStockLedger) {
      title = `Stock Ledger: ${itemStockLedger.item.name}`;
      head = [['Date', 'Ref', 'Type', 'Qty In', 'Qty Out', 'Balance']];
      body = [
        ['-', '-', 'OPENING', '-', '-', itemStockLedger.opening.qty.toFixed(2)],
        ...itemStockLedger.movements.map(m => [m.date, m.ref, m.type, m.type === 'Inward' ? m.qty : '-', m.type === 'Outward' ? m.qty : '-', m.currentQty.toFixed(2)]),
        ['-', '-', 'CLOSING', '-', '-', itemStockLedger.closing.qty.toFixed(2)]
      ];
      filename = `stock_ledger_${selectedStockItemId}`;
    } else if (activeTab === 'stock' && !selectedStockItemId) {
      title = "Stock Status Report";
      head = [['Item Name', 'Current Stock', 'Valuation', 'Status']];
      body = stockData.map(s => [s.name, `${s.stock} ${s.unit}`, s.value.toFixed(2), s.isLow ? 'Restock' : 'Healthy']);
      filename = "stock_status";
    } else if (activeTab === 'final-accounts') {
      title = "Final Accounts Statement";
      head = [['Particulars (Debit/Liab)', 'Amount', 'Particulars (Credit/Asset)', 'Amount']];
      
      const tradingTotal = Math.max(
        finalAccounts.trading.sales + finalAccounts.trading.closingStock,
        finalAccounts.trading.openingStock + finalAccounts.trading.purchases + Math.max(0, finalAccounts.trading.grossProfit)
      );

      const plTotal = Math.max(
        (finalAccounts.pl.grossProfit >= 0 ? finalAccounts.pl.grossProfit : 0) + finalAccounts.pl.indirectIncome,
        (finalAccounts.pl.grossProfit < 0 ? Math.abs(finalAccounts.pl.grossProfit) : 0) + finalAccounts.pl.indirectExpense + Math.max(0, finalAccounts.pl.netProfit)
      );

      body = [
        [{ content: 'TRADING ACCOUNT', colSpan: 4, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }],
        ['To Opening Stock', finalAccounts.trading.openingStock.toFixed(2), 'By Sales (Net)', finalAccounts.trading.sales.toFixed(2)],
        ['To Purchases', finalAccounts.trading.purchases.toFixed(2), 'By Closing Stock', finalAccounts.trading.closingStock.toFixed(2)],
        ['To Gross Profit c/d', Math.max(0, finalAccounts.trading.grossProfit).toFixed(2), 'By Gross Loss c/d', finalAccounts.trading.grossProfit < 0 ? Math.abs(finalAccounts.trading.grossProfit).toFixed(2) : '-'],
        ['TOTAL', tradingTotal.toFixed(2), 'TOTAL', tradingTotal.toFixed(2)],
        ['', '', '', ''],
        [{ content: 'PROFIT & LOSS ACCOUNT', colSpan: 4, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }],
        ['To Gross Loss b/d', finalAccounts.pl.grossProfit < 0 ? Math.abs(finalAccounts.pl.grossProfit).toFixed(2) : '-', 'By Gross Profit b/d', finalAccounts.pl.grossProfit >= 0 ? finalAccounts.pl.grossProfit.toFixed(2) : '-'],
        ['To Indirect Expenses', finalAccounts.pl.indirectExpense.toFixed(2), 'By Indirect Income', finalAccounts.pl.indirectIncome.toFixed(2)],
        ['To Net Profit', Math.max(0, finalAccounts.pl.netProfit).toFixed(2), 'By Net Loss', finalAccounts.pl.netProfit < 0 ? Math.abs(finalAccounts.pl.netProfit).toFixed(2) : '-'],
        ['TOTAL', plTotal.toFixed(2), 'TOTAL', plTotal.toFixed(2)],
        ['', '', '', ''],
        [{ content: 'BALANCE SHEET', colSpan: 4, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }],
      ];

      const maxLength = Math.max(finalAccounts.bs.assets.length, finalAccounts.bs.liabilities.length);
      for (let i = 0; i < maxLength; i++) {
        const liab = finalAccounts.bs.liabilities[i];
        const asset = finalAccounts.bs.assets[i];
        body.push([
          liab ? liab.name : '',
          liab ? liab.value.toFixed(2) : '',
          asset ? asset.name : '',
          asset ? asset.value.toFixed(2) : ''
        ]);
      }
      
      const bsFinalTotal = (finalAccounts.bs.totalLiabilities + (finalAccounts.pl.netProfit > 0 ? finalAccounts.pl.netProfit : 0)).toFixed(2);
      body.push(['TOTAL LIABILITIES', bsFinalTotal, 'TOTAL ASSETS', finalAccounts.bs.totalAssets.toFixed(2)]);

      filename = "final_accounts_report";
    } else if (activeLogType) {
      title = `Master List: ${activeLogType.replace('-', ' ').toUpperCase()}`;
      if (activeLogType === 'items') {
        head = [['Item Name', 'Category', 'Unit', 'Stock']];
        body = logTableData.map(r => [r.name, r.category, r.unit, r.currentStock]);
      } else if (activeLogType === 'packages') {
        head = [['Package Name', 'Type', 'Context', 'Price']];
        body = logTableData.map(r => [r.name, r.type, r.dateContext, r.price]);
      } else if (activeLogType === 'orders') {
        head = [['Order ID', 'Customer', 'Slot', 'Total']];
        body = logTableData.map(r => [r.id.substr(0,8), r.customerName, r.slot, r.total]);
      } else if (activeLogType === 'order-summary') {
        head = [['Date', 'Customer', 'Package', 'Qty', 'Slot', 'Status']];
        body = logTableData.map(r => [
          format(safeParseDate(r.createdAt), 'MMM dd, yyyy'), 
          r.customerName, r.packageName || 'Custom', r.packageQuantity || 1, r.slot, r.status
        ]);
      } else if (activeLogType === 'suppliers') {
        head = [['Name', 'Contact', 'Phone', 'Email']];
        body = logTableData.map(r => [r.name, r.contactPerson, r.phone, r.email]);
      } else if (activeLogType === 'customers') {
        head = [['Name', 'ID', 'Mobile', 'Email']];
        body = logTableData.map(r => [`${r.firstName} ${r.lastName}`, r.bacchabiteId, r.mobileNumber, r.email]);
      } else if (activeLogType === 'delivery') {
        head = [['Name', 'ID', 'Mobile', 'Email']];
        body = logTableData.map(r => [`${r.firstName} ${r.lastName}`, r.bacchabiteId, r.mobileNumber, r.email]);
      } else if (activeLogType === 'mfg-logs') {
        head = [['Date', 'Package', 'Qty', 'Ingredients']];
        body = logTableData.map(r => [format(safeParseDate(r.date), 'PP'), r.packageName, r.quantity, (r.ingredientsUsed || []).length]);
      } else if (activeLogType === 'payments') {
        head = [['ID', 'Supplier', 'Date', 'Method', 'Amount']];
        body = logTableData.map(r => [r.id.substr(0,8), r.supplierName, r.date, r.paymentMethod, r.amount]);
      } else if (activeLogType === 'receipts') {
        head = [['ID', 'Customer', 'Date', 'Method', 'Amount']];
        body = logTableData.map(r => [r.id.substr(0,8), r.customerName, r.date, r.paymentMethod, r.amount]);
      } else if (activeLogType === 'transactions') {
        head = [['Date', 'Type', 'Category', 'Method', 'Amount']];
        body = logTableData.map(r => [r.date, r.type, r.categoryName, r.paymentMethod, r.amount]);
      } else if (activeLogType === 'trial-balance') {
        head = [['Account Name', 'Debit', 'Credit']];
        body = logTableData.map(r => [r.name, r.debit.toFixed(2), r.credit.toFixed(2)]);
      } else if (activeLogType === 'journal') {
        head = [['Date', 'Ref', 'Debit Acc', 'Credit Acc', 'Amt', 'Narration']];
        body = logTableData.map(r => [r.date, r.id.substr(0,8), r.debitAccountName, r.creditAccountName, r.amount, r.notes]);
      }
      filename = `list_${activeLogType}`;
    }

    downloadPDF(title, head, body, filename);
  };

  const handleColFilterChange = (key: string, val: string) => {
    setColFilters(prev => ({ ...prev, [key]: val }));
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
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
        <ArrowUpDown className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary transition-colors" />
      )}
    </div>
  );

  const clearFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setColFilters({});
    setSortConfig({ key: '', direction: null });
  };

  const getComputedItemStock = (rawItemId: string, upToDate?: string) => {
    const item = (rawItems || []).find(ri => ri.id === rawItemId);
    if (!item) return { qty: 0, value: 0, unit: '' };
    const unit = (units || []).find(u => u.id === item.baseUnitId);
    
    // Weighted Average Cost (WAC) logic
    let qty = Number(item.openingStock || 0);
    let val = Number(item.openingValue || 0);
    let wac = qty > 0 ? val / qty : 0;
    
    const movements: StockMovement[] = [];
    const cutoff = upToDate ? endOfDay(parseISO(upToDate)) : null;

    (purchases || []).forEach(p => {
      const pDate = safeParseDate(p.date);
      if (cutoff && isAfter(pDate, cutoff)) return;
      if (p.status !== 'Received') return;
      const pItem = (p.items || []).find((i: any) => i.rawItemId === rawItemId);
      if (pItem) movements.push({ date: p.date, type: 'Inward', qty: Number(pItem.quantity), rate: Number(pItem.rate), amount: Number(pItem.amount), ref: p.id });
    });
    
    (mfgLogs || []).forEach(log => {
      const lDate = safeParseDate(log.date);
      if (cutoff && isAfter(lDate, cutoff)) return;
      const mItem = (log.ingredientsUsed || []).find((i: any) => i.rawItemId === rawItemId);
      if (mItem) movements.push({ date: log.date.split('T')[0], type: 'Outward', qty: Number(mItem.quantity), rate: 0, amount: 0, ref: log.id });
    });
    
    movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    movements.forEach(m => {
      if (m.type === 'Inward') { 
        const prevQty = qty;
        qty += m.qty; 
        
        if (prevQty <= 0) {
          // If we were short or zero, the new purchase sets the price for the shortage
          wac = m.rate;
          val = qty * wac;
        } else {
          // Normal WAC calculation
          val += m.amount;
          if (qty > 0) wac = val / qty;
          else { val = 0; wac = 0; }
        }
      } else { 
        // Outward consumption happens at CURRENT WAC
        qty -= m.qty; 
        val = qty * wac;
      }

      // Precision guard: if qty is 0, val must be 0
      if (Math.abs(qty) < 0.000001) {
        qty = 0;
        val = 0;
      }
    });

    // Guard precision
    val = Math.round(val * 100) / 100;
    
    return { qty, value: val, unit: unit?.name || '', isLow: qty < 15 };
  };

  const accountingSummary = useMemo(() => {
    const totalSales = (orders || []).filter(o => o.status !== 'Cancelled').reduce((sum, o) => sum + o.total, 0);
    const totalPurchases = (purchases || []).reduce((sum, p) => sum + p.totalAmount, 0);
    const totalCashInflow = (receipts || []).reduce((sum, r) => sum + r.amount, 0) + 
                           (transactions || []).filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
    const totalCashOutflow = (payments || []).reduce((sum, p) => sum + p.amount, 0) + 
                            (transactions || []).filter(t => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0);
    return { totalSales, totalPurchases, totalCashInflow, totalCashOutflow };
  }, [orders, purchases, receipts, transactions, payments]);

  const drillDownData = useMemo(() => {
    if (!activeDetail || activeDetail.startsWith('ledger-')) return [];
    let rawData: any[] = [];

    switch (activeDetail) {
      case 'sales':
        rawData = (orders || []).map(o => {
          const d = safeParseDate(o.createdAt);
          return { id: o.id, name: o.customerName, date: d.toISOString().split('T')[0], amount: o.total, status: o.status, ref: o.packageName || 'Custom' };
        });
        break;
      case 'purchases':
        rawData = (purchases || []).map(p => ({ id: p.id, name: (suppliers || []).find(s => s.id === p.supplierId)?.name || 'Unknown', date: p.date, amount: p.totalAmount, status: p.status, ref: 'Purchase' }));
        break;
      case 'inflow':
        const rcp = (receipts || []).map(r => ({ id: r.id, name: r.customerName, date: r.date, amount: r.amount, status: 'Settled', ref: r.paymentMethod }));
        const inc = (transactions || []).filter(t => t.type === 'Income').map(t => ({ id: t.id, name: t.categoryName, date: t.date, amount: t.amount, status: 'Income', ref: t.paymentMethod }));
        rawData = [...rcp, ...inc];
        break;
      case 'outflow':
        const pay = (payments || []).map(p => ({ id: p.id, name: p.supplierName, date: p.date, amount: p.amount, status: 'Paid', ref: p.paymentMethod }));
        const exp = (transactions || []).filter(t => t.type === 'Expense').map(t => ({ id: t.id, name: t.categoryName, date: t.date, amount: t.amount, status: 'Expense', ref: t.paymentMethod }));
        rawData = [...pay, ...exp];
        break;
    }

    const finalSortConfig = sortConfig.key === '' ? { key: 'date', direction: 'desc' } as const : sortConfig;

    const filtered = rawData.filter(item => {
      const partyName = item.name || '';
      const refId = item.id || '';
      const matchesSearch = partyName.toLowerCase().includes(searchTerm.toLowerCase()) || refId.toLowerCase().includes(searchTerm.toLowerCase());
      const itemDate = safeParseDate(item.date);
      const matchesStart = !startDate || itemDate >= startOfDay(parseISO(startDate));
      const matchesEnd = !endDate || itemDate <= endOfDay(parseISO(endDate));
      const matchesIdFilter = !colFilters.id || refId.toLowerCase().includes(colFilters.id.toLowerCase());
      const matchesNameFilter = !colFilters.name || partyName.toLowerCase().includes(colFilters.name.toLowerCase());
      const matchesAmountFilter = !colFilters.amount || item.amount.toString().includes(colFilters.amount);
      const matchesStatusFilter = !colFilters.status || item.status.toLowerCase().includes(colFilters.status.toLowerCase());
      return matchesSearch && matchesStart && matchesEnd && matchesIdFilter && matchesNameFilter && matchesAmountFilter && matchesStatusFilter;
    });

    if (finalSortConfig.key && finalSortConfig.direction) {
      filtered.sort((a, b) => {
        const valA = a[finalSortKeyMap[finalSortConfig.key] || finalSortConfig.key];
        const valB = b[finalSortKeyMap[finalSortConfig.key] || finalSortConfig.key];
        if (valA < valB) return finalSortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return finalSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [activeDetail, searchTerm, startDate, endDate, colFilters, sortConfig, orders, purchases, suppliers, receipts, transactions, payments]);

  const finalSortKeyMap: Record<string, string> = { c1: 'date', c2: 'name', c3: 'amount', c4: 'status' };

  const drillDownTotalAmount = useMemo(() => {
    return drillDownData.reduce((sum, item) => sum + item.amount, 0);
  }, [drillDownData]);

  const ledgerData = useMemo(() => {
    if (!activeDetail?.startsWith('ledger-')) return [];
    const type = activeDetail.replace('ledger-', '');
    const startFilter = startDate ? startOfDay(parseISO(startDate)) : null;
    const endFilter = endDate ? endOfDay(parseISO(endDate)) : null;
    let rows: LedgerRow[] = [];

    const isInRange = (d: any) => {
      const dt = safeParseDate(d);
      if (startFilter && isBefore(dt, startFilter)) return false;
      if (endFilter && isAfter(dt, endFilter)) return false;
      return true;
    };

    const isBeforePeriod = (d: any) => {
      const dt = safeParseDate(d);
      return startFilter && isBefore(dt, startFilter);
    };

    if (type === 'supplier') {
      rows = (suppliers || []).map(s => {
        const purList = (purchases || []).filter(p => p.supplierId === s.id);
        const payList = (payments || []).filter(p => p.supplierId === s.id);
        const jvs = (journalEntries || []).filter(j => j.debitAccountId === s.id || j.creditAccountId === s.id);
        let opBal = 0, periodDr = 0, periodCr = 0;
        purList.forEach(p => {
          if (isBeforePeriod(p.date)) opBal += p.totalAmount;
          else if (isInRange(p.date)) periodCr += p.totalAmount;
        });
        payList.forEach(p => {
          if (isBeforePeriod(p.date)) opBal -= p.amount;
          else if (isInRange(p.date)) periodDr += p.amount;
        });
        jvs.forEach(j => {
          const impact = j.creditAccountId === s.id ? j.amount : -j.amount;
          if (isBeforePeriod(j.date)) opBal += impact;
          else if (isInRange(j.date)) {
            if (impact > 0) periodCr += impact; else periodDr += Math.abs(impact);
          }
        });
        return { id: s.id, name: s.name, opening: opBal, debit: periodDr, credit: periodCr, closing: opBal + periodCr - periodDr, type: 'Supplier' };
      });
    } else if (type === 'customer') {
      rows = (users || []).filter(u => u.role === 'customer').map(c => {
        const salesList = (orders || []).filter(o => o.customerId === c.id && o.status !== 'Cancelled');
        const rcpList = (receipts || []).filter(r => r.customerId === c.id);
        const jvs = (journalEntries || []).filter(j => j.debitAccountId === c.id || j.creditAccountId === c.id);
        let opBal = 0, periodDr = 0, periodCr = 0;
        salesList.forEach(o => {
          if (isBeforePeriod(o.createdAt)) opBal += o.total;
          else if (isInRange(o.createdAt)) periodDr += o.total;
        });
        rcpList.forEach(r => {
          if (isBeforePeriod(r.date)) opBal -= r.amount;
          else if (isInRange(r.date)) periodCr += r.amount;
        });
        jvs.forEach(j => {
          const impact = j.debitAccountId === c.id ? j.amount : -j.amount;
          if (isBeforePeriod(j.date)) opBal += impact;
          else if (isInRange(j.date)) {
            if (impact > 0) periodDr += impact; else periodCr += Math.abs(impact);
          }
        });
        return { id: c.id, name: `${c.firstName} ${c.lastName}`, opening: opBal, debit: periodDr, credit: periodCr, closing: opBal + periodDr - periodCr, type: 'Customer' };
      });
    } else if (type === 'delivery') {
      rows = (users || []).filter(u => u.role === 'delivery').map(d => {
        const assignedOrders = (orders || []).filter(o => o.assignedTo === d.id && o.status === 'Delivered');
        let opBal = 0, periodDr = 0;
        assignedOrders.forEach(o => {
          if (isBeforePeriod(o.createdAt)) opBal += o.total;
          else if (isInRange(o.createdAt)) periodDr += o.total;
        });
        return { id: d.id, name: `${d.firstName} ${d.lastName}`, opening: opBal, debit: periodDr, credit: 0, closing: opBal + periodDr, type: 'Delivery Partner' };
      });
    } else if (['cash', 'bank', 'upi', 'capital', 'pnl'].includes(type)) {
      const methodMap: Record<string, string> = { cash: 'Cash', bank: 'Bank Transfer', upi: 'UPI', capital: 'Capital', pnl: 'Profit & Loss' };
      const methodLabel = methodMap[type];
      const methodId = type.toUpperCase();
      const rcpList = (receipts || []).filter(r => r.paymentMethod === methodLabel);
      const payList = (payments || []).filter(p => p.paymentMethod === methodLabel);
      const incomeEntries = (transactions || []).filter(t => t.type === 'Income' && t.paymentMethod === methodLabel);
      const expenseEntries = (transactions || []).filter(t => t.type === 'Expense' && t.paymentMethod === methodLabel);
      const jvs = (journalEntries || []).filter(j => j.debitAccountId === methodId || j.creditAccountId === methodId);
      
      let opBal = 0, periodDr = 0, periodCr = 0;
      const isAsset = !['capital', 'pnl'].includes(type);
      [...rcpList, ...incomeEntries].forEach(r => {
        if (isBeforePeriod(r.date)) opBal += r.amount;
        else if (isInRange(r.date)) periodDr += r.amount;
      });
      [...payList, ...expenseEntries].forEach(p => {
        if (isBeforePeriod(p.date)) opBal -= p.amount;
        else if (isInRange(p.date)) periodCr += p.amount;
      });
      jvs.forEach(j => {
        const impact = j.debitAccountId === methodId ? j.amount : -j.amount;
        if (isBeforePeriod(j.date)) opBal += impact;
        else if (isInRange(j.date)) {
          if (impact > 0) periodDr += impact; else periodCr += Math.abs(impact);
        }
      });
      rows = [{ id: methodId, name: `${methodLabel} Account`, opening: opBal, debit: periodDr, credit: periodCr, closing: opBal + periodDr - periodCr, type: isAsset ? 'Asset' : 'Equity' }];
    }

    const filtered = rows.filter(r => {
      const matchSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchName = !colFilters.name || r.name.toLowerCase().includes(colFilters.name.toLowerCase());
      const matchOpening = !colFilters.opening || r.opening.toString().includes(colFilters.opening);
      const matchDebit = !colFilters.debit || r.debit.toString().includes(colFilters.debit);
      const matchCredit = !colFilters.credit || r.credit.toString().includes(colFilters.credit);
      const matchClosing = !colFilters.closing || r.closing.toString().includes(colFilters.closing);
      return matchSearch && matchName && matchOpening && matchDebit && matchCredit && matchClosing;
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
  }, [activeDetail, searchTerm, startDate, endDate, colFilters, sortConfig, suppliers, purchases, payments, journalEntries, users, orders, receipts, transactions]);

  const ledgerTotals = useMemo(() => {
    return ledgerData.reduce((acc, row) => ({
      opening: acc.opening + row.opening,
      debit: acc.debit + row.debit,
      credit: acc.credit + row.credit,
      closing: acc.closing + row.closing
    }), { opening: 0, debit: 0, credit: 0, closing: 0 });
  }, [ledgerData]);

  const dailyLedgerView = useMemo(() => {
    if (!selectedLedgerEntityId || !activeDetail) return null;
    const type = activeDetail.replace('ledger-', '');
    let allTransactions: Omit<TransactionRow, 'balance'>[] = [];

    if (type === 'supplier') {
      const purList = (purchases || []).filter(p => p.supplierId === selectedLedgerEntityId);
      const payList = (payments || []).filter(p => p.supplierId === selectedLedgerEntityId);
      const jvs = (journalEntries || []).filter(j => j.debitAccountId === selectedLedgerEntityId || j.creditAccountId === selectedLedgerEntityId);
      purList.forEach(p => allTransactions.push({ date: p.date, ref: p.id, debit: 0, credit: p.totalAmount, notes: 'Purchase' }));
      payList.forEach(p => allTransactions.push({ date: p.date, ref: p.id, debit: p.amount, credit: 0, notes: p.paymentMethod }));
      jvs.forEach(j => {
        const isDr = j.debitAccountId === selectedLedgerEntityId;
        allTransactions.push({ date: j.date, ref: j.id, debit: isDr ? j.amount : 0, credit: !isDr ? j.amount : 0, notes: `JV: ${j.notes}` });
      });
    } else if (type === 'customer') {
      const salesList = (orders || []).filter(o => o.customerId === selectedLedgerEntityId && o.status !== 'Cancelled');
      const rcpList = (receipts || []).filter(r => r.customerId === selectedLedgerEntityId);
      const jvs = (journalEntries || []).filter(j => j.debitAccountId === selectedLedgerEntityId || j.creditAccountId === selectedLedgerEntityId);
      salesList.forEach(o => {
        const dTime = safeParseDate(o.createdAt);
        allTransactions.push({ date: dTime.toISOString().split('T')[0], ref: o.id, debit: o.total, credit: 0, notes: 'Order Sales' });
      });
      rcpList.forEach(r => allTransactions.push({ date: r.date, ref: r.id, debit: 0, credit: r.amount, notes: r.paymentMethod }));
      jvs.forEach(j => {
        const isDr = j.debitAccountId === selectedLedgerEntityId;
        allTransactions.push({ date: j.date, ref: j.id, debit: isDr ? j.amount : 0, credit: !isDr ? j.amount : 0, notes: `JV: ${j.notes}` });
      });
    } else if (type === 'delivery') {
      const deliveredOrders = (orders || []).filter(o => o.assignedTo === selectedLedgerEntityId && o.status === 'Delivered');
      deliveredOrders.forEach(o => {
        const dTime = safeParseDate(o.createdAt);
        allTransactions.push({ date: dTime.toISOString().split('T')[0], ref: o.id, debit: o.total, credit: 0, notes: 'Cash Collection' });
      });
    } else if (['cash', 'bank', 'upi', 'capital', 'pnl'].includes(type)) {
      const methodMap: Record<string, string> = { cash: 'Cash', bank: 'Bank Transfer', upi: 'UPI', capital: 'Capital', pnl: 'Profit & Loss' };
      const methodLabel = methodMap[type];
      const methodId = type.toUpperCase();
      (receipts || []).filter(r => r.paymentMethod === methodLabel && r.date).forEach(r => allTransactions.push({ date: r.date, ref: r.id, debit: r.amount, credit: 0, notes: `Receipt from ${r.customerName}` }));
      (payments || []).filter(p => p.paymentMethod === methodLabel && p.date).forEach(p => allTransactions.push({ date: p.date, ref: p.id, debit: 0, credit: p.amount, notes: `Payment to ${p.supplierName}` }));
      (transactions || []).filter(t => t.paymentMethod === methodLabel && t.date).forEach(t => {
        if (t.type === 'Income') allTransactions.push({ date: t.date, ref: t.id, debit: t.amount, credit: 0, notes: `Income: ${t.categoryName}` });
        else allTransactions.push({ date: t.date, ref: t.id, debit: 0, credit: t.amount, notes: `Expense: ${t.categoryName}` });
      });
      (journalEntries || []).filter(j => j.debitAccountId === methodId || j.creditAccountId === methodId).forEach(j => {
        const isDr = j.debitAccountId === methodId;
        allTransactions.push({ date: j.date, ref: j.id, debit: isDr ? j.amount : 0, credit: !isDr ? j.amount : 0, notes: `JV: ${j.notes}` });
      });
    }

    const finalSortConfig = sortConfig.key === '' ? { key: 'date', direction: 'desc' } as const : sortConfig;
    allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const startFilter = startDate ? startOfDay(parseISO(startDate)) : null;
    const endFilter = endDate ? endOfDay(parseISO(endDate)) : null;
    let openingBalance = 0;
    const transactionsInRange: TransactionRow[] = [];
    const isSupplier = type === 'supplier';
    let runningBalance = 0;
    allTransactions.forEach(t => {
      const tDate = safeParseDate(t.date);
      const isBeforeStart = startFilter && isBefore(tDate, startFilter);
      const isInRange = (!startFilter || !isBefore(tDate, startFilter)) && (!endFilter || !isAfter(tDate, endFilter));
      const impact = isSupplier ? (t.credit - t.debit) : (t.debit - t.credit);
      if (isBeforeStart) openingBalance += impact;
      else if (isInRange) {
        if (transactionsInRange.length === 0) runningBalance = openingBalance + impact;
        else runningBalance += impact;
        transactionsInRange.push({ ...t, balance: runningBalance });
      }
    });

    if (finalSortConfig.key && finalSortConfig.direction) {
      transactionsInRange.sort((a, b) => {
        const valA = (a as any)[sortConfig.key];
        const valB = (b as any)[sortConfig.key];
        if (valA < valB) return finalSortConfig.direction === 'asc' ? -1 : 1;
        if (valB < valA) return finalSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return { transactions: transactionsInRange, openingBalance, closingBalance: openingBalance + transactionsInRange.reduce((acc, t) => acc + (isSupplier ? (t.credit - t.debit) : (t.debit - t.credit)), 0), isSupplier };
  }, [selectedLedgerEntityId, activeDetail, startDate, endDate, sortConfig, purchases, payments, journalEntries, orders, receipts, transactions]);

  const stockData = useMemo(() => {
    const data = (rawItems || []).map(item => {
      const computed = getComputedItemStock(item.id, endDate || undefined);
      return { id: item.id, name: item.name, stock: computed.qty, value: computed.value, unit: computed.unit, isLow: computed.isLow };
    }).filter(item => {
      const matchName = !colFilters.name || item.name.toLowerCase().includes(colFilters.name.toLowerCase());
      const matchQty = !colFilters.qty || item.stock.toString().includes(colFilters.qty);
      const matchValue = !colFilters.value || item.value.toString().includes(colFilters.value);
      const matchStatus = !colFilters.status || (item.isLow ? 'restock' : 'healthy').includes(colFilters.status.toLowerCase());
      return matchName && matchQty && matchValue && matchStatus;
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
  }, [colFilters, sortConfig, endDate, rawItems, units, purchases, mfgLogs]);

  const totalStockValuation = useMemo(() => (stockData || []).reduce((sum, item) => sum + item.value, 0), [stockData]);

  const itemStockLedger = useMemo(() => {
    if (!selectedStockItemId) return null;
    const item = (rawItems || []).find(ri => ri.id === selectedStockItemId);
    if (!item) return null;

    const startFilter = startDate ? startOfDay(parseISO(startDate)) : null;
    const endFilter = endDate ? endOfDay(parseISO(endDate)) : null;

    let qty = Number(item.openingStock || 0);
    let val = Number(item.openingValue || 0);
    let wac = qty > 0 ? val / qty : 0;

    const allMovements: any[] = [];
    (purchases || []).forEach(p => {
      const pDate = safeParseDate(p.date);
      if (p.status !== 'Received') return;
      const pItem = (p.items || []).find((i: any) => i.rawItemId === selectedStockItemId);
      if (pItem) allMovements.push({ date: p.date, type: 'Inward', qty: Number(pItem.quantity), rate: Number(pItem.rate), amount: Number(pItem.amount), ref: p.id });
    });
    (mfgLogs || []).forEach(log => {
      const mItem = (log.ingredientsUsed || []).find((i: any) => i.rawItemId === selectedStockItemId);
      if (mItem) allMovements.push({ date: log.date.split('T')[0], type: 'Outward', qty: Number(mItem.quantity), rate: 0, amount: 0, ref: log.id });
    });

    allMovements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let periodOpeningQty = 0;
    let periodOpeningVal = 0;
    const periodMovements: any[] = [];

    allMovements.forEach(m => {
      const mDate = safeParseDate(m.date);
      const isBeforeStart = startFilter && isBefore(mDate, startFilter);
      const isInPeriod = (!startFilter || !isBefore(mDate, startFilter)) && (!endFilter || !isAfter(mDate, endFilter));

      if (m.type === 'Inward') {
        const prevQty = qty;
        qty += m.qty;
        if (prevQty <= 0) {
          wac = m.rate;
          val = qty * wac;
        } else {
          val += m.amount;
          if (qty > 0) wac = val / qty;
          else { val = 0; wac = 0; }
        }
      } else {
        qty -= m.qty;
        val = qty * wac;
      }
      
      if (Math.abs(qty) < 0.000001) { qty = 0; val = 0; }

      if (isBeforeStart) {
        periodOpeningQty = qty;
        periodOpeningVal = val;
      } else if (isInPeriod) {
        periodMovements.push({
          ...m,
          currentQty: qty,
          currentVal: Math.round(val * 100) / 100,
          currentWac: wac,
          outVal: m.type === 'Outward' ? m.qty * wac : 0
        });
      }
    });

    if (!startFilter) {
      periodOpeningQty = Number(item.openingStock || 0);
      periodOpeningVal = Number(item.openingValue || 0);
    }

    const inwardTotals = periodMovements.filter(m => m.type === 'Inward').reduce((acc, m) => ({ qty: acc.qty + m.qty, val: acc.val + m.amount }), { qty: 0, val: 0 });
    const outwardTotals = periodMovements.filter(m => m.type === 'Outward').reduce((acc, m) => ({ qty: acc.qty + m.qty, val: acc.val + m.outVal }), { qty: 0, val: 0 });

    return {
      item,
      movements: periodMovements,
      opening: { qty: periodOpeningQty, val: periodOpeningVal },
      closing: { qty, val },
      inward: { qty: inwardTotals.qty, val: inwardTotals.val },
      outward: { qty: outwardTotals.qty, val: outwardTotals.val }
    };
  }, [selectedStockItemId, startDate, endDate, rawItems, purchases, mfgLogs]);

  const logTableData = useMemo(() => {
    if (!activeLogType) return [];
    let data: any[] = [];
    
    const startFilter = startDate ? startOfDay(parseISO(startDate)) : null;
    const endFilter = endDate ? endOfDay(parseISO(endDate)) : null;

    const isInRange = (d: any) => {
      const dt = safeParseDate(d);
      if (startFilter && isBefore(dt, startFilter)) return false;
      if (endFilter && isAfter(dt, endFilter)) return false;
      return true;
    };

    const asOfEnd = (d: any) => {
      const dt = safeParseDate(d);
      if (endFilter && isAfter(dt, endFilter)) return false;
      return true;
    };

    switch (activeLogType) {
      case 'items': data = (rawItems || []).map(i => ({ ...i, category: (categories || []).find(c => c.id === i.categoryId)?.name || 'Unknown', unit: (units || []).find(u => u.id === i.baseUnitId)?.name || '' })); break;
      case 'packages': data = packages || []; break;
      case 'orders': 
      case 'order-summary': data = orders || []; break;
      case 'suppliers': data = suppliers || []; break;
      case 'customers': data = (users || []).filter(u => u.role === 'customer'); break;
      case 'delivery': data = (users || []).filter(u => u.role === 'delivery'); break;
      case 'mfg-logs': data = mfgLogs || []; break;
      case 'payments': data = payments || []; break;
      case 'receipts': data = receipts || []; break;
      case 'transactions': data = transactions || []; break;
      case 'journal': data = journalEntries || []; break;
      case 'trial-balance':
        const customersList = (users || []).filter(u => u.role === 'customer').map(c => {
          const salesVal = (orders || []).filter(o => o.customerId === c.id && o.status !== 'Cancelled' && asOfEnd(o.createdAt)).reduce((s, o) => s + o.total, 0);
          const rcpVal = (receipts || []).filter(r => r.customerId === c.id && asOfEnd(r.date)).reduce((s, r) => s + r.amount, 0);
          const jvDr = (journalEntries || []).filter(j => j.debitAccountId === c.id && asOfEnd(j.date)).reduce((s, j) => s + j.amount, 0);
          const jvCr = (journalEntries || []).filter(j => j.creditAccountId === c.id && asOfEnd(j.date)).reduce((s, j) => s + j.amount, 0);
          const bal = (salesVal + jvDr) - (rcpVal + jvCr);
          return { name: `${c.firstName} ${c.lastName}`, debit: Math.max(0, bal), credit: Math.max(0, -bal) };
        });
        const suppliersSummary = (suppliers || []).map(s => {
          const purVal = (purchases || []).filter(p => p.supplierId === s.id && asOfEnd(p.date)).reduce((sum, p) => sum + p.totalAmount, 0);
          const payVal = (payments || []).filter(p => p.supplierId === s.id && asOfEnd(p.date)).reduce((sum, p) => sum + p.amount, 0);
          const jvDr = (journalEntries || []).filter(j => j.debitAccountId === s.id && asOfEnd(j.date)).reduce((sum, j) => sum + j.amount, 0);
          const jvCr = (journalEntries || []).filter(j => j.creditAccountId === s.id && asOfEnd(j.date)).reduce((sum, j) => sum + j.amount, 0);
          const bal = (purVal + jvCr) - (payVal + jvDr);
          return { name: s.name, debit: Math.max(0, -bal), credit: Math.max(0, bal) };
        });
        const methods = ['CASH', 'BANK', 'UPI', 'CAPITAL', 'PNL'].map(m => {
          const methodLabel = m === 'CASH' ? 'Cash' : m === 'BANK' ? 'Bank Transfer' : m === 'UPI' ? 'UPI' : m === 'PNL' ? 'Profit & Loss' : 'Capital';
          const rcpVal = (receipts || []).filter(r => r.paymentMethod === methodLabel && asOfEnd(r.date)).reduce((s, r) => s + r.amount, 0);
          const payVal = (payments || []).filter(p => p.paymentMethod === methodLabel && asOfEnd(p.date)).reduce((sum, p) => sum + p.amount, 0);
          const incVal = (transactions || []).filter(t => t.type === 'Income' && t.paymentMethod === methodLabel && asOfEnd(t.date)).reduce((s, t) => s + t.amount, 0);
          const expVal = (transactions || []).filter(t => t.type === 'Expense' && t.paymentMethod === methodLabel && asOfEnd(t.date)).reduce((s, t) => s + t.amount, 0);
          const jvDr = (journalEntries || []).filter(j => j.debitAccountId === m && asOfEnd(j.date)).reduce((s, j) => s + j.amount, 0);
          const jvCr = (journalEntries || []).filter(j => j.creditAccountId === m && asOfEnd(j.date)).reduce((s, j) => s + j.amount, 0);
          
          let bal = 0;
          if (m === 'CAPITAL' || m === 'PNL') bal = (rcpVal + incVal + jvCr) - (payVal + expVal + jvDr);
          else bal = (rcpVal + incVal + jvDr) - (payVal + expVal + jvCr);
          
          return { name: `${methodLabel} Account`, debit: Math.max(0, bal), credit: Math.max(0, -bal) };
        });
        const expenses = (expenseCats || []).map(c => {
          const amt = (transactions || []).filter(t => t.categoryId === c.id && isInRange(t.date)).reduce((s, t) => s + t.amount, 0);
          const jvDr = (journalEntries || []).filter(j => j.debitAccountId === c.id && isInRange(j.date)).reduce((s, j) => s + j.amount, 0);
          const jvCr = (journalEntries || []).filter(j => j.creditAccountId === c.id && isInRange(j.date)).reduce((s, j) => s + j.amount, 0);
          return { name: c.name, debit: amt + jvDr - jvCr, credit: 0 };
        });
        const incomes = (incomeCats || []).map(c => {
          const amt = (transactions || []).filter(t => t.categoryId === c.id && isInRange(t.date)).reduce((s, t) => s + t.amount, 0);
          const jvDr = (journalEntries || []).filter(j => j.debitAccountId === c.id && isInRange(j.date)).reduce((s, j) => s + j.amount, 0);
          const jvCr = (journalEntries || []).filter(j => j.creditAccountId === c.id && isInRange(j.date)).reduce((s, j) => s + j.amount, 0);
          return { name: c.name, debit: 0, credit: amt + jvCr - jvDr };
        });
        const closingStockValue = (rawItems || []).reduce((sum, item) => sum + getComputedItemStock(item.id, endDate || undefined).value, 0);
        data = [...customersList, ...suppliersSummary, ...methods, ...expenses, ...incomes, { name: 'Closing Stock (Inventory)', debit: closingStockValue, credit: 0 }];
        break;
    }

    let finalSortKey = sortConfig.key;
    let finalSortDir = sortConfig.direction;
    if (finalSortKey === '' && ['orders', 'order-summary', 'mfg-logs', 'payments', 'receipts', 'transactions', 'journal'].includes(activeLogType!)) {
      finalSortKey = 'c1'; finalSortDir = 'desc';
    }

    const filtered = data.filter(item => {
      const name = (item.name || item.firstName || item.customerName || item.packageName || item.supplierName || item.id || '').toLowerCase();
      const bId = (item.bacchabiteId || '').toLowerCase();
      const matchSearch = name.includes(searchTerm.toLowerCase()) || bId.includes(searchTerm.toLowerCase());
      
      const rawDate = item.date || item.createdAt;
      const dateStr = typeof rawDate === 'string' ? rawDate : (rawDate instanceof Date ? rawDate.toISOString() : '');
      
      const matchStart = !startDate || (dateStr && safeParseDate(dateStr) >= startOfDay(parseISO(startDate)));
      const matchEnd = !endDate || (dateStr && safeParseDate(dateStr) <= endOfDay(parseISO(endDate)));
      
      let c1Val = '', c2Val = '', c3Val = '', c4Val = '', c5Val = '', c6Val = '';
      if (activeLogType === 'order-summary') {
        const d = safeParseDate(item.createdAt);
        c1Val = d ? format(d, 'MMM dd, yyyy') : '';
        c2Val = item.customerName || '';
        c3Val = item.packageName || 'Custom';
        c4Val = (item.packageQuantity || 1).toString();
        c5Val = `${item.type} / ${item.slot}`;
        c6Val = item.status || '';
      } else if (activeLogType === 'trial-balance') {
        c1Val = item.name || '';
        c2Val = (item.debit || 0).toString();
        c3Val = (item.credit || 0).toString();
      } else if (activeLogType === 'journal') {
        c1Val = item.date || '';
        c2Val = item.debitAccountName || '';
        c3Val = item.creditAccountName || '';
        c4Val = (item.amount || 0).toString();
        c5Val = item.notes || '';
      } else if (activeLogType === 'items') {
        c1Val = item.name || '';
        c2Val = item.category || '';
        c3Val = item.unit || '';
        c4Val = item.currentStock?.toString() || '0';
      } else if (activeLogType === 'packages') {
        c1Val = item.name || '';
        c2Val = item.type || '';
        c3Val = item.dateContext || '';
        c4Val = item.price?.toString() || '0';
      } else if (activeLogType === 'orders') {
        c1Val = item.id?.substr(0,8) || '';
        c2Val = item.customerName || '';
        c3Val = item.slot || '';
        c4Val = item.total?.toString() || '0';
      } else if (activeLogType === 'suppliers') {
        c1Val = item.name || '';
        c2Val = item.contactPerson || '';
        c3Val = item.phone || '';
        c4Val = item.email || '';
      } else if (activeLogType === 'customers' || activeLogType === 'delivery') {
        c1Val = `${item.firstName} ${item.lastName}`;
        c2Val = item.bacchabiteId || '';
        c3Val = item.mobileNumber || '';
        c4Val = item.email || '';
      } else if (activeLogType === 'mfg-logs') {
        c1Val = item.date ? format(safeParseDate(item.date), 'PP') : '';
        c2Val = item.packageName || '';
        c3Val = item.quantity?.toString() || '0';
        c4Val = (item.ingredientsUsed?.length || 0).toString();
      } else if (activeLogType === 'payments' || activeLogType === 'receipts') {
        c1Val = item.id?.substr(0,8) || '';
        c2Val = item.supplierName || item.customerName || '';
        c3Val = item.date || '';
        c4Val = (item.amount || 0).toString();
      } else if (activeLogType === 'transactions') {
        c1Val = item.date || '';
        c2Val = item.type || '';
        c3Val = item.categoryName || '';
        c4Val = (item.amount || 0).toString();
      }

      const matchCol1 = !colFilters.c1 || c1Val.toLowerCase().includes(colFilters.c1.toLowerCase());
      const matchCol2 = !colFilters.c2 || c2Val.toLowerCase().includes(colFilters.c2.toLowerCase());
      const matchCol3 = !colFilters.c3 || c3Val.toLowerCase().includes(colFilters.c3.toLowerCase());
      const matchCol4 = !colFilters.c4 || c4Val.toLowerCase().includes(colFilters.c4.toLowerCase());
      const matchCol5 = !colFilters.c5 || c5Val.toLowerCase().includes(colFilters.c5.toLowerCase());
      const matchCol6 = !colFilters.c6 || c6Val.toLowerCase().includes(colFilters.c6.toLowerCase());
      return matchSearch && matchStart && matchEnd && matchCol1 && matchCol2 && matchCol3 && matchCol4 && matchCol5 && matchCol6;
    });

    if (finalSortKey && finalSortDir) {
      filtered.sort((a, b) => {
        let valA: any = '', valB: any = '';
        const keyMap: Record<string, string> = { 
          c1: activeLogType === 'order-summary' ? 'createdAt' : activeLogType === 'trial-balance' ? 'name' : activeLogType === 'journal' ? 'date' : activeLogType === 'items' ? 'name' : activeLogType === 'packages' ? 'name' : activeLogType === 'orders' ? 'id' : activeLogType === 'suppliers' ? 'name' : activeLogType === 'customers' ? 'firstName' : activeLogType === 'delivery' ? 'firstName' : activeLogType === 'mfg-logs' ? 'date' : 'date',
          c2: activeLogType === 'order-summary' ? 'customerName' : activeLogType === 'trial-balance' ? 'debit' : activeLogType === 'journal' ? 'debitAccountName' : activeLogType === 'items' ? 'category' : activeLogType === 'packages' ? 'type' : activeLogType === 'orders' ? 'customerName' : activeLogType === 'suppliers' ? 'contactPerson' : activeLogType === 'customers' ? 'bacchabiteId' : activeLogType === 'delivery' ? 'bacchabiteId' : activeLogType === 'mfg-logs' ? 'packageName' : 'type',
          c3: activeLogType === 'order-summary' ? 'packageName' : activeLogType === 'trial-balance' ? 'credit' : activeLogType === 'journal' ? 'creditAccountName' : activeLogType === 'items' ? 'unit' : activeLogType === 'packages' ? 'dateContext' : activeLogType === 'orders' ? 'slot' : activeLogType === 'suppliers' ? 'phone' : activeLogType === 'customers' ? 'mobileNumber' : activeLogType === 'delivery' ? 'mobileNumber' : activeLogType === 'mfg-logs' ? 'quantity' : 'categoryName',
          c4: activeLogType === 'order-summary' ? 'packageQuantity' : activeLogType === 'journal' ? 'amount' : activeLogType === 'items' ? 'currentStock' : activeLogType === 'packages' ? 'price' : activeLogType === 'orders' ? 'total' : activeLogType === 'suppliers' ? 'email' : activeLogType === 'customers' ? 'email' : activeLogType === 'delivery' ? 'email' : activeLogType === 'mfg-logs' ? 'ingredientsUsed' : 'amount'
        };
        valA = a[keyMap[finalSortKey] || finalSortKey]; valB = b[keyMap[finalSortKey] || finalSortKey];
        if (valA < valB) return finalSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return finalSortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [activeLogType, searchTerm, startDate, endDate, colFilters, sortConfig, rawItems, categories, units, packages, orders, suppliers, users, mfgLogs, payments, receipts, transactions, journalEntries, incomeCats, expenseCats]);

  const orderSummaryTotals = useMemo(() => {
    if (activeLogType !== 'order-summary') return { qty: 0, amount: 0 };
    return (logTableData || []).reduce((acc, row) => ({ qty: acc.qty + (row.packageQuantity || 1), amount: acc.amount + (row.total || 0) }), { qty: 0, amount: 0 });
  }, [activeLogType, logTableData]);

  const trialBalanceTotals = useMemo(() => {
    if (activeLogType !== 'trial-balance') return { debit: 0, credit: 0 };
    return (logTableData || []).reduce((acc, row) => ({ debit: acc.debit + (row.debit || 0), credit: acc.credit + (row.credit || 0) }), { debit: 0, credit: 0 });
  }, [activeLogType, logTableData]);

  const finalAccounts = useMemo(() => {
    const startFilter = startDate ? startOfDay(parseISO(startDate)) : null;
    const endFilter = endDate ? endOfDay(parseISO(endDate)) : null;

    const isInRange = (d: any) => {
      const dt = safeParseDate(d);
      if (startFilter && isBefore(dt, startFilter)) return false;
      if (endFilter && isAfter(dt, endFilter)) return false;
      return true;
    };

    const asOfEnd = (d: any) => {
      const dt = safeParseDate(d);
      if (endFilter && isAfter(dt, endFilter)) return false;
      return true;
    };

    const salesVal = (orders || []).filter(o => o.status !== 'Cancelled' && isInRange(o.createdAt)).reduce((sum, o) => sum + o.total, 0);
    
    const openingStockVal = (rawItems || []).reduce((sum, item) => {
      if (!startDate) return sum + (item.openingValue || 0);
      const dayBefore = subDays(parseISO(startDate), 1);
      return sum + getComputedItemStock(item.id, format(dayBefore, 'yyyy-MM-dd')).value;
    }, 0);

    const purchasesTotal = (purchases || []).filter(p => isInRange(p.date)).reduce((sum, p) => sum + p.totalAmount, 0);
    
    const closingStockVal = (rawItems || []).reduce((sum, item) => {
      return sum + getComputedItemStock(item.id, endDate || undefined).value;
    }, 0);

    const grossProfitVal = (salesVal + closingStockVal) - (openingStockVal + purchasesTotal);
    const indirectIncomeVal = (transactions || []).filter(t => t.type === 'Income' && isInRange(t.date)).reduce((sum, t) => sum + t.amount, 0);
    const indirectExpenseVal = (transactions || []).filter(t => t.type === 'Expense' && isInRange(t.date)).reduce((sum, t) => sum + t.amount, 0);
    
    const jvPnlImpact = (journalEntries || []).filter(j => isInRange(j.date)).reduce((acc, j) => {
      let impact = 0;
      const isIncomeDr = (incomeCats || []).some(c => c.id === j.debitAccountId);
      const isIncomeCr = (incomeCats || []).some(c => c.id === j.creditAccountId);
      const isExpenseDr = (expenseCats || []).some(c => c.id === j.debitAccountId);
      const isExpenseCr = (expenseCats || []).some(c => c.id === j.creditAccountId);
      
      if (isIncomeDr) impact -= j.amount;
      if (isIncomeCr) impact += j.amount;
      if (isExpenseDr) impact -= j.amount;
      if (isExpenseCr) impact += j.amount;
      return acc + impact;
    }, 0);

    const netProfitVal = (grossProfitVal + indirectIncomeVal) - indirectExpenseVal + jvPnlImpact;
    const sundryDebtors = (orders || []).filter(o => o.status === 'Delivered' && o.paymentStatus !== 'paid' && asOfEnd(o.createdAt)).reduce((sum, o) => sum + o.total, 0);
    const totalPurchasesAsOf = (purchases || []).filter(p => asOfEnd(p.date)).reduce((sum, p) => sum + p.totalAmount, 0);
    const totalPaymentsAsOf = (payments || []).filter(p => asOfEnd(p.date)).reduce((sum, p) => sum + p.amount, 0);
    const sundryCreditors = Math.max(0, totalPurchasesAsOf - totalPaymentsAsOf);
    
    const capitalJvImpact = (journalEntries || []).filter(j => (j.debitAccountId === 'CAPITAL' || j.creditAccountId === 'CAPITAL') && asOfEnd(j.date)).reduce((acc, j) => {
      return acc + (j.creditAccountId === 'CAPITAL' ? j.amount : -j.amount);
    }, 0);

    const pnlJvImpactCumulative = (journalEntries || []).filter(j => (j.debitAccountId === 'PNL' || j.creditAccountId === 'PNL') && asOfEnd(j.date)).reduce((acc, j) => {
      return acc + (j.creditAccountId === 'PNL' ? j.amount : -j.amount);
    }, 0);

    const totalCashInAsOf = (receipts || []).filter(r => asOfEnd(r.date)).reduce((sum, r) => sum + r.amount, 0) + 
                           (transactions || []).filter(t => t.type === 'Income' && asOfEnd(t.date)).reduce((sum, t) => sum + t.amount, 0);
    const totalCashOutAsOf = (payments || []).filter(p => asOfEnd(p.date)).reduce((sum, p) => sum + p.amount, 0) + 
                            (transactions || []).filter(t => t.type === 'Expense' && asOfEnd(t.date)).reduce((sum, t) => sum + t.amount, 0);
    const cashAtBank = totalCashInAsOf - totalCashOutAsOf;
    
    const assets = [ 
      { name: 'Closing Stock', value: closingStockVal }, 
      { name: 'Sundry Debtors', value: sundryDebtors }, 
      { name: 'Cash at Bank / Hand', value: cashAtBank }, 
      { name: 'Fixed Assets (Mock)', value: 50000 } 
    ];
    const liabilities = [ 
      { name: 'Capital Account', value: 100000 + capitalJvImpact }, 
      { name: 'Profit & Loss (Adj)', value: pnlJvImpactCumulative },
      { name: 'Sundry Creditors', value: sundryCreditors } 
    ];
    
    return { 
      trading: { sales: salesVal, openingStock: openingStockVal, purchases: purchasesTotal, closingStock: closingStockVal, grossProfit: grossProfitVal }, 
      pl: { grossProfit: grossProfitVal, indirectIncome: indirectIncomeVal, indirectExpense: indirectExpenseVal, netProfit: netProfitVal }, 
      bs: { assets, liabilities, totalAssets: assets.reduce((sum, a) => sum + a.value, 0), totalLiabilities: liabilities.reduce((sum, l) => sum + l.value, 0) } 
    };
  }, [startDate, endDate, orders, rawItems, purchases, receipts, transactions, payments, journalEntries, incomeCats, expenseCats]);

  const handleCardClick = (type: DetailType) => {
    setActiveDetail(type); setSelectedStockItemId(null); setActiveLogType(null); setSelectedLedgerEntityId(null); clearFilters();
    setTimeout(() => document.getElementById('drill-down-view')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleLedgerRowClick = (row: LedgerRow) => {
    setSelectedLedgerEntityId(row.id); setSelectedLedgerEntityName(row.name);
    setTimeout(() => document.getElementById('daily-ledger-view')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleStockItemClick = (id: string) => {
    setSelectedStockItemId(id); setActiveDetail(null); setActiveLogType(null); setSelectedLedgerEntityId(null); clearFilters();
    setTimeout(() => document.getElementById('stock-drill-down')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleLogClick = (type: LogType) => {
    setActiveLogType(type); setActiveDetail(null); setSelectedStockItemId(null); clearFilters();
    setTimeout(() => document.getElementById('log-table-view')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  if (!mounted) return null;

  const showPeriodInAccounting = activeDetail !== null;

  const MasterDetailContent = () => {
    if (!selectedMasterRecord || !activeLogType) return null;

    switch (activeLogType) {
      case 'items':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4 bg-secondary/20 p-6 rounded-[2rem] border border-secondary/30">
              <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-sm"><Archive className="w-8 h-8 text-primary" /></div>
              <div>
                <h3 className="text-2xl font-black text-slate-900">{selectedMasterRecord.name}</h3>
                <Badge variant="outline" className="mt-1 bg-white border-primary/20 text-primary font-black uppercase text-[10px]">{selectedMasterRecord.category}</Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Basic Unit</p>
                <p className="font-bold text-lg">{selectedMasterRecord.unit}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Stock Level</p>
                <p className="font-black text-2xl text-primary">{selectedMasterRecord.currentStock}</p>
              </div>
            </div>
            {selectedMasterRecord.conversions?.length > 0 && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Unit Conversions</Label>
                <div className="space-y-2">
                  {selectedMasterRecord.conversions.map((c: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-secondary/10 rounded-xl border border-secondary/20 text-sm font-bold">
                      <span>1 {selectedMasterRecord.unit}</span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <span>{c.factor} {(units || []).find(u => u.id === c.unitId)?.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      case 'packages':
        return (
          <div className="space-y-6">
            {selectedMasterRecord.imageUrl && (
              <div className="relative aspect-video w-full rounded-[2.5rem] overflow-hidden border-2 border-secondary shadow-sm group/image">
                <img src={selectedMasterRecord.imageUrl} alt="Package" className="object-cover w-full h-full" />
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity">
                      <ZoomIn className="w-10 h-10 text-white" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-none">
                    <div className="relative w-full aspect-video rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl">
                      <img src={selectedMasterRecord.imageUrl} alt="Package Enlarge" className="object-cover w-full h-full" />
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
            <div className="flex justify-between items-start gap-4 bg-accent/5 p-6 rounded-[2rem] border border-accent/10">
              <div className="flex-1">
                <h3 className="text-2xl font-black text-accent">{selectedMasterRecord.name}</h3>
                <p className="text-sm font-bold text-muted-foreground mt-1 italic">"{selectedMasterRecord.message}"</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase text-accent/60 tracking-widest">Price</p>
                <p className="text-3xl font-black text-accent">{selectedMasterRecord.price}</p>
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">What's Inside (Included Items)</Label>
              <div className="grid grid-cols-1 gap-2">
                {selectedMasterRecord.items?.map((id: string) => {
                  const m = (menu || []).find(item => item.id === id);
                  return (
                    <div key={id} className="flex items-center justify-between p-3 bg-secondary/20 rounded-xl border border-secondary/30">
                      <div className="flex items-center gap-3">
                        {m?.imageUrl && <div className="w-10 h-10 rounded-lg overflow-hidden border border-white shadow-sm"><img src={m.imageUrl} className="object-cover w-full h-full" /></div>}
                        <span className="font-bold text-sm">{m?.name || 'Unknown Item'}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] uppercase font-black">{m?.type}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      case 'orders':
      case 'order-summary':
        const rider = selectedMasterRecord.assignedTo ? (users || []).find(u => u.id === selectedMasterRecord.assignedTo) : null;
        const pkgData = selectedMasterRecord.packageName ? (packages || []).find(p => p.name === selectedMasterRecord.packageName) : null;
        return (
          <div className="space-y-8">
            {pkgData?.imageUrl && (
              <div className="relative aspect-video w-full rounded-[2.5rem] overflow-hidden border-2 border-secondary shadow-sm group/image">
                <img src={pkgData.imageUrl} alt="Package" className="object-cover w-full h-full" />
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity">
                      <ZoomIn className="w-10 h-10 text-white" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-none">
                    <div className="relative w-full aspect-video rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl">
                      <img src={pkgData.imageUrl} alt="Package Enlarge" className="object-cover w-full h-full" />
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Customer Hub</Label>
                <div className="flex items-start gap-4 bg-secondary/20 p-4 rounded-2xl border border-secondary/30">
                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm"><User className="w-6 h-6 text-primary" /></div>
                  <div className="flex-1">
                    <p className="font-black text-slate-900 text-lg leading-tight">{selectedMasterRecord.customerName}</p>
                    <p className="text-xs font-bold text-primary mt-1 flex items-center gap-1.5"><Phone className="w-3 h-3" /> {selectedMasterRecord.mobile}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 bg-blue-50 p-4 rounded-2xl border border-blue-100">
                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm"><Truck className="w-6 h-6 text-blue-600" /></div>
                  <div className="flex-1">
                    <p className="font-black text-blue-900 leading-tight">{rider ? `${rider.firstName} ${rider.lastName}` : "Pending Rider"}</p>
                    <p className="text-[10px] font-bold text-blue-600/70 uppercase tracking-tighter mt-1">{rider ? `ID: ${rider.bacchabiteId}` : "Waiting for Logistics"}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Task Timeline</Label>
                <div className="bg-secondary/20 p-4 rounded-2xl border border-secondary/30 space-y-4">
                  <div className="flex items-center gap-3"><CalendarIcon className="w-4 h-4 text-primary" /><div><p className="text-[9px] font-black uppercase text-muted-foreground leading-none mb-1">Booking Date</p><p className="text-xs font-bold text-slate-900">{format(safeParseDate(selectedMasterRecord.createdAt), 'PPP')}</p></div></div>
                  <div className="flex items-center gap-3"><Clock className="w-4 h-4 text-primary" /><div><p className="text-[9px] font-black uppercase text-muted-foreground leading-none mb-1">Slot & Time</p><p className="text-xs font-bold text-slate-900">{selectedMasterRecord.slot} • {selectedMasterRecord.deliveryTime}</p></div></div>
                </div>
                <div className="bg-secondary/20 p-4 rounded-2xl border border-secondary/30 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm"><MapPin className="w-6 h-6 text-accent" /></div>
                  <div className="flex-1"><p className="text-xs font-bold text-slate-700 leading-relaxed">{selectedMasterRecord.address}</p></div>
                </div>
              </div>
            </div>
            <div className="bg-secondary/10 p-6 rounded-[2rem] space-y-3 border border-secondary/30">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Order Content</p>
                <Badge variant="outline" className="text-[9px] font-black uppercase text-primary font-black">{selectedMasterRecord.type}</Badge>
              </div>
              {(selectedMasterRecord.items || []).map((item: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-sm font-bold bg-white p-3 rounded-xl shadow-sm">
                  <span>{item.quantity}x {item.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] h-4 uppercase">{item.type}</Badge>
                    <span className="text-primary font-black">Rs {item.price}</span>
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t border-secondary/50 flex justify-between items-center mt-4">
                <div>
                  <p className="font-black text-muted-foreground uppercase text-[10px]">Payment: {selectedMasterRecord.paymentStatus?.toUpperCase() || 'PENDING'}</p>
                  <span className="font-black text-slate-400 text-[10px]">TOTAL BILLABLE AMOUNT:</span>
                </div>
                <span className="font-black text-2xl text-accent">Rs {selectedMasterRecord.total}</span>
              </div>
            </div>
          </div>
        );
      case 'suppliers':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4 bg-secondary/20 p-6 rounded-[2rem] border border-secondary/30">
              <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-sm"><Truck className="w-8 h-8 text-primary" /></div>
              <div><h3 className="text-2xl font-black text-slate-900">{selectedMasterRecord.name}</h3><p className="text-sm font-bold text-primary">Partner Since: {format(safeParseDate(selectedMasterRecord.createdAt), 'PP')}</p></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Contact Person</p><p className="font-bold">{selectedMasterRecord.contactPerson}</p></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Phone</p><p className="font-bold">{selectedMasterRecord.phone}</p></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Email</p><p className="font-bold">{selectedMasterRecord.email}</p></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Address</p><p className="font-medium text-sm">{selectedMasterRecord.address}</p></div>
            </div>
          </div>
        );
      case 'customers':
      case 'delivery':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4 bg-secondary/20 p-6 rounded-[2rem] border border-secondary/30">
              <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-sm">{activeLogType === 'customers' ? <User className="w-8 h-8 text-primary" /> : <Truck className="w-8 h-8 text-blue-600" />}</div>
              <div><h3 className="text-2xl font-black text-slate-900">{selectedMasterRecord.firstName} {selectedMasterRecord.lastName}</h3><p className="text-sm font-bold text-accent">ID: {selectedMasterRecord.bacchabiteId}</p></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Mobile Number</p><p className="font-bold">{selectedMasterRecord.mobileNumber}</p></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Email Address</p><p className="font-bold">{selectedMasterRecord.email}</p></div>
              {selectedMasterRecord.address && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Primary Address</p><p className="font-medium text-sm">{selectedMasterRecord.address}</p></div>
              )}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Joined On</p><p className="font-bold">{format(safeParseDate(selectedMasterRecord.createdAt), 'PPPP')}</p></div>
            </div>
          </div>
        );
      case 'mfg-logs':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4 bg-secondary/20 p-6 rounded-[2rem] border border-secondary/30">
              <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-sm"><Factory className="w-8 h-8 text-primary" /></div>
              <div><h3 className="text-2xl font-black text-slate-900">{selectedMasterRecord.packageName}</h3><p className="text-sm font-bold text-primary">Production Run: {format(safeParseDate(selectedMasterRecord.date), 'PPpp')}</p></div>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Units Manufactured</p><p className="text-3xl font-black text-accent">{selectedMasterRecord.quantity} Sets</p></div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Ingredient Consumption Breakdown</Label>
              <Table className="border rounded-xl overflow-hidden">
                <TableHeader className="bg-secondary/10"><TableRow><TableHead className="font-bold text-[10px] uppercase">Ingredient</TableHead><TableHead className="text-right font-bold text-[10px] uppercase">Qty Used</TableHead></TableRow></TableHeader>
                <TableBody>
                  {selectedMasterRecord.ingredientsUsed?.map((ing: any, idx: number) => (
                    <TableRow key={idx}><TableCell className="font-bold text-xs">{ing.name}</TableCell><TableCell className="text-right font-black text-sm text-primary">{ing.quantity} {ing.unitName}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      case 'payments':
      case 'receipts':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4 bg-secondary/20 p-6 rounded-[2rem] border border-secondary/30">
              <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-sm">{activeLogType === 'payments' ? <ArrowUpRight className="w-8 h-8 text-red-600" /> : <ArrowDownLeft className="w-8 h-8 text-green-600" />}</div>
              <div><h3 className="text-2xl font-black text-slate-900">{activeLogType === 'payments' ? selectedMasterRecord.supplierName : selectedMasterRecord.customerName}</h3><p className="text-sm font-black text-accent">ID: {selectedMasterRecord.id}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Transaction Date</p><p className="font-bold">{format(safeParseDate(selectedMasterRecord.date), 'PPPP')}</p></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Method</p><Badge variant="secondary" className="bg-secondary/50 text-muted-foreground border-none font-bold uppercase text-[9px]">{selectedMasterRecord.paymentMethod}</Badge></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2 text-center"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Settled Amount</p><p className="text-4xl font-black text-primary">Rs {selectedMasterRecord.amount}</p></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Narration / Notes</p><p className="text-sm font-medium italic">"{selectedMasterRecord.notes || 'No internal notes added.'}"</p></div>
            </div>
            {selectedMasterRecord.orderIds?.length > 0 && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Associated Orders</Label>
                <div className="flex flex-wrap gap-2">{selectedMasterRecord.orderIds.map((id: string) => <Badge key={id} variant="outline" className="rounded-lg text-[9px] font-black border-secondary">#{id.substr(0,8)}</Badge>)}</div>
              </div>
            )}
          </div>
        );
      case 'transactions':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4 bg-secondary/20 p-6 rounded-[2rem] border border-secondary/30">
              <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-sm">{selectedMasterRecord.type === 'Income' ? <TrendingUp className="w-8 h-8 text-green-600" /> : <TrendingDown className="w-8 h-8 text-red-600" />}</div>
              <div><h3 className="text-2xl font-black text-slate-900">{selectedMasterRecord.categoryName}</h3><Badge className={cn("mt-1 border-none font-black uppercase text-[10px]", selectedMasterRecord.type === 'Income' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>{selectedMasterRecord.type}</Badge></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Entry Date</p><p className="font-bold">{format(safeParseDate(selectedMasterRecord.date), 'PPPP')}</p></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Paid Via</p><p className="font-bold">{selectedMasterRecord.paymentMethod}</p></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2 text-center"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Cashflow Amount</p><p className={cn("text-4xl font-black", selectedMasterRecord.type === 'Income' ? "text-green-600" : "text-red-600")}>Rs {selectedMasterRecord.amount}</p></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Narration</p><p className="text-sm font-medium italic">"{selectedMasterRecord.notes || 'No description recorded.'}"</p></div>
            </div>
          </div>
        );
      case 'journal':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4 bg-accent p-6 rounded-[2rem] text-white">
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center shadow-sm"><BookText className="w-8 h-8" /></div>
              <div><h3 className="text-2xl font-black">Journal Voucher</h3><p className="text-sm font-bold opacity-80">Reference: {selectedMasterRecord.id}</p></div>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center mb-4"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Posting Date</p><p className="font-bold text-lg">{format(safeParseDate(selectedMasterRecord.date), 'PPPP')}</p></div>
            <div className="space-y-4 p-6 bg-secondary/20 rounded-[2rem] border border-secondary/30 relative overflow-hidden">
              <div className="flex items-center justify-between gap-4 relative z-10">
                <div className="flex-1"><p className="text-[9px] font-black uppercase text-green-700 tracking-widest mb-1">Account Debited (+)</p><p className="font-black text-lg leading-tight">{selectedMasterRecord.debitAccountName}</p></div>
                <div className="p-3 bg-white rounded-full shadow-sm border border-secondary"><ArrowRightLeft className="w-5 h-5 text-muted-foreground rotate-90" /></div>
                <div className="flex-1 text-right"><p className="text-[9px] font-black uppercase text-red-700 tracking-widest mb-1">Account Credited (-)</p><p className="font-black text-lg leading-tight">{selectedMasterRecord.creditAccountName}</p></div>
              </div>
              <div className="text-center pt-4 border-t border-secondary/30 relative z-10"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Voucher Amount</p><p className="text-4xl font-black text-accent">Rs {selectedMasterRecord.amount}</p></div>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Voucher Narration</p><p className="text-sm font-bold text-slate-700 italic leading-relaxed">"{selectedMasterRecord.notes}"</p></div>
          </div>
        );
      case 'trial-balance':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4 bg-secondary/20 p-6 rounded-[2rem] border border-secondary/30">
              <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-sm"><Calculator className="w-8 h-8 text-primary" /></div>
              <div><h3 className="text-2xl font-black text-slate-900">{selectedMasterRecord.name}</h3><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Ledger Balance Summary</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 p-6 rounded-[2rem] border border-green-100 text-center"><p className="text-[10px] font-black uppercase text-green-600 tracking-widest">Debit Side</p><p className="text-3xl font-black text-green-700">{selectedMasterRecord.debit}</p></div>
              <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100 text-center"><p className="text-[10px] font-black uppercase text-red-600 tracking-widest">Credit Side</p><p className="text-3xl font-black text-red-700">{selectedMasterRecord.credit}</p></div>
            </div>
            <div className="p-10 border-4 border-dashed border-secondary rounded-[3rem] text-center bg-white/50"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Statement Intelligence</p><p className="text-sm font-bold text-muted-foreground leading-relaxed mt-2 italic">"This view summarizes the total double-entry impact for this account head as of the selected period end."</p></div>
          </div>
        );
      default: return null;
    }
  };

  const handleRowClick = (row: any) => {
    setSelectedMasterRecord(row);
    setIsMasterDetailOpen(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 print:pb-0">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-headline font-bold text-accent">Business Reports</h1>
          <p className="text-muted-foreground mt-1 font-medium">Analyze real-time data from Cloud Firestore.</p>
        </div>
      </header>

      <Tabs 
        value={activeTab} 
        onValueChange={(v) => { 
          setActiveTab(v); 
          setActiveDetail(null); 
          setActiveLogType(null); 
          setSelectedStockItemId(null); 
          setSelectedLedgerEntityId(null);
          clearFilters();
        }} 
        className="w-full print:hidden"
      >
        <TabsList className="grid w-full grid-cols-4 max-w-2xl rounded-2xl h-14 bg-secondary/50 p-1 mb-8">
          <TabsTrigger value="accounting" className="rounded-xl font-bold h-full data-[state=active]:bg-white data-[state=active]:shadow-sm">Accounting</TabsTrigger>
          <TabsTrigger value="stock" className="rounded-xl font-bold h-full data-[state=active]:bg-white data-[state=active]:shadow-sm">Inventory</TabsTrigger>
          <TabsTrigger value="logs" className="rounded-xl font-bold h-full data-[state=active]:bg-white data-[state=active]:shadow-sm">Lists</TabsTrigger>
          <TabsTrigger value="final-accounts" className="rounded-xl font-bold h-full data-[state=active]:bg-white data-[state=active]:shadow-sm">Final Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="accounting" className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="rounded-[2rem] border-2 border-transparent bg-white shadow-sm overflow-hidden flex flex-col">
              <CardHeader className="p-5 pb-2 bg-accent/5">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-accent" />Ledger
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-1.5 flex-1">
                <div className="grid grid-cols-2 gap-1.5">
                  {(['supplier', 'customer', 'delivery', 'cash', 'bank', 'upi', 'capital', 'pnl'] as const).map(l => (
                    <Button key={l} variant="ghost" size="sm" onClick={() => handleCardClick(`ledger-${l}`)} className={cn("justify-start h-8 px-2 text-[10px] font-bold rounded-lg hover:bg-accent/10 capitalize", activeDetail === `ledger-${l}` && "bg-accent/10 text-accent")}>
                      {l === 'cash' ? <Coins className="w-3 h-3 mr-1.5" /> : l === 'bank' ? <Landmark className="w-3 h-3 mr-1.5" /> : l === 'upi' ? <UpiIcon className="w-3 h-3 mr-1.5" /> : l === 'capital' || l === 'pnl' ? <BookText className="w-3 h-3 mr-1.5" /> : <User className="w-3 h-3 mr-1.5" />} {l}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card onClick={() => handleCardClick('sales')} className={cn("rounded-[2rem] border-2 cursor-pointer transition-all duration-300 hover:shadow-lg", activeDetail === 'sales' ? "border-primary bg-primary/5" : "border-transparent bg-white")}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 rounded-2xl bg-green-100 text-green-600"><TrendingUp className="w-6 h-6" /></div>
                  <div><p className="text-[10px] font-black uppercase text-muted-foreground">Total Sales</p><p className="text-2xl font-black text-accent">{accountingSummary.totalSales}</p></div>
                </div>
                <div className="flex items-center justify-between"><Badge className="bg-green-100 text-green-700 text-[9px] font-bold border-none">Income</Badge><ArrowRight className="w-3 h-3 text-muted-foreground" /></div>
              </CardContent>
            </Card>

            <Card onClick={() => handleCardClick('purchases')} className={cn("rounded-[2rem] border-2 cursor-pointer transition-all duration-300 hover:shadow-lg", activeDetail === 'purchases' ? "border-primary bg-primary/5" : "border-transparent bg-white")}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 rounded-2xl bg-red-100 text-red-600"><TrendingDown className="w-6 h-6" /></div>
                  <div><p className="text-[10px] font-black uppercase text-muted-foreground">Purchases</p><p className="text-2xl font-black text-accent">{accountingSummary.totalPurchases}</p></div>
                </div>
                <div className="flex items-center justify-between"><Badge className="bg-red-100 text-red-700 text-[9px] font-bold border-none">Costs</Badge><ArrowRight className="w-3 h-3 text-muted-foreground" /></div>
              </CardContent>
            </Card>

            <Card onClick={() => handleCardClick('inflow')} className={cn("rounded-[2rem] border-2 cursor-pointer transition-all duration-300 hover:shadow-lg", activeDetail === 'inflow' ? "border-primary bg-primary/5" : "border-transparent bg-white")}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 rounded-2xl bg-blue-100 text-blue-600"><Wallet className="w-6 h-6" /></div>
                  <div><p className="text-[10px] font-black uppercase text-muted-foreground">Total Inflow</p><p className="text-2xl font-black text-accent">{accountingSummary.totalCashInflow}</p></div>
                </div>
                <div className="flex items-center justify-between"><Badge className="bg-blue-100 text-blue-700 text-[9px] font-bold border-none">Receipts</Badge><ArrowRight className="w-3 h-3 text-muted-foreground" /></div>
              </CardContent>
            </Card>

            <Card onClick={() => handleCardClick('outflow')} className={cn("rounded-[2rem] border-2 cursor-pointer transition-all duration-300 hover:shadow-lg", activeDetail === 'outflow' ? "border-primary bg-primary/5" : "border-transparent bg-white")}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 rounded-2xl bg-orange-100 text-orange-600"><CreditCard className="w-6 h-6" /></div>
                  <div><p className="text-[10px] font-black uppercase text-muted-foreground">Total Outflow</p><p className="text-2xl font-black text-accent">{accountingSummary.totalCashOutflow}</p></div>
                </div>
                <div className="flex items-center justify-between"><Badge className="bg-orange-100 text-orange-700 text-[9px] font-bold border-none">Payments</Badge><ArrowRight className="w-3 h-3 text-muted-foreground" /></div>
              </CardContent>
            </Card>
          </div>

          {activeDetail && (
            <div id="drill-down-view" className="space-y-6 animate-in slide-in-from-top-4 duration-500 print:m-0">
              <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white print:shadow-none print:rounded-none">
                <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
                  <div><CardTitle className="text-2xl font-headline font-bold capitalize">{activeDetail.startsWith('ledger-') ? `${activeDetail.replace('ledger-', '')} Ledger List` : `${activeDetail} Report`}</CardTitle></div>
                  <div className="flex items-center gap-2 print:hidden">
                    <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl gap-2 font-bold"><Printer className="w-4 h-4" /> Print</Button>
                    <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl gap-2 font-bold"><FileDown className="w-4 h-4" /> Export PDF</Button>
                    <Button variant="ghost" size="icon" onClick={() => { setActiveDetail(null); setSelectedLedgerEntityId(null); }} className="rounded-full"><X className="w-5 h-5" /></Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="p-8 pt-0 flex flex-col lg:flex-row gap-4 print:hidden">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="Search accounts..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-11 h-12 rounded-2xl bg-secondary/20 border-none" />
                    </div>
                    {showPeriodInAccounting && (
                      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-1 rounded-2xl shadow-sm border border-secondary/20">
                        <div className="flex items-center gap-2 px-3 h-10">
                          <CalendarDays className="w-4 h-4 text-muted-foreground" />
                          <span className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Period</span>
                        </div>
                        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 border-none bg-secondary/20 rounded-xl text-xs w-full sm:w-32" />
                        <span className="text-muted-foreground text-xs font-bold">to</span>
                        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 border-none bg-secondary/20 rounded-xl text-xs w-full sm:w-32" />
                        {(startDate || endDate || searchTerm) && (
                          <Button variant="ghost" size="icon" onClick={clearFilters} className="h-10 w-10 rounded-xl text-muted-foreground hover:text-destructive">
                            <FilterX className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  {activeDetail.startsWith('ledger-') && !selectedLedgerEntityId ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-secondary/20 border-none">
                          <TableHead className="font-bold py-5 pl-8">
                            <SortTrigger label="Account Name" sortKey="name" />
                            <FilterInput placeholder="Name..." value={colFilters.name} onChange={v => handleColFilterChange('name', v)} />
                          </TableHead>
                          <TableHead className="font-bold text-right">
                            <SortTrigger label="Opening" sortKey="opening" className="justify-end" />
                            <FilterInput placeholder="Amt" value={colFilters.opening} onChange={v => handleColFilterChange('opening', v)} />
                          </TableHead>
                          <TableHead className="font-bold text-right">
                            <SortTrigger label="Debit (+)" sortKey="debit" className="justify-end" />
                            <FilterInput placeholder="Amt" value={colFilters.debit} onChange={v => handleColFilterChange('debit', v)} />
                          </TableHead>
                          <TableHead className="font-bold text-right">
                            <SortTrigger label="Credit (-)" sortKey="credit" className="justify-end" />
                            <FilterInput placeholder="Amt" value={colFilters.credit} onChange={v => handleColFilterChange('credit', v)} />
                          </TableHead>
                          <TableHead className="font-bold pr-8 text-right">
                            <SortTrigger label="Closing" sortKey="closing" className="justify-end" />
                            <FilterInput placeholder="Amt" value={colFilters.closing} onChange={v => handleColFilterChange('closing', v)} />
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledgerData.map((row, i) => (
                          <TableRow key={i} className="hover:bg-primary/5 cursor-pointer border-b border-secondary/10 print:cursor-default" onClick={() => handleLedgerRowClick(row)}>
                            <TableCell className="py-6 pl-8">
                              <div className="font-bold text-sm group flex items-center gap-2">
                                {row.name} 
                                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 print:hidden" />
                              </div>
                              <div className="text-[10px] text-muted-foreground font-bold">{row.type}</div>
                            </TableCell>
                            <TableCell className="text-right font-black">{row.opening.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-black text-green-600">{row.debit.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-black text-red-600">{row.credit.toFixed(2)}</TableCell>
                            <TableCell className="pr-8 text-right">
                              <div className={cn("font-black text-lg", row.closing >= 0 ? "text-primary" : "text-destructive")}>
                                {Math.abs(row.closing).toFixed(2)}
                                <span className="text-[10px] ml-1 uppercase">{row.closing >= 0 ? 'Dr' : 'Cr'}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter className="bg-secondary/10 border-t-2 border-secondary/30">
                        <TableRow>
                          <TableCell className="font-black py-5 pl-8 uppercase text-xs tracking-widest text-muted-foreground">Summary Totals:</TableCell>
                          <TableCell className="text-right font-black">{ledgerTotals.opening.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-black text-green-600">{ledgerTotals.debit.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-black text-red-600">{ledgerTotals.credit.toFixed(2)}</TableCell>
                          <TableCell className="pr-8 text-right font-black text-2xl text-primary">{Math.abs(ledgerTotals.closing).toFixed(2)}</TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  ) : activeDetail.startsWith('ledger-') && selectedLedgerEntityId && dailyLedgerView ? (
                    <div id="daily-ledger-view" className="p-0 animate-in slide-in-from-right-4 duration-300 print:animate-none">
                      <div className="bg-secondary/30 p-6 flex flex-col md:flex-row items-center justify-between gap-4 border-b print:bg-white print:border-none">
                        <div className="flex items-center gap-4">
                          <Button variant="ghost" size="icon" onClick={() => setSelectedLedgerEntityId(null)} className="rounded-full bg-white shadow-sm h-10 w-10 print:hidden">
                            <ArrowLeft className="w-5 h-5" />
                          </Button>
                          <div>
                            <h3 className="text-xl font-black text-accent">{selectedLedgerEntityName}</h3>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Daily Transaction Ledger</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 print:hidden">
                          <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl gap-2 font-bold"><Printer className="w-4 h-4" /> Print</Button>
                          <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl gap-2 font-bold"><FileDown className="w-4 h-4" /> Export PDF</Button>
                        </div>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-secondary/10 border-none print:bg-secondary/20">
                            <TableHead className="font-bold py-4 pl-8"><SortTrigger label="Date" sortKey="date" /></TableHead>
                            <TableHead className="font-bold"><SortTrigger label="Bill No / Ref" sortKey="ref" /></TableHead>
                            <TableHead className="font-bold">Description</TableHead>
                            <TableHead className="font-bold text-right"><SortTrigger label="Debit" sortKey="debit" className="justify-end" /></TableHead>
                            <TableHead className="font-bold text-right"><SortTrigger label="Credit" sortKey="credit" className="justify-end" /></TableHead>
                            <TableHead className="font-bold text-right pr-8"><SortTrigger label="Balance" sortKey="balance" className="justify-end" /></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow className="bg-secondary/5 border-b border-secondary/10 font-bold italic">
                            <TableCell className="pl-8 py-4">{startDate ? format(parseISO(startDate), 'MMM dd, yyyy') : 'Start'}</TableCell>
                            <TableCell>-</TableCell>
                            <TableCell className="text-primary uppercase tracking-tighter">OPENING BALANCE</TableCell>
                            <TableCell className="text-right">-</TableCell>
                            <TableCell className="text-right">-</TableCell>
                            <TableCell className="text-right pr-8">{dailyLedgerView.openingBalance.toFixed(2)}</TableCell>
                          </TableRow>
                          {dailyLedgerView.transactions.map((t, idx) => (
                            <TableRow key={idx} className="hover:bg-secondary/5 border-b border-secondary/10">
                              <TableCell className="pl-8 py-4 font-medium">{format(safeParseDate(t.date), 'MMM dd, yyyy')}</TableCell>
                              <TableCell className="font-black text-xs uppercase text-accent">{t.ref}</TableCell>
                              <TableCell className="text-xs font-bold text-muted-foreground">{t.notes}</TableCell>
                              <TableCell className="text-right font-black text-green-600">{t.debit > 0 ? `${t.debit.toFixed(2)}` : '-'}</TableCell>
                              <TableCell className="text-right font-black text-red-600">{t.credit > 0 ? `${t.credit.toFixed(2)}` : '-'}</TableCell>
                              <TableCell className="text-right font-black pr-8 text-primary">{t.balance.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-primary/5 border-b border-secondary/10 font-black print:bg-secondary/10">
                            <TableCell className="pl-8 py-4">{endDate ? format(parseISO(endDate), 'MMM dd, yyyy') : 'End'}</TableCell>
                            <TableCell>-</TableCell>
                            <TableCell className="text-accent uppercase tracking-tighter">CLOSING BALANCE</TableCell>
                            <TableCell className="text-right">-</TableCell>
                            <TableCell className="text-right">-</TableCell>
                            <TableCell className="text-right pr-8 text-xl text-primary">{dailyLedgerView.closingBalance.toFixed(2)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-secondary/20 border-none">
                          <TableHead className="font-bold py-5 pl-8">
                            <SortTrigger label="ID / Ref" sortKey="id" />
                            <FilterInput placeholder="Ref" value={colFilters.id} onChange={v => handleColFilterChange('id', v)} />
                          </TableHead>
                          <TableHead className="font-bold">
                            <SortTrigger label="Party Name" sortKey="name" />
                            <FilterInput placeholder="Name" value={colFilters.name} onChange={v => handleColFilterChange('name', v)} />
                          </TableHead>
                          <TableHead className="font-bold"><SortTrigger label="Date" sortKey="date" /></TableHead>
                          <TableHead className="font-bold">
                            <SortTrigger label="Amount" sortKey="amount" />
                            <FilterInput placeholder="Amt" value={colFilters.amount} onChange={v => handleColFilterChange('amount', v)} />
                          </TableHead>
                          <TableHead className="font-bold pr-8 text-right">
                            <SortTrigger label="Status" sortKey="status" className="justify-end" />
                            <FilterInput placeholder="Stat" value={colFilters.status} onChange={v => handleColFilterChange('status', v)} />
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {drillDownData.map((item, i) => (
                          <TableRow key={i} className="hover:bg-secondary/5 border-b border-secondary/10">
                            <TableCell className="py-6 pl-8">
                              <div className="font-black text-sm text-accent">{item.id}</div>
                              <div className="text-[10px] text-muted-foreground font-bold">{item.ref}</div>
                            </TableCell>
                            <TableCell className="font-bold text-sm">{item.name}</TableCell>
                            <TableCell className="text-sm font-medium">{format(safeParseDate(item.date), 'MMM dd, yyyy')}</TableCell>
                            <TableCell className="font-black text-lg text-primary">{item.amount}</TableCell>
                            <TableCell className="pr-8 text-right"><Badge variant="outline" className="rounded-lg font-bold uppercase text-[9px]">{item.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter className="bg-secondary/10 border-t-2 border-secondary/30">
                        <TableRow>
                          <TableCell colSpan={3} className="text-right font-black py-5 uppercase text-xs tracking-widest text-muted-foreground">Report Total Amount:</TableCell>
                          <TableCell className="font-black text-2xl text-primary">{drillDownTotalAmount.toFixed(2)}</TableCell>
                          <TableCell className="pr-8"></TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="stock" className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
            <Card className="rounded-[2rem] border-none shadow-sm bg-white overflow-hidden">
              <CardContent className="p-6 flex items-center gap-6">
                <div className="p-5 bg-accent rounded-3xl text-white shadow-lg shadow-accent/20"><Archive className="w-8 h-8" /></div>
                <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Inventory Items</p><p className="text-3xl font-black text-accent">{(stockData || []).length} Active Items</p></div>
              </CardContent>
            </Card>
            <Card className="rounded-[2rem] border-none shadow-sm bg-white overflow-hidden">
              <CardContent className="p-6 flex items-center gap-6">
                <div className="p-5 bg-yellow-100 rounded-3xl text-yellow-600"><Archive className="w-8 h-8" /></div>
                <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Critical Stock</p><p className="text-3xl font-black text-yellow-600">{(stockData || []).filter(i => i.isLow).length} Alerts</p></div>
              </CardContent>
            </Card>
          </div>

          {selectedStockItemId && itemStockLedger ? (
            <div id="stock-drill-down" className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 print:m-0">
              <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white print:shadow-none print:rounded-none">
                <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between bg-primary/5 border-b">
                  <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedStockItemId(null)} className="rounded-full bg-white shadow-sm h-10 w-10 print:hidden">
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                      <CardTitle className="text-2xl font-headline font-bold">{itemStockLedger.item.name} Stock Ledger</CardTitle>
                      <CardDescription>Weighted Average Valuation • Unit: {(units || []).find(u => u.id === itemStockLedger.item.baseUnitId)?.name}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 print:hidden">
                    <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl gap-2 font-bold"><Printer className="w-4 h-4" /> Print</Button>
                    <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl gap-2 font-bold"><FileDown className="w-4 h-4" /> Export PDF</Button>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedStockItemId(null)} className="rounded-full"><X className="w-5 h-5" /></Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-secondary border-b bg-secondary/10">
                    <div className="p-6 text-center">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Opening</p>
                      <p className="text-xl font-black mt-1">{itemStockLedger.opening.qty.toFixed(2)}</p>
                      <p className="text-[10px] font-bold text-muted-foreground">Value: {itemStockLedger.opening.val.toFixed(2)}</p>
                    </div>
                    <div className="p-6 text-center">
                      <p className="text-[10px] font-black uppercase text-green-600 tracking-widest">Total Inward</p>
                      <p className="text-xl font-black mt-1 text-green-600">+{itemStockLedger.inward.qty.toFixed(2)}</p>
                      <p className="text-[10px] font-bold text-muted-foreground">Value: {itemStockLedger.inward.val.toFixed(2)}</p>
                    </div>
                    <div className="p-6 text-center">
                      <p className="text-[10px] font-black uppercase text-red-600 tracking-widest">Total Outward</p>
                      <p className="text-xl font-black mt-1 text-red-600">-{itemStockLedger.outward.qty.toFixed(2)}</p>
                      <p className="text-[10px] font-bold text-muted-foreground">Value: {itemStockLedger.outward.val.toFixed(2)}</p>
                    </div>
                    <div className="p-6 text-center">
                      <p className="text-[10px] font-black uppercase text-primary tracking-widest">Closing Balance</p>
                      <p className="text-xl font-black mt-1 text-primary">{itemStockLedger.closing.qty.toFixed(2)}</p>
                      <p className="text-[10px] font-bold text-muted-foreground">Value: {itemStockLedger.closing.val.toFixed(2)}</p>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/20 border-none">
                        <TableHead className="pl-8 py-4 font-bold">Date</TableHead>
                        <TableHead className="font-bold">Ref No</TableHead>
                        <TableHead className="font-bold">Type</TableHead>
                        <TableHead className="text-right font-bold">Qty In</TableHead>
                        <TableHead className="text-right font-bold">Rate In</TableHead>
                        <TableHead className="text-right font-bold">Qty Out</TableHead>
                        <TableHead className="text-right font-bold">Value Out</TableHead>
                        <TableHead className="text-right font-bold">Bal Qty</TableHead>
                        <TableHead className="text-right font-bold pr-8">WAC Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="bg-secondary/5 font-bold italic">
                        <TableCell className="pl-8 py-4">{startDate || 'Initial'}</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell className="text-primary uppercase">PERIOD OPENING</TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right">{itemStockLedger.opening.qty.toFixed(2)}</TableCell>
                        <TableCell className="text-right pr-8">{(itemStockLedger.opening.qty > 0 ? itemStockLedger.opening.val / itemStockLedger.opening.qty : 0).toFixed(2)}</TableCell>
                      </TableRow>
                      {itemStockLedger.movements.map((m, idx) => (
                        <TableRow key={idx} className="hover:bg-secondary/5 border-b border-secondary/10">
                          <TableCell className="pl-8 py-4 font-medium">{format(safeParseDate(m.date), 'MMM dd, yyyy')}</TableCell>
                          <TableCell className="font-black text-xs uppercase text-accent">{m.ref}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(
                              "rounded-lg font-black text-[8px] uppercase h-5",
                              m.type === 'Inward' ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                            )}>
                              {m.type === 'Inward' ? <ArrowDownLeft className="w-2.5 h-2.5 mr-1" /> : <ArrowUpRight className="w-2.5 h-2.5 mr-1" />}
                              {m.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-black text-green-600">{m.type === 'Inward' ? `+${m.qty.toFixed(2)}` : '-'}</TableCell>
                          <TableCell className="text-right font-bold">{m.type === 'Inward' ? m.rate.toFixed(2) : '-'}</TableCell>
                          <TableCell className="text-right font-black text-red-600">{m.type === 'Outward' ? `-${m.qty.toFixed(2)}` : '-'}</TableCell>
                          <TableCell className="text-right font-bold">{m.type === 'Outward' ? m.outVal.toFixed(2) : '-'}</TableCell>
                          <TableCell className="text-right font-black text-primary">{m.currentQty.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold pr-8 text-accent">{m.currentWac.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter className="bg-primary/5 border-t-2 border-secondary/30">
                      <TableRow>
                        <TableCell colSpan={7} className="text-right font-black py-6 uppercase text-xs tracking-widest text-muted-foreground">Current Net Stock Value:</TableCell>
                        <TableCell className="text-right font-black text-xl text-primary">{itemStockLedger.closing.qty.toFixed(2)}</TableCell>
                        <TableCell className="text-right pr-8 font-black text-2xl text-accent">{itemStockLedger.closing.val.toFixed(2)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white print:shadow-none print:rounded-none">
              <CardHeader className="p-8 pb-4 flex items-center justify-between">
                <CardTitle className="text-xl font-bold">Stock Availability Table</CardTitle>
                <div className="flex items-center gap-2 print:hidden">
                  <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl gap-2 font-bold"><Printer className="w-4 h-4" /> Print</Button>
                  <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl gap-2 font-bold"><FileDown className="w-4 h-4" /> Export PDF</Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/20 border-none">
                      <TableHead className="font-bold py-5 pl-8">
                        <SortTrigger label="Name" sortKey="name" />
                        <FilterInput placeholder="Item" value={colFilters.name} onChange={v => handleColFilterChange('name', v)} />
                      </TableHead>
                      <TableHead className="font-bold">
                        <SortTrigger label="Stock" sortKey="stock" />
                        <FilterInput placeholder="Qty" value={colFilters.qty} onChange={v => handleColFilterChange('qty', v)} />
                      </TableHead>
                      <TableHead className="font-bold">
                        <SortTrigger label="Value" sortKey="value" />
                        <FilterInput placeholder="Val" value={colFilters.value} onChange={v => handleColFilterChange('value', v)} />
                      </TableHead>
                      <TableHead className="font-bold pr-8 text-right">
                        <SortTrigger label="Status" sortKey="isLow" className="justify-end" />
                        <FilterInput placeholder="Stat" value={colFilters.status} onChange={v => handleColFilterChange('status', v)} />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(stockData || []).map((item) => (
                      <TableRow key={item.id} className={cn("hover:bg-primary/5 cursor-pointer border-b border-secondary/10 print:cursor-default", selectedStockItemId === item.id ? "bg-primary/10" : "")} onClick={() => handleStockItemClick(item.id)}>
                        <TableCell className="py-5 pl-8 font-bold text-sm group">
                          <div className="flex items-center gap-2">{item.name}<ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 print:hidden" /></div>
                        </TableCell>
                        <TableCell><div className="flex items-center gap-1 font-black text-lg">{item.stock.toFixed(2)} <span className="text-[10px] text-muted-foreground font-bold uppercase">{item.unit}</span></div></TableCell>
                        <TableCell><div className="font-black text-lg text-primary">{item.value.toFixed(2)}</div></TableCell>
                        <TableCell className="pr-8 text-right"><Badge className={cn("rounded-lg border-none font-bold uppercase text-[9px] px-3", item.isLow ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")}>{item.isLow ? 'Restock' : 'Healthy'}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter className="bg-secondary/10 border-t-2 border-secondary/30">
                    <TableRow>
                      <TableCell className="font-black py-5 pl-8 uppercase text-xs tracking-widest text-muted-foreground">Total Valuation:</TableCell>
                      <TableCell colSpan={2} className="font-black text-2xl text-accent">{totalStockValuation.toFixed(2)}</TableCell>
                      <TableCell className="pr-8"></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 print:hidden">
            {[
              { id: 'items', label: 'Inventory Items', icon: Package }, 
              { id: 'packages', label: 'Broadcast Packages', icon: LayoutGrid }, 
              { id: 'orders', label: 'Order Records', icon: ShoppingCart }, 
              { id: 'order-summary', label: 'Order Summary', icon: ClipboardList }, 
              { id: 'transactions', label: 'Inc / Exp Logs', icon: Wallet }, 
              { id: 'journal', label: 'Journal Logs', icon: BookText }, 
              { id: 'suppliers', label: 'Supplier Master', icon: Truck }, 
              { id: 'customers', label: 'Customer Master', icon: Users }, 
              { id: 'delivery', label: 'Rider Master', icon: UserCircle }, 
              { id: 'mfg-logs', label: 'Production Logs', icon: History }, 
              { id: 'payments', label: 'Payment Logs', icon: CreditCard }, 
              { id: 'receipts', label: 'Receipt Logs', icon: ReceiptText }, 
              { id: 'trial-balance', label: 'Account Summary', icon: Calculator }
            ].map((log) => {
              const LogIcon = log.icon;
              return (
                <Button key={log.id} variant={activeLogType === log.id ? "default" : "outline"} onClick={() => handleLogClick(log.id as LogType)} className={cn("flex flex-col items-center gap-2 h-auto py-4 rounded-2xl transition-all", activeLogType === log.id ? "shadow-lg scale-105" : "hover:bg-accent/5 hover:border-accent/30")}>
                  <LogIcon className={cn("w-6 h-6", activeLogType === log.id ? "text-white" : "text-primary")} /><span className="text-[10px] font-black uppercase tracking-tight">{log.label}</span>
                </Button>
              );
            })}
          </div>

          {activeLogType && (
            <div id="log-table-view" className="space-y-6 animate-in slide-in-from-top-4 duration-500 print:animate-none">
              <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white print:rounded-none print:shadow-none">
                <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
                  <div><CardTitle className="text-2xl font-headline font-bold capitalize">Master {activeLogType.replace('-', ' ')} List</CardTitle></div>
                  <div className="flex items-center gap-2 print:hidden">
                    <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl gap-2 font-bold"><Printer className="w-4 h-4" /> Print</Button>
                    <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl gap-2 font-bold"><FileDown className="w-4 h-4" /> Export PDF</Button>
                    <Button variant="ghost" size="icon" onClick={() => setActiveLogType(null)} className="rounded-full"><X className="w-5 h-5" /></Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="p-8 pt-0 flex flex-col lg:flex-row gap-4 print:hidden">
                    <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search records..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-11 h-12 rounded-2xl bg-secondary/20 border-none" /></div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-1 rounded-2xl shadow-sm border border-secondary/20">
                      <div className="flex items-center gap-2 px-3 h-10"><CalendarDays className="w-4 h-4 text-muted-foreground" /><span className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Period</span></div>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 border-none bg-secondary/20 rounded-xl text-xs w-full sm:w-32" /><span className="text-muted-foreground text-xs font-bold px-1">to</span><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 border-none bg-secondary/20 rounded-xl text-xs w-full sm:w-32" />
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/20 border-none">
                        {activeLogType === 'items' && (
                          <>
                            <TableHead className="pl-8 py-5"><SortTrigger label="Item Name" sortKey="c1" /><FilterInput placeholder="Name..." value={colFilters.c1} onChange={v => handleColFilterChange('c1', v)} /></TableHead>
                            <TableHead><SortTrigger label="Category" sortKey="c2" /><FilterInput placeholder="Category..." value={colFilters.c2} onChange={v => handleColFilterChange('c2', v)} /></TableHead>
                            <TableHead><SortTrigger label="Basic Unit" sortKey="c3" /><FilterInput placeholder="Unit..." value={colFilters.c3} onChange={v => handleColFilterChange('c3', v)} /></TableHead>
                            <TableHead className="pr-8 text-right"><SortTrigger label="Stock" sortKey="c4" className="justify-end" /><FilterInput placeholder="Qty..." value={colFilters.c4} onChange={v => handleColFilterChange('c4', v)} /></TableHead>
                          </>
                        )}
                        {activeLogType === 'packages' && (
                          <>
                            <TableHead className="pl-8 py-5"><SortTrigger label="Package Name" sortKey="c1" /><FilterInput placeholder="Name..." value={colFilters.c1} onChange={v => handleColFilterChange('c1', v)} /></TableHead>
                            <TableHead><SortTrigger label="Type" sortKey="c2" /><FilterInput placeholder="Type..." value={colFilters.c2} onChange={v => handleColFilterChange('c2', v)} /></TableHead>
                            <TableHead><SortTrigger label="Context" sortKey="c3" /><FilterInput placeholder="Date..." value={colFilters.c3} onChange={v => handleColFilterChange('c3', v)} /></TableHead>
                            <TableHead className="pr-8 text-right"><SortTrigger label="Price" sortKey="c4" className="justify-end" /><FilterInput placeholder="Amt..." value={colFilters.c4} onChange={v => handleColFilterChange('c4', v)} /></TableHead>
                          </>
                        )}
                        {activeLogType === 'orders' && (
                          <>
                            <TableHead className="pl-8 py-5"><SortTrigger label="Order ID" sortKey="c1" /><FilterInput placeholder="ID..." value={colFilters.c1} onChange={v => handleColFilterChange('c1', v)} /></TableHead>
                            <TableHead><SortTrigger label="Customer" sortKey="c2" /><FilterInput placeholder="Name..." value={colFilters.c2} onChange={v => handleColFilterChange('c2', v)} /></TableHead>
                            <TableHead><SortTrigger label="Slot" sortKey="c3" /><FilterInput placeholder="Slot..." value={colFilters.c3} onChange={v => handleColFilterChange('c3', v)} /></TableHead>
                            <TableHead className="pr-8 text-right"><SortTrigger label="Total" sortKey="c4" className="justify-end" /><FilterInput placeholder="Amt..." value={colFilters.c4} onChange={v => handleColFilterChange('c4', v)} /></TableHead>
                          </>
                        )}
                        {activeLogType === 'order-summary' && (
                          <>
                            <TableHead className="pl-8 py-5"><SortTrigger label="Date" sortKey="c1" /><FilterInput placeholder="Date..." value={colFilters.c1} onChange={v => handleColFilterChange('c1', v)} /></TableHead>
                            <TableHead><SortTrigger label="Customer" sortKey="c2" /><FilterInput placeholder="Name..." value={colFilters.c2} onChange={v => handleColFilterChange('c2', v)} /></TableHead>
                            <TableHead><SortTrigger label="Package" sortKey="c3" /><FilterInput placeholder="Package..." value={colFilters.c3} onChange={v => handleColFilterChange('c3', v)} /></TableHead>
                            <TableHead className="text-center"><SortTrigger label="Qty" sortKey="c4" className="justify-center" /><FilterInput placeholder="Qty..." value={colFilters.c4} onChange={v => handleColFilterChange('c4', v)} /></TableHead>
                            <TableHead><SortTrigger label="Slot" sortKey="c5" /><FilterInput placeholder="Slot..." value={colFilters.c5} onChange={v => handleColFilterChange('c5', v)} /></TableHead>
                            <TableHead className="pr-8 text-right"><SortTrigger label="Status" sortKey="c6" className="justify-end" /><FilterInput placeholder="Status..." value={colFilters.c6} onChange={v => handleColFilterChange('c6', v)} /></TableHead>
                          </>
                        )}
                        {activeLogType === 'suppliers' && (
                          <>
                            <TableHead className="pl-8 py-5"><SortTrigger label="Supplier Name" sortKey="c1" /><FilterInput placeholder="Name..." value={colFilters.c1} onChange={v => handleColFilterChange('c1', v)} /></TableHead>
                            <TableHead><SortTrigger label="Contact Person" sortKey="c2" /><FilterInput placeholder="Person..." value={colFilters.c2} onChange={v => handleColFilterChange('c2', v)} /></TableHead>
                            <TableHead><SortTrigger label="Phone" sortKey="c3" /><FilterInput placeholder="Phone..." value={colFilters.c3} onChange={v => handleColFilterChange('c3', v)} /></TableHead>
                            <TableHead className="pr-8 text-right"><SortTrigger label="Email" sortKey="c4" className="justify-end" /><FilterInput placeholder="Email..." value={colFilters.c4} onChange={v => handleColFilterChange('c4', v)} /></TableHead>
                          </>
                        )}
                        {(activeLogType === 'customers' || activeLogType === 'delivery') && (
                          <>
                            <TableHead className="pl-8 py-5"><SortTrigger label="Name" sortKey="c1" /><FilterInput placeholder="Name..." value={colFilters.c1} onChange={v => handleColFilterChange('c1', v)} /></TableHead>
                            <TableHead><SortTrigger label="ID" sortKey="c2" /><FilterInput placeholder="ID..." value={colFilters.c2} onChange={v => handleColFilterChange('c2', v)} /></TableHead>
                            <TableHead><SortTrigger label="Mobile" sortKey="c3" /><FilterInput placeholder="Mobile..." value={colFilters.c3} onChange={v => handleColFilterChange('c3', v)} /></TableHead>
                            <TableHead className="pr-8 text-right"><SortTrigger label="Email" sortKey="c4" className="justify-end" /><FilterInput placeholder="Email..." value={colFilters.c4} onChange={v => handleColFilterChange('c4', v)} /></TableHead>
                          </>
                        )}
                        {activeLogType === 'mfg-logs' && (
                          <>
                            <TableHead className="pl-8 py-5"><SortTrigger label="Date" sortKey="c1" /><FilterInput placeholder="Date..." value={colFilters.c1} onChange={v => handleColFilterChange('c1', v)} /></TableHead>
                            <TableHead><SortTrigger label="Package" sortKey="c2" /><FilterInput placeholder="Package..." value={colFilters.c2} onChange={v => handleColFilterChange('c2', v)} /></TableHead>
                            <TableHead><SortTrigger label="Quantity" sortKey="c3" /><FilterInput placeholder="Qty..." value={colFilters.c3} onChange={v => handleColFilterChange('c3', v)} /></TableHead>
                            <TableHead className="pr-8 text-right"><SortTrigger label="Ingredients" sortKey="c4" className="justify-end" /><FilterInput placeholder="Count..." value={colFilters.c4} onChange={v => handleColFilterChange('c4', v)} /></TableHead>
                          </>
                        )}
                        {(activeLogType === 'payments' || activeLogType === 'receipts') && (
                          <>
                            <TableHead className="pl-8 py-5"><SortTrigger label="ID" sortKey="c1" /><FilterInput placeholder="ID..." value={colFilters.c1} onChange={v => handleColFilterChange('c1', v)} /></TableHead>
                            <TableHead><SortTrigger label="Party" sortKey="c2" /><FilterInput placeholder="Name..." value={colFilters.c2} onChange={v => handleColFilterChange('c2', v)} /></TableHead>
                            <TableHead><SortTrigger label="Date" sortKey="c3" /><FilterInput placeholder="Date..." value={colFilters.c3} onChange={v => handleColFilterChange('c3', v)} /></TableHead>
                            <TableHead className="text-right pr-8"><SortTrigger label="Amount" sortKey="c4" className="justify-end" /><FilterInput placeholder="Amt..." value={colFilters.c4} onChange={v => handleColFilterChange('c4', v)} /></TableHead>
                          </>
                        )}
                        {activeLogType === 'transactions' && (
                          <>
                            <TableHead className="pl-8 py-5"><SortTrigger label="Date" sortKey="c1" /><FilterInput placeholder="Date..." value={colFilters.c1} onChange={v => handleColFilterChange('c1', v)} /></TableHead>
                            <TableHead><SortTrigger label="Type" sortKey="c2" /><FilterInput placeholder="Type..." value={colFilters.c2} onChange={v => handleColFilterChange('c2', v)} /></TableHead>
                            <TableHead><SortTrigger label="Category" sortKey="c3" /><FilterInput placeholder="Category..." value={colFilters.c3} onChange={v => handleColFilterChange('c3', v)} /></TableHead>
                            <TableHead className="text-right pr-8"><SortTrigger label="Amount" sortKey="c4" className="justify-end" /><FilterInput placeholder="Amt..." value={colFilters.c4} onChange={v => handleColFilterChange('c4', v)} /></TableHead>
                          </>
                        )}
                        {activeLogType === 'trial-balance' && (
                          <>
                            <TableHead className="pl-8 py-5"><SortTrigger label="Account Name" sortKey="c1" /><FilterInput placeholder="Account..." value={colFilters.c1} onChange={v => handleColFilterChange('c1', v)} /></TableHead>
                            <TableHead className="text-right"><SortTrigger label="Debit" sortKey="c2" className="justify-end" /><FilterInput placeholder="Dr..." value={colFilters.c2} onChange={v => handleColFilterChange('c2', v)} /></TableHead>
                            <TableHead className="pr-8 text-right"><SortTrigger label="Credit" sortKey="c3" className="justify-end" /><FilterInput placeholder="Cr..." value={colFilters.c3} onChange={v => handleColFilterChange('c3', v)} /></TableHead>
                          </>
                        )}
                        {activeLogType === 'journal' && (
                          <>
                            <TableHead className="pl-8 py-5"><SortTrigger label="Date" sortKey="c1" /><FilterInput placeholder="Date..." value={colFilters.c1} onChange={v => handleColFilterChange('c1', v)} /></TableHead>
                            <TableHead><SortTrigger label="Debit Account" sortKey="c2" /><FilterInput placeholder="Dr Acc..." value={colFilters.c2} onChange={v => handleColFilterChange('c2', v)} /></TableHead>
                            <TableHead><SortTrigger label="Credit Account" sortKey="c3" /><FilterInput placeholder="Cr Acc..." value={colFilters.c3} onChange={v => handleColFilterChange('c3', v)} /></TableHead>
                            <TableHead className="text-right"><SortTrigger label="Amount" sortKey="c4" className="justify-end" /><FilterInput placeholder="Amt..." value={colFilters.c4} onChange={v => handleColFilterChange('c4', v)} /></TableHead>
                            <TableHead className="pr-8 text-right"><SortTrigger label="Narration" sortKey="c5" className="justify-end" /><FilterInput placeholder="Notes..." value={colFilters.c5} onChange={v => handleColFilterChange('c5', v)} /></TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(logTableData || []).map((row, i) => {
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
                          c2Val = item.contactPerson || '';
                          c3Val = item.phone || '';
                          c4Val = item.email || '';
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
                        }

                        return (
                          <TableRow 
                            key={i} 
                            className="hover:bg-primary/5 border-b border-secondary/10 cursor-pointer transition-colors"
                            onClick={() => handleRowClick(row)}
                          >
                            <TableCell className="pl-8 py-6 font-bold">{c1Val}</TableCell>
                            <TableCell>{c2Val}</TableCell>
                            <TableCell>{c3Val}</TableCell>
                            <TableCell className={cn("text-right font-black text-primary", activeLogType === 'order-summary' ? "text-center" : "pr-8")}>{c4Val}</TableCell>
                            {activeLogType === 'order-summary' && (
                              <>
                                <TableCell>{c5Val}</TableCell>
                                <TableCell className="pr-8 text-right"><Badge variant="outline" className="text-[9px] uppercase font-bold">{c6Val}</Badge></TableCell>
                              </>
                            )}
                            {activeLogType === 'journal' && (
                              <TableCell className="pr-8 text-right italic text-[10px] text-muted-foreground">{c5Val}</TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    {activeLogType === 'order-summary' && (
                      <TableFooter className="bg-secondary/10 border-t-2 border-secondary/30">
                        <TableRow>
                          <TableCell colSpan={3} className="text-right font-black py-5 uppercase text-xs tracking-widest text-muted-foreground">Total Summary:</TableCell>
                          <TableCell className="text-center font-black text-xl text-primary">{orderSummaryTotals.qty} Sets</TableCell>
                          <TableCell colSpan={2} className="font-black text-2xl text-accent pl-8">{orderSummaryTotals.amount.toFixed(2)}</TableCell>
                        </TableRow>
                      </TableFooter>
                    )}
                    {activeLogType === 'trial-balance' && (
                      <TableFooter className="bg-secondary/10 border-t-2 border-secondary/30">
                        <TableRow>
                          <TableCell className="font-black py-5 pl-8 uppercase text-xs tracking-widest text-muted-foreground">Totals:</TableCell>
                          <TableCell className="text-right font-black text-xl text-primary">{trialBalanceTotals.debit.toFixed(2)}</TableCell>
                          <TableCell className="pr-8 text-right font-black text-xl text-accent">{trialBalanceTotals.credit.toFixed(2)}</TableCell>
                        </TableRow>
                      </TableFooter>
                    )}
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="final-accounts" className="space-y-12">
          <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white">
            <CardHeader className="p-8 bg-primary/5 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-headline font-bold">Trading Account</CardTitle>
                <CardDescription>For the period {startDate || 'Start'} to {endDate || 'Today'}</CardDescription>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl gap-2 font-bold"><Printer className="w-4 h-4" /> Print</Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl gap-2 font-bold"><FileDown className="w-4 h-4" /> Export PDF</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/20 hover:bg-secondary/20 border-none">
                    <TableHead className="font-bold py-4 pl-8 uppercase text-[10px] tracking-widest w-1/2">Particulars (Dr)</TableHead>
                    <TableHead className="font-bold py-4 text-right uppercase text-[10px] tracking-widest">Amount</TableHead>
                    <TableHead className="font-bold py-4 pl-8 uppercase text-[10px] tracking-widest w-1/2">Particulars (Cr)</TableHead>
                    <TableHead className="font-bold py-4 text-right pr-8 uppercase text-[10px] tracking-widest">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="pl-8 py-4 font-medium">To Opening Stock</TableCell>
                    <TableCell className="text-right font-bold">{finalAccounts.trading.openingStock.toFixed(2)}</TableCell>
                    <TableCell className="pl-8 py-4 font-medium">By Sales (Net)</TableCell>
                    <TableCell className="text-right pr-8 font-bold">{finalAccounts.trading.sales.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8 py-4 font-medium">To Purchases</TableCell>
                    <TableCell className="text-right font-bold">{finalAccounts.trading.purchases.toFixed(2)}</TableCell>
                    <TableCell className="pl-8 py-4 font-medium">By Closing Stock</TableCell>
                    <TableCell className="text-right pr-8 font-bold">{finalAccounts.trading.closingStock.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-secondary/5">
                    <TableCell className="pl-8 py-4 font-black text-primary italic">To Gross Profit c/d</TableCell>
                    <TableCell className="text-right font-black text-primary">{Math.max(0, finalAccounts.trading.grossProfit).toFixed(2)}</TableCell>
                    <TableCell className="pl-8 py-4 font-black text-destructive italic">{finalAccounts.trading.grossProfit < 0 ? 'By Gross Loss c/d' : ''}</TableCell>
                    <TableCell className="text-right pr-8 font-black text-destructive">{finalAccounts.trading.grossProfit < 0 ? Math.abs(finalAccounts.trading.grossProfit).toFixed(2) : ''}</TableCell>
                  </TableRow>
                </TableBody>
                <TableFooter className="bg-secondary/10 border-t-2 border-secondary/30">
                  <TableRow>
                    <TableCell className="pl-8 font-black py-5 uppercase text-[10px] tracking-widest">Total</TableCell>
                    <TableCell className="text-right font-black text-xl">{Math.max(finalAccounts.trading.sales + finalAccounts.trading.closingStock, finalAccounts.trading.openingStock + finalAccounts.trading.purchases + Math.max(0, finalAccounts.trading.grossProfit)).toFixed(2)}</TableCell>
                    <TableCell className="pl-8 font-black py-5 uppercase text-[10px] tracking-widest">Total</TableCell>
                    <TableCell className="text-right pr-8 font-black text-xl">{Math.max(finalAccounts.trading.sales + finalAccounts.trading.closingStock, finalAccounts.trading.openingStock + finalAccounts.trading.purchases + Math.max(0, finalAccounts.trading.grossProfit)).toFixed(2)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white">
            <CardHeader className="p-8 bg-accent/5 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-headline font-bold">Profit & Loss Account</CardTitle>
                <CardDescription>Indirect Income and Expenses Analysis</CardDescription>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl gap-2 font-bold"><Printer className="w-4 h-4" /> Print</Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl gap-2 font-bold"><FileDown className="w-4 h-4" /> Export PDF</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/20 hover:bg-secondary/20 border-none">
                    <TableHead className="font-bold py-4 pl-8 uppercase text-[10px] tracking-widest w-1/2">Expenses (Dr)</TableHead>
                    <TableHead className="font-bold py-4 text-right uppercase text-[10px] tracking-widest">Amount</TableHead>
                    <TableHead className="font-bold py-4 pl-8 uppercase text-[10px] tracking-widest w-1/2">Incomes (Cr)</TableHead>
                    <TableHead className="font-bold py-4 text-right pr-8 uppercase text-[10px] tracking-widest">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="pl-8 py-4 font-medium italic text-muted-foreground">{finalAccounts.pl.grossProfit < 0 ? 'To Gross Loss b/d' : '-'}</TableCell>
                    <TableCell className="text-right font-bold">{finalAccounts.pl.grossProfit < 0 ? Math.abs(finalAccounts.pl.grossProfit).toFixed(2) : ''}</TableCell>
                    <TableCell className="pl-8 py-4 font-medium italic text-muted-foreground">{finalAccounts.pl.grossProfit >= 0 ? 'By Gross Profit b/d' : '-'}</TableCell>
                    <TableCell className="text-right pr-8 font-bold">{finalAccounts.pl.grossProfit >= 0 ? finalAccounts.pl.grossProfit.toFixed(2) : ''}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8 py-4 font-medium">To Indirect Expenses</TableCell>
                    <TableCell className="text-right font-bold">{finalAccounts.pl.indirectExpense.toFixed(2)}</TableCell>
                    <TableCell className="pl-8 py-4 font-medium">By Indirect Income</TableCell>
                    <TableCell className="text-right pr-8 font-bold">{finalAccounts.pl.indirectIncome.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-secondary/5">
                    <TableCell className="pl-8 py-4 font-black text-green-600 italic">To Net Profit (Transferred to Capital)</TableCell>
                    <TableCell className="text-right font-black text-green-600">{Math.max(0, finalAccounts.pl.netProfit).toFixed(2)}</TableCell>
                    <TableCell className="pl-8 py-4 font-black text-destructive italic">{finalAccounts.pl.netProfit < 0 ? 'By Net Loss' : ''}</TableCell>
                    <TableCell className="text-right pr-8 font-black text-destructive">{finalAccounts.pl.netProfit < 0 ? Math.abs(finalAccounts.pl.netProfit).toFixed(2) : ''}</TableCell>
                  </TableRow>
                </TableBody>
                <TableFooter className="bg-secondary/10 border-t-2 border-secondary/30">
                  <TableRow>
                    <TableCell className="pl-8 font-black py-5 uppercase text-[10px] tracking-widest">Total</TableCell>
                    <TableCell className="text-right font-black text-xl">{Math.max(finalAccounts.pl.grossProfit >= 0 ? finalAccounts.pl.grossProfit + finalAccounts.pl.indirectIncome : finalAccounts.pl.indirectIncome, (finalAccounts.pl.grossProfit < 0 ? Math.abs(finalAccounts.pl.grossProfit) : 0) + finalAccounts.pl.indirectExpense + Math.max(0, finalAccounts.pl.netProfit)).toFixed(2)}</TableCell>
                    <TableCell className="pl-8 font-black py-5 uppercase text-[10px] tracking-widest">Total</TableCell>
                    <TableCell className="text-right pr-8 font-black text-xl">{Math.max(finalAccounts.pl.grossProfit >= 0 ? finalAccounts.pl.grossProfit + finalAccounts.pl.indirectIncome : finalAccounts.pl.indirectIncome, (finalAccounts.pl.grossProfit < 0 ? Math.abs(finalAccounts.pl.grossProfit) : 0) + finalAccounts.pl.indirectExpense + Math.max(0, finalAccounts.pl.netProfit)).toFixed(2)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] border-none shadow-md overflow-hidden bg-white">
            <CardHeader className="p-8 bg-blue-600 text-white border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-headline font-bold">Balance Sheet</CardTitle>
                <CardDescription className="text-white/70">As on {endDate || format(new Date(), 'MMM dd, yyyy')}</CardDescription>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl gap-2 font-bold bg-white/10 border-white/20 hover:bg-white/20"><Printer className="w-4 h-4" /> Print</Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl gap-2 font-bold bg-white/10 border-white/20 hover:bg-white/20"><FileDown className="w-4 h-4" /> Export PDF</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/20 hover:bg-secondary/20 border-none">
                    <TableHead className="font-bold py-4 pl-8 uppercase text-[10px] tracking-widest w-1/2">Liabilities</TableHead>
                    <TableHead className="font-bold py-4 text-right uppercase text-[10px] tracking-widest">Amount</TableHead>
                    <TableHead className="font-bold py-4 pl-8 uppercase text-[10px] tracking-widest w-1/2">Assets</TableHead>
                    <TableHead className="font-bold py-4 text-right pr-8 uppercase text-[10px] tracking-widest">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: Math.max(finalAccounts.bs.assets.length, finalAccounts.bs.liabilities.length) }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="pl-8 py-4">
                        {finalAccounts.bs.liabilities[idx] ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{finalAccounts.bs.liabilities[idx].name}</span>
                            {finalAccounts.bs.liabilities[idx].name === 'Capital Account' && finalAccounts.pl.netProfit !== 0 && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                {finalAccounts.pl.netProfit > 0 ? <Plus className="w-2 h-2 text-green-600" /> : <X className="w-2 h-2 text-red-600" />}
                                {finalAccounts.pl.netProfit > 0 ? 'Add Net Profit' : 'Less Net Loss'}
                              </span>
                            )}
                          </div>
                        ) : ''}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {finalAccounts.bs.liabilities[idx] ? finalAccounts.bs.liabilities[idx].value.toFixed(2) : ''}
                      </TableCell>
                      <TableCell className="pl-8 py-4 font-medium">{finalAccounts.bs.assets[idx]?.name || ''}</TableCell>
                      <TableCell className="text-right pr-8 font-bold">{finalAccounts.bs.assets[idx] ? finalAccounts.bs.assets[idx].value.toFixed(2) : ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="bg-blue-50 border-t-2 border-blue-100">
                  <TableRow>
                    <TableCell className="pl-8 font-black py-6 uppercase text-[10px] tracking-widest text-blue-600/60">Total Liabilities</TableCell>
                    <TableCell className="text-right font-black text-2xl text-blue-600">
                      {(finalAccounts.bs.totalLiabilities + (finalAccounts.pl.netProfit > 0 ? finalAccounts.pl.netProfit : 0)).toFixed(2)}
                    </TableCell>
                    <TableCell className="pl-8 font-black py-6 uppercase text-[10px] tracking-widest text-blue-600/60">Total Assets</TableCell>
                    <TableCell className="text-right font-black text-2xl text-blue-600">
                      {finalAccounts.bs.totalAssets.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Master Detail Dialog */}
      <Dialog open={isMasterDetailOpen} onOpenChange={setIsMasterDetailOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-2xl overflow-hidden p-0 border-none shadow-2xl">
          {selectedMasterRecord && (
            <>
              <DialogHeader className="bg-accent p-8 text-white">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge variant="outline" className="bg-white/10 text-white border-white/20 uppercase font-black text-[10px] tracking-widest mb-2">Record Intelligence</Badge>
                    <DialogTitle className="text-3xl font-headline font-bold leading-none">
                      {selectedMasterRecord.name || selectedMasterRecord.firstName || `ID: ${selectedMasterRecord.id?.substr(0,8)}`}
                    </DialogTitle>
                  </div>
                  <Badge className="bg-white text-accent border-none font-black text-[10px] rounded-lg">
                    {activeLogType?.toUpperCase().replace('-', ' ')}
                  </Badge>
                </div>
              </DialogHeader>
              <div className="p-8 bg-white overflow-y-auto max-h-[70vh]">
                <MasterDetailContent />
              </div>
              <DialogFooter className="bg-slate-50 p-6 flex items-center justify-center">
                <Button onClick={() => setIsMasterDetailOpen(false)} className="bg-slate-900 text-white hover:bg-slate-800 rounded-xl px-10 font-bold h-12">Close Record</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

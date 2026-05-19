
"use client";

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  CalendarDays, 
  Printer, 
  FileDown, 
  Scale, 
  ArrowRight, 
  PlusCircle, 
  MinusCircle,
  Loader2
} from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay, isBefore, isAfter, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Order, Purchase, Payment, CustomerReceipt, GeneralTransaction, JournalEntry, RawItem, User as BBUser, Supplier, GLAccount } from '@/lib/types';
import { downloadPDF } from '@/lib/pdf-export';

const safeParseDate = (d: any): Date => {
  if (!d) return new Date(0);
  if (d instanceof Date) return d;
  if (typeof d === 'object' && 'seconds' in d) return new Date(d.seconds * 1000);
  if (typeof d === 'string') return parseISO(d);
  return new Date(0);
};

export default function FinalAccountsPage() {
  const [mounted, setMounted] = useState(false);
  const firestore = useFirestore();

  // Firestore Data
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

  const { data: rawItemsData } = useCollection<RawItem>(useMemoFirebase(() => collection(firestore, 'raw_items'), [firestore]));
  const rawItems = rawItemsData || [];

  const { data: usersData } = useCollection<BBUser>(useMemoFirebase(() => collection(firestore, 'users'), [firestore]));
  const users = usersData || [];

  const { data: suppliersData } = useCollection<Supplier>(useMemoFirebase(() => collection(firestore, 'suppliers'), [firestore]));
  const suppliers = suppliersData || [];

  const { data: glAccountsData } = useCollection<GLAccount>(useMemoFirebase(() => collection(firestore, 'gl_accounts'), [firestore]));
  const glAccounts = glAccountsData || [];

  const { data: mfgLogsData } = useCollection<any>(useMemoFirebase(() => collection(firestore, 'manufacturing_logs'), [firestore]));
  const mfgLogs = mfgLogsData || [];

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => { setMounted(true); }, []);

  const handlePrint = () => { window.print(); };

  const handleExportPDF = () => {
    const head = [['Particulars (Debit)', 'Amount', 'Particulars (Credit)', 'Amount']];
    const body = [
      [{ content: 'TRADING ACCOUNT', colSpan: 4, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }],
      ['To Opening Stock', finalAccounts.trading.openingStock.toFixed(2), 'By Sales (Net)', finalAccounts.trading.sales.toFixed(2)],
      ['To Purchases', finalAccounts.trading.purchases.toFixed(2), 'By Closing Stock', finalAccounts.trading.closingStock.toFixed(2)],
      ['To Gross Profit c/d', Math.max(0, finalAccounts.trading.grossProfit).toFixed(2), 'By Gross Loss c/d', finalAccounts.trading.grossProfit < 0 ? Math.abs(finalAccounts.trading.grossProfit).toFixed(2) : '-'],
      ['', '', '', ''],
      [{ content: 'PROFIT & LOSS ACCOUNT', colSpan: 4, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }],
      ['To Gross Loss b/d', finalAccounts.pl.grossProfit < 0 ? Math.abs(finalAccounts.pl.grossProfit).toFixed(2) : '-', 'By Gross Profit b/d', finalAccounts.pl.grossProfit >= 0 ? finalAccounts.pl.grossProfit.toFixed(2) : '-'],
      ['To Indirect Expenses', finalAccounts.pl.indirectExpense.toFixed(2), 'By Indirect Income', finalAccounts.pl.indirectIncome.toFixed(2)],
      ['To Net Profit', Math.max(0, finalAccounts.pl.netProfit).toFixed(2), 'By Net Loss', finalAccounts.pl.netProfit < 0 ? Math.abs(finalAccounts.pl.netProfit).toFixed(2) : '-'],
      ['', '', '', ''],
      [{ content: 'BALANCE SHEET', colSpan: 4, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }],
    ];
    downloadPDF("Final Accounts Statement", head, body, "final_accounts");
  };

  const getComputedItemStock = (rawItemId: string, upToDate?: string) => {
    const item = rawItems.find(ri => ri.id === rawItemId);
    if (!item) return { qty: 0, value: 0 };
    let qty = Number(item.openingStock || 0);
    let val = Number(item.openingValue || 0);
    let wac = qty > 0 ? val / qty : 0;
    
    const cutoff = upToDate ? endOfDay(parseISO(upToDate)) : null;
    const movements: any[] = [];
    
    purchases.filter(p => p.status === 'Received').forEach(p => {
      const i = p.items?.find((x: any) => x.rawItemId === rawItemId);
      if (i) movements.push({ date: p.date, type: 'In', qty: i.quantity, rate: i.rate, amount: i.amount });
    });
    mfgLogs.forEach(l => {
      const i = l.ingredientsUsed?.find((x: any) => x.rawItemId === rawItemId);
      if (i) movements.push({ date: l.date.split('T')[0], type: 'Out', qty: i.quantity });
    });

    movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    movements.forEach(m => {
      if (cutoff && isAfter(safeParseDate(m.date), cutoff)) return;
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
    return { qty, value: Math.max(0, val) };
  };

  const finalAccounts = useMemo(() => {
    const startF = startDate ? startOfDay(parseISO(startDate)) : null;
    const endF = endDate ? endOfDay(parseISO(endDate)) : null;

    const isInRange = (d: any) => { 
      const dt = safeParseDate(d); 
      return (!startF || !isBefore(dt, startF)) && (!endF || !isAfter(dt, endF)); 
    };
    
    const asOfEnd = (d: any) => { 
      const dt = safeParseDate(d); 
      return !endF || !isAfter(dt, endF); 
    };

    // 1. Trading Account components
    const salesVal = orders.filter(o => o.status !== 'Cancelled' && isInRange(o.createdAt)).reduce((s, o) => s + o.total, 0);
    const purchasesTotal = purchases.filter(p => isInRange(p.date)).reduce((s, p) => s + p.totalAmount, 0);
    
    const openingStockVal = rawItems.reduce((s, item) => {
      if (!startDate) return s + (item.openingValue || 0);
      const prevDate = subDays(parseISO(startDate), 1);
      return s + getComputedItemStock(item.id, format(prevDate, 'yyyy-MM-dd')).value;
    }, 0);

    const closingStockVal = rawItems.reduce((s, i) => s + getComputedItemStock(i.id, endDate || undefined).value, 0);
    const grossProfit = (salesVal + closingStockVal) - (openingStockVal + purchasesTotal);
    
    // 2. P&L components
    const incVal = transactions.filter(t => t.type === 'Income' && isInRange(t.date)).reduce((s, t) => s + t.amount, 0);
    const expVal = transactions.filter(t => t.type === 'Expense' && isInRange(t.date)).reduce((s, t) => s + t.amount, 0);
    
    const netProfit = grossProfit + incVal - expVal;
    
    // 3. Balance Sheet components - fully dynamic accounts
    const getAccountBalance = (accId: string, group: string, opening: number, opType: string) => {
      let bal = opType === 'Debit' ? opening : -opening;
      
      // Add Receipts/Payments impacts if it matches a method head
      if (['CASH', 'BANK', 'UPI'].includes(accId)) {
        const methodMap: Record<string, string> = { CASH: 'Cash', BANK: 'Bank Transfer', UPI: 'UPI' };
        const label = methodMap[accId];
        const i = receipts.filter(r => r.paymentMethod === label && asOfEnd(r.date)).reduce((s, r) => s + r.amount, 0) +
                  transactions.filter(t => t.type === 'Income' && t.paymentMethod === label && asOfEnd(t.date)).reduce((s, t) => s + t.amount, 0);
        const o = payments.filter(p => p.paymentMethod === label && asOfEnd(p.date)).reduce((s, p) => s + p.amount, 0) +
                  transactions.filter(t => t.type === 'Expense' && t.paymentMethod === label && asOfEnd(t.date)).reduce((s, t) => s + t.amount, 0);
        bal += (i - o);
      }

      // Add Journal impact
      const jvs = journalEntries.filter(j => (j.debitAccountId === accId || j.creditAccountId === accId) && asOfEnd(j.date));
      jvs.forEach(j => { bal += (j.debitAccountId === accId ? j.amount : -j.amount); });
      return bal;
    };

    const debtors = users.filter(u => u.role === 'customer').reduce((sum, c) => {
        const s = orders.filter(o => o.customerId === c.id && o.status !== 'Cancelled' && asOfEnd(o.createdAt)).reduce((v, o) => v + o.total, 0);
        const r = receipts.filter(rcp => rcp.customerId === c.id && asOfEnd(rcp.date)).reduce((v, rcp) => v + rcp.amount, 0);
        const jv = journalEntries.filter(j => (j.debitAccountId === c.id || j.creditAccountId === c.id) && asOfEnd(j.date))
                        .reduce((v, j) => v + (j.debitAccountId === c.id ? j.amount : -j.amount), 0);
        return sum + Math.max(0, (s + jv) - r);
    }, 0);

    const creditors = suppliers.reduce((sum, s) => {
        const p = purchases.filter(pur => pur.supplierId === s.id && asOfEnd(pur.date)).reduce((v, pur) => v + pur.totalAmount, 0);
        const pm = payments.filter(pay => pay.supplierId === s.id && asOfEnd(pay.date)).reduce((v, pay) => v + pay.amount, 0);
        const jv = journalEntries.filter(j => (j.debitAccountId === s.id || j.creditAccountId === s.id) && asOfEnd(j.date))
                        .reduce((v, j) => v + (j.creditAccountId === s.id ? j.amount : -j.amount), 0);
        return sum + Math.max(0, (p + jv) - pm);
    }, 0);

    const dynamicAssets = glAccounts.filter(acc => ['Fixed Assets', 'Investment', 'Cash', 'Bank', 'UPI', 'Advance Given', 'Loan Given', 'Outstanding Income', 'Pre-paid Expense'].includes(acc.group))
                                    .map(acc => ({ 
                                      name: acc.name, 
                                      value: getAccountBalance(acc.id, acc.group, acc.openingBalance, acc.openingType), 
                                      id: `ledger-${acc.group.toLowerCase()}`, 
                                      entityId: acc.id 
                                    }));

    const dynamicLiabilities = glAccounts.filter(acc => ['Secured Loan', 'Unsecured Loan', 'Outstanding Expense', 'Pre-received Income', 'Reserves and Surplus'].includes(acc.group))
                                         .map(acc => ({ 
                                           name: acc.name, 
                                           value: -getAccountBalance(acc.id, acc.group, acc.openingBalance, acc.openingType), 
                                           id: `ledger-${acc.group.toLowerCase()}`,
                                           entityId: acc.id 
                                         }));

    const drawingsTotal = glAccounts.filter(acc => acc.group === 'Drawings').reduce((sum, acc) => sum + getAccountBalance(acc.id, acc.group, acc.openingBalance, acc.openingType), 0);
    const capitalRaw = glAccounts.filter(acc => acc.group === 'Capital').reduce((sum, acc) => sum - getAccountBalance(acc.id, acc.group, acc.openingBalance, acc.openingType), 0);

    const assetList = [
      ...dynamicAssets,
      { name: 'Closing Stock', value: closingStockVal, id: 'inventory' },
      { name: 'Sundry Debtors', value: debtors, id: 'ledger-customer' }
    ].filter(a => Math.abs(a.value) > 0.01);

    const liabilityList = [
      ...dynamicLiabilities,
      { name: 'Capital Account', value: capitalRaw + (netProfit > 0 ? netProfit : 0) - Math.abs(drawingsTotal), id: 'ledger-capital' },
      { name: 'Sundry Creditors', value: creditors, id: 'ledger-supplier' }
    ].filter(l => Math.abs(l.value) > 0.01);

    return { 
      trading: { sales: salesVal, purchases: purchasesTotal, openingStock: openingStockVal, closingStock: closingStockVal, grossProfit },
      pl: { grossProfit, indirectIncome: incVal, indirectExpense: expVal, netProfit },
      bs: { 
        assets: assetList,
        liabilities: liabilityList,
        totalAssets: assetList.reduce((s, a) => s + a.value, 0),
        totalLiabilities: liabilityList.reduce((s, l) => s + l.value, 0)
      }
    };
  }, [startDate, endDate, orders, purchases, rawItems, transactions, receipts, payments, suppliers, users, glAccounts, journalEntries, mfgLogs]);

  if (ordersLoading && orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Generating Reports...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-headline font-bold text-accent">Final Accounts</h1>
          <p className="text-muted-foreground mt-1 font-medium">Dynamically calculated financial statements for the selected period.</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="flex items-center gap-2 bg-white p-1 rounded-2xl shadow-sm border border-secondary/20">
             <div className="flex items-center gap-2 px-3 h-10"><CalendarDays className="w-4 h-4 text-muted-foreground" /><span className="text-[10px] font-black uppercase text-muted-foreground">Period</span></div>
             <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 border-none bg-secondary/20 rounded-xl text-xs w-32" />
             <span className="text-muted-foreground text-xs font-bold">to</span>
             <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 border-none bg-secondary/20 rounded-xl text-xs w-32" />
          </div>
        </div>
      </header>

      {/* Trading Account Card */}
      <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white">
        <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between border-b">
          <CardTitle className="text-2xl font-headline font-bold text-slate-900">Trading Account</CardTitle>
          <div className="flex items-center gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl h-10 px-4 gap-2 font-bold bg-white border-secondary">
              <Printer className="w-4 h-4" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl h-10 px-4 gap-2 font-bold bg-white border-secondary">
              <FileDown className="w-4 h-4" /> Export PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/20 hover:bg-secondary/20 border-none">
                <TableHead className="pl-8 py-3 uppercase text-[10px] font-black w-[35%]">Particulars (Debit Side)</TableHead>
                <TableHead className="text-right w-[15%] uppercase text-[10px] font-black">Amount</TableHead>
                <TableHead className="pl-8 py-3 uppercase text-[10px] font-black w-[35%]">Particulars (Credit Side)</TableHead>
                <TableHead className="text-right pr-8 w-[15%] uppercase text-[10px] font-black">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="border-b border-secondary/10">
                <TableCell className="pl-8 py-5">
                  <Link href="/admin/reports/inventory" className="font-medium text-sm hover:text-primary transition-colors">To Opening Stock</Link>
                </TableCell>
                <TableCell className="text-right font-bold">{finalAccounts.trading.openingStock.toFixed(2)}</TableCell>
                <TableCell className="pl-8 py-5">
                  <Link href="/admin/reports/accounting?type=sales" className="font-medium text-sm hover:text-primary transition-colors">By Sales (Net)</Link>
                </TableCell>
                <TableCell className="text-right pr-8 font-bold">{finalAccounts.trading.sales.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow className="border-b border-secondary/10">
                <TableCell className="pl-8 py-5">
                  <Link href="/admin/reports/accounting?type=purchases" className="font-medium text-sm hover:text-primary transition-colors">To Purchases</Link>
                </TableCell>
                <TableCell className="text-right font-bold">{finalAccounts.trading.purchases.toFixed(2)}</TableCell>
                <TableCell className="pl-8 py-5">
                  <Link href="/admin/reports/inventory" className="font-medium text-sm hover:text-primary transition-colors">By Closing Stock</Link>
                </TableCell>
                <TableCell className="text-right pr-8 font-bold">{finalAccounts.trading.closingStock.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow className="border-none">
                <TableCell className="pl-8 py-5">
                  {finalAccounts.trading.grossProfit >= 0 && (
                    <span className="font-bold text-sm text-primary italic">To Gross Profit c/d</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {finalAccounts.trading.grossProfit >= 0 && (
                    <span className="font-bold text-primary">{finalAccounts.trading.grossProfit.toFixed(2)}</span>
                  )}
                </TableCell>
                <TableCell className="pl-8 py-5">
                  {finalAccounts.trading.grossProfit < 0 && (
                    <span className="font-bold text-sm text-destructive italic">By Gross Loss c/d</span>
                  )}
                </TableCell>
                <TableCell className="text-right pr-8">
                  {finalAccounts.trading.grossProfit < 0 && (
                    <span className="font-bold text-destructive">{Math.abs(finalAccounts.trading.grossProfit).toFixed(2)}</span>
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
            <TableFooter className="bg-white border-t-2 border-secondary/30">
              <TableRow>
                <TableCell className="pl-8 py-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Total</TableCell>
                <TableCell className="text-right font-black text-2xl">
                  {Math.max(
                    finalAccounts.trading.sales + finalAccounts.trading.closingStock,
                    finalAccounts.trading.openingStock + finalAccounts.trading.purchases + (finalAccounts.trading.grossProfit > 0 ? finalAccounts.trading.grossProfit : 0)
                  ).toFixed(2)}
                </TableCell>
                <TableCell className="pl-8 py-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Total</TableCell>
                <TableCell className="text-right pr-8 font-black text-2xl">
                  {Math.max(
                    finalAccounts.trading.sales + finalAccounts.trading.closingStock,
                    finalAccounts.trading.openingStock + finalAccounts.trading.purchases + (finalAccounts.trading.grossProfit > 0 ? finalAccounts.trading.grossProfit : 0)
                  ).toFixed(2)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* P&L Account Card */}
      <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white">
        <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between border-b">
          <CardTitle className="text-2xl font-headline font-bold text-slate-900">Profit & Loss Account</CardTitle>
          <div className="flex items-center gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl h-10 px-4 gap-2 font-bold bg-white border-secondary">
              <Printer className="w-4 h-4" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl h-10 px-4 gap-2 font-bold bg-white border-secondary">
              <FileDown className="w-4 h-4" /> Export PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/20 hover:bg-secondary/20 border-none">
                <TableHead className="pl-8 py-3 uppercase text-[10px] font-black w-[35%]">Expenses (Debit)</TableHead>
                <TableHead className="text-right w-[15%] uppercase text-[10px] font-black">Amount</TableHead>
                <TableHead className="pl-8 py-3 uppercase text-[10px] font-black w-[35%]">Incomes (Credit)</TableHead>
                <TableHead className="text-right pr-8 w-[15%] uppercase text-[10px] font-black">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="border-b border-secondary/10">
                <TableCell className="pl-8 py-5">
                  {finalAccounts.pl.grossProfit < 0 ? (
                    <span className="font-medium text-sm">To Gross Loss b/d</span>
                  ) : '-'}
                </TableCell>
                <TableCell className="text-right font-bold">
                  {finalAccounts.pl.grossProfit < 0 ? Math.abs(finalAccounts.pl.grossProfit).toFixed(2) : ''}
                </TableCell>
                <TableCell className="pl-8 py-5">
                  {finalAccounts.pl.grossProfit >= 0 ? (
                    <span className="font-medium text-sm">By Gross Profit b/d</span>
                  ) : '-'}
                </TableCell>
                <TableCell className="text-right pr-8 font-bold">
                  {finalAccounts.pl.grossProfit >= 0 ? finalAccounts.pl.grossProfit.toFixed(2) : ''}
                </TableCell>
              </TableRow>
              <TableRow className="border-b border-secondary/10">
                <TableCell className="pl-8 py-5">
                  <Link href="/admin/reports/accounting?type=outflow" className="font-medium text-sm hover:text-primary transition-colors">To Indirect Expenses</Link>
                </TableCell>
                <TableCell className="text-right font-bold">{finalAccounts.pl.indirectExpense.toFixed(2)}</TableCell>
                <TableCell className="pl-8 py-5">
                  <Link href="/admin/reports/accounting?type=inflow" className="font-medium text-sm hover:text-primary transition-colors">By Indirect Income</Link>
                </TableCell>
                <TableCell className="text-right pr-8 font-bold">{finalAccounts.pl.indirectIncome.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow className="border-none">
                <TableCell className="pl-8 py-5">
                  {finalAccounts.pl.netProfit >= 0 && (
                    <span className="font-black text-sm text-green-600 italic">To Net Profit (Transferred to Capital)</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {finalAccounts.pl.netProfit >= 0 && (
                    <span className="font-black text-green-600">{finalAccounts.pl.netProfit.toFixed(2)}</span>
                  )}
                </TableCell>
                <TableCell className="pl-8 py-5">
                  {finalAccounts.pl.netProfit < 0 && (
                    <span className="font-black text-sm text-destructive italic">By Net Loss</span>
                  )}
                </TableCell>
                <TableCell className="text-right pr-8">
                  {finalAccounts.pl.netProfit < 0 && (
                    <span className="font-black text-destructive">{Math.abs(finalAccounts.pl.netProfit).toFixed(2)}</span>
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
            <TableFooter className="bg-white border-t-2 border-secondary/30">
              <TableRow>
                <TableCell className="pl-8 py-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Total</TableCell>
                <TableCell className="text-right font-black text-2xl">
                  {Math.max(
                    (finalAccounts.pl.grossProfit < 0 ? Math.abs(finalAccounts.pl.grossProfit) : 0) + finalAccounts.pl.indirectExpense + (finalAccounts.pl.netProfit > 0 ? finalAccounts.pl.netProfit : 0),
                    (finalAccounts.pl.grossProfit >= 0 ? finalAccounts.pl.grossProfit : 0) + finalAccounts.pl.indirectIncome + (finalAccounts.pl.netProfit < 0 ? Math.abs(finalAccounts.pl.netProfit) : 0)
                  ).toFixed(2)}
                </TableCell>
                <TableCell className="pl-8 py-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Total</TableCell>
                <TableCell className="text-right pr-8 font-black text-2xl">
                  {Math.max(
                    (finalAccounts.pl.grossProfit < 0 ? Math.abs(finalAccounts.pl.grossProfit) : 0) + finalAccounts.pl.indirectExpense + (finalAccounts.pl.netProfit > 0 ? finalAccounts.pl.netProfit : 0),
                    (finalAccounts.pl.grossProfit >= 0 ? finalAccounts.pl.grossProfit : 0) + finalAccounts.pl.indirectIncome + (finalAccounts.pl.netProfit < 0 ? Math.abs(finalAccounts.pl.netProfit) : 0)
                  ).toFixed(2)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* Balance Sheet Card - SOLID BLUE HEADER AS PER IMAGE */}
      <Card className="rounded-[2.5rem] border-none shadow-lg overflow-hidden bg-white">
        <CardHeader className="p-8 bg-blue-600 text-white flex flex-row items-center justify-between border-none">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-2xl"><Scale className="w-8 h-8 text-white" /></div>
            <div>
              <CardTitle className="text-3xl font-headline font-bold leading-none">Balance Sheet</CardTitle>
              <p className="text-sm text-blue-100 mt-2 font-medium">As on {endDate || format(new Date(), 'MMMM d, yyyy')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl h-10 px-4 gap-2 font-bold bg-white/10 border-white/20 text-white hover:bg-white/20">
              <Printer className="w-4 h-4" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl h-10 px-4 gap-2 font-bold bg-white/10 border-white/20 text-white hover:bg-white/20">
              <FileDown className="w-4 h-4" /> Export PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/10 hover:bg-secondary/10 border-none">
                <TableHead className="pl-8 py-4 uppercase text-[10px] font-black w-[35%] text-muted-foreground">Liabilities Side</TableHead>
                <TableHead className="text-right w-[15%] uppercase text-[10px] font-black text-muted-foreground">Amount</TableHead>
                <TableHead className="pl-8 py-4 uppercase text-[10px] font-black w-[35%] text-muted-foreground">Assets Side</TableHead>
                <TableHead className="text-right pr-8 w-[15%] uppercase text-[10px] font-black text-muted-foreground">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: Math.max(finalAccounts.bs.assets.length, finalAccounts.bs.liabilities.length) }).map((_, idx) => {
                const liab = finalAccounts.bs.liabilities[idx];
                const asset = finalAccounts.bs.assets[idx];
                return (
                  <TableRow key={idx} className="hover:bg-secondary/5 border-b border-secondary/10 last:border-none">
                    <TableCell className="pl-8 py-5">
                      {liab ? (
                        <Link href={liab.id === 'inventory' ? '/admin/reports/inventory' : `/admin/reports/accounting?type=${liab.id}&entityId=${liab.entityId || ''}`} className="group inline-flex flex-col">
                          <span className="font-bold text-sm text-slate-800 group-hover:text-primary transition-colors">{liab.name}</span>
                          {liab.name === 'Capital Account' && finalAccounts.pl.netProfit !== 0 && (
                            <span className={cn("text-[9px] font-black uppercase flex items-center gap-1", finalAccounts.pl.netProfit > 0 ? "text-green-600" : "text-red-600")}>
                              {finalAccounts.pl.netProfit > 0 ? <PlusCircle className="w-2.5 h-2.5" /> : <MinusCircle className="w-2.5 h-2.5" />}
                              {finalAccounts.pl.netProfit > 0 ? 'Add Net Profit' : 'Less Net Loss'}
                            </span>
                          )}
                        </Link>
                      ) : ''}
                    </TableCell>
                    <TableCell className="text-right font-bold text-slate-700">
                      {liab ? liab.value.toFixed(2) : ''}
                    </TableCell>
                    <TableCell className="pl-8 py-5">
                      {asset ? (
                        <Link href={asset.id === 'inventory' ? '/admin/reports/inventory' : `/admin/reports/accounting?type=${asset.id}&entityId=${asset.entityId || ''}`} className="group flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-800 group-hover:text-primary transition-colors">{asset.name}</span>
                          <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 print:hidden transition-all" />
                        </Link>
                      ) : ''}
                    </TableCell>
                    <TableCell className="text-right pr-8 font-bold text-slate-700">
                      {asset ? asset.value.toFixed(2) : ''}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter className="bg-blue-600 border-t-2 border-blue-500 text-white">
              <TableRow>
                <TableCell className="pl-8 py-8 font-black uppercase text-[10px] tracking-widest opacity-70">Total Liabilities</TableCell>
                <TableCell className="text-right font-black text-2xl">
                  {(finalAccounts.bs.totalLiabilities).toFixed(2)}
                </TableCell>
                <TableCell className="pl-8 py-8 font-black uppercase text-[10px] tracking-widest opacity-70">Total Assets</TableCell>
                <TableCell className="text-right pr-8 font-black text-2xl">
                  {finalAccounts.bs.totalAssets.toFixed(2)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

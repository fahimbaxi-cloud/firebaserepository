
"use client";

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Archive, 
  Search, 
  FilterX, 
  CalendarDays, 
  ArrowRight, 
  X, 
  ArrowLeft, 
  Printer, 
  FileDown, 
  ArrowUpDown, 
  ChevronUp, 
  ChevronDown, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Loader2 
} from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Purchase, ManufacturingLog, RawItem, Unit } from '@/lib/types';
import { downloadPDF } from '@/lib/pdf-export';

interface StockMovement {
  date: string;
  type: 'Inward' | 'Outward';
  qty: number;
  rate: number;
  amount: number;
  ref: string;
}

const safeParseDate = (d: any): Date => {
  if (!d) return new Date(0);
  if (d instanceof Date) return d;
  if (typeof d === 'object' && 'seconds' in d) return new Date(d.seconds * 1000);
  if (typeof d === 'string') return parseISO(d);
  return new Date(0);
};

export default function InventoryReportPage() {
  const [mounted, setMounted] = useState(false);
  const firestore = useFirestore();

  // Firestore Collections with Safe Defaulting
  const { data: purchasesData } = useCollection<Purchase>(useMemoFirebase(() => collection(firestore, 'purchases'), [firestore]));
  const purchases = purchasesData || [];
  
  const { data: mfgLogsData } = useCollection<ManufacturingLog>(useMemoFirebase(() => collection(firestore, 'manufacturing_logs'), [firestore]));
  const mfgLogs = mfgLogsData || [];
  
  const { data: rawItemsData, isLoading: itemsLoading } = useCollection<RawItem>(useMemoFirebase(() => collection(firestore, 'raw_items'), [firestore]));
  const rawItems = rawItemsData || [];
  
  const { data: unitsData } = useCollection<Unit>(useMemoFirebase(() => collection(firestore, 'units'), [firestore]));
  const units = unitsData || [];

  const [selectedStockItemId, setSelectedStockItemId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: '', direction: null });

  useEffect(() => { setMounted(true); }, []);

  const handlePrint = () => { window.print(); };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const SortTrigger = ({ label, sortKey, className }: { label: string, sortKey: string, className?: string }) => (
    <div className={cn("flex items-center gap-1 cursor-pointer group select-none", className)} onClick={() => handleSort(sortKey)}>
      <span className="group-hover:text-primary transition-colors">{label}</span>
      {sortConfig.key === sortKey ? (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />) : <ArrowUpDown className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary" />}
    </div>
  );

  const getComputedItemStock = (rawItemId: string, upToDate?: string) => {
    const item = rawItems.find(ri => ri.id === rawItemId);
    if (!item) return { qty: 0, value: 0, unit: '' };
    const unit = units.find(u => u.id === item.baseUnitId);
    let qty = Number(item.openingStock || 0);
    let val = Number(item.openingValue || 0);
    let wac = qty > 0 ? val / qty : 0;
    const movements: StockMovement[] = [];
    const cutoff = upToDate ? endOfDay(parseISO(upToDate)) : null;

    purchases.forEach(p => {
      const pDate = safeParseDate(p.date);
      if (cutoff && isAfter(pDate, cutoff)) return;
      if (p.status !== 'Received') return;
      const pItem = (p.items || []).find((i: any) => i.rawItemId === rawItemId);
      if (pItem) movements.push({ date: p.date, type: 'Inward', qty: Number(pItem.quantity), rate: Number(pItem.rate), amount: Number(pItem.amount), ref: p.id });
    });
    mfgLogs.forEach(log => {
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
        if (prevQty <= 0) { wac = m.rate; val = qty * wac; }
        else { val += m.amount; if (qty > 0) wac = val / qty; else { val = 0; wac = 0; } }
      } else { qty -= m.qty; val = qty * wac; }
      if (Math.abs(qty) < 0.000001) { qty = 0; val = 0; }
    });
    return { qty, value: Math.round(val * 100) / 100, unit: unit?.name || '', isLow: qty < 15 };
  };

  const stockData = useMemo(() => {
    const data = rawItems.map(item => {
      const computed = getComputedItemStock(item.id, endDate || undefined);
      return { id: item.id, name: item.name, stock: computed.qty, value: computed.value, unit: computed.unit, isLow: computed.isLow };
    }).filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));

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
  }, [rawItems, endDate, searchTerm, purchases, mfgLogs, units, sortConfig]);

  const totalStockValuation = useMemo(() => stockData.reduce((sum, i) => sum + i.value, 0), [stockData]);

  const itemStockLedger = useMemo(() => {
    if (!selectedStockItemId) return null;
    const item = rawItems.find(ri => ri.id === selectedStockItemId);
    if (!item) return null;
    
    let currentQty = Number(item.openingStock || 0);
    let currentVal = Number(item.openingValue || 0);
    let wac = currentQty > 0 ? currentVal / currentQty : 0;
    
    const mvs: any[] = [];
    purchases.filter(p => p.status === 'Received').forEach(p => { 
      const i = p.items?.find((x: any) => x.rawItemId === selectedStockItemId); 
      if (i) mvs.push({ date: p.date, type: 'Inward', qty: i.quantity, rate: i.rate, amount: i.amount, ref: p.id }); 
    });
    mfgLogs.forEach(l => { 
      const i = l.ingredientsUsed?.find(x => x.rawItemId === selectedStockItemId); 
      if (i) mvs.push({ date: l.date.split('T')[0], type: 'Outward', qty: i.quantity, ref: l.id }); 
    });
    mvs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let totalInQty = 0, totalInVal = 0, totalOutQty = 0, totalOutVal = 0;

    const processedMovements = mvs.map(m => {
      if (m.type === 'Inward') {
        const prevQty = currentQty;
        currentQty += m.qty;
        totalInQty += m.qty;
        totalInVal += m.amount;
        if (prevQty <= 0) wac = m.rate; else wac = (currentVal + m.amount) / currentQty;
        currentVal += m.amount;
      } else {
        const outValue = m.qty * wac;
        currentQty -= m.qty;
        totalOutQty += m.qty;
        totalOutVal += outValue;
        currentVal -= outValue;
      }
      return { ...m, currentQty, currentVal, wacRate: wac, outValue: m.type === 'Outward' ? m.qty * wac : 0 };
    });

    if (sortConfig.key && sortConfig.direction) {
      processedMovements.sort((a, b) => {
        const valA = (a as any)[sortConfig.key];
        const valB = (b as any)[sortConfig.key];
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return { 
      item, movements: processedMovements, 
      opening: { qty: Number(item.openingStock || 0), val: Number(item.openingValue || 0) },
      closing: { qty: currentQty, val: currentVal },
      inward: { qty: totalInQty, val: totalInVal },
      outward: { qty: totalOutQty, val: totalOutVal }
    };
  }, [selectedStockItemId, rawItems, purchases, mfgLogs, sortConfig]);

  const handleExportPDF = () => {
    let title = "Stock Status Report";
    let head = [['Item Name', 'Current Stock', 'Value', 'Status']];
    let body = stockData.map(s => [s.name, `${s.stock.toFixed(2)} ${s.unit}`, s.value.toFixed(2), s.isLow ? 'RESTOCK' : 'HEALTHY']);

    if (selectedStockItemId && itemStockLedger) {
      title = `Stock Ledger: ${itemStockLedger.item.name}`;
      head = [['Date', 'Ref', 'Type', 'Qty In', 'Qty Out', 'Balance']];
      body = itemStockLedger.movements.map(m => [m.date, m.ref, m.type, m.type === 'Inward' ? m.qty : '-', m.type === 'Outward' ? m.qty : '-', m.currentQty.toFixed(2)]);
    }

    downloadPDF(title, head, body, "inventory_report");
  };

  if (itemsLoading && rawItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Inventory Analytics Engine Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-headline font-bold text-accent">Inventory Analysis</h1>
        <p className="text-muted-foreground mt-1 font-medium italic">Track material movements and valuation.</p>
      </header>

      {!selectedStockItemId ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
            <Card className="rounded-[2.5rem] border-none shadow-sm bg-white overflow-hidden">
              <CardContent className="p-6 flex items-center gap-6">
                <div className="p-5 bg-accent rounded-3xl text-white shadow-lg shadow-accent/20"><Archive className="w-8 h-8" /></div>
                <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Inventory Items</p><p className="text-3xl font-black text-accent">{stockData.length} Active Items</p></div>
              </CardContent>
            </Card>
            <Card className="rounded-[2.5rem] border-none shadow-sm bg-white overflow-hidden">
              <CardContent className="p-6 flex items-center gap-6">
                <div className="p-5 bg-yellow-100 rounded-3xl text-yellow-600"><Archive className="w-8 h-8" /></div>
                <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Critical Stock</p><p className="text-3xl font-black text-yellow-600">{stockData.filter(i => i.isLow).length} Alerts</p></div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white print:shadow-none print:rounded-none">
            <CardHeader className="p-8 pb-4 flex items-center justify-between">
              <CardTitle className="text-xl font-bold">Stock Availability Table</CardTitle>
              <div className="flex items-center gap-2 print:hidden">
                <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl gap-2 font-bold bg-white"><Printer className="w-4 h-4 mr-2" /> Print</Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl gap-2 font-bold bg-white"><FileDown className="w-4 h-4 mr-2" /> Export PDF</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-8 pt-0 flex flex-col lg:flex-row gap-4 print:hidden">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search items..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-11 h-12 rounded-2xl bg-secondary/20 border-none" />
                </div>
                <div className="flex items-center gap-2 bg-white p-1 rounded-2xl shadow-sm border border-secondary/20 px-4">
                  <CalendarDays className="w-4 h-4 text-muted-foreground" /><span className="text-xs font-bold mr-2">Stock as of:</span>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 border-none bg-secondary/20 rounded-xl text-xs w-32" />
                </div>
              </div>
              <Table>
                <TableHeader><TableRow className="bg-secondary/10 border-none"><TableHead className="pl-8 py-5"><SortTrigger label="Name" sortKey="name" /></TableHead><TableHead><SortTrigger label="Stock" sortKey="stock" /></TableHead><TableHead><SortTrigger label="Valuation" sortKey="value" /></TableHead><TableHead className="pr-8 text-right"><SortTrigger label="Status" sortKey="isLow" /></TableHead></TableRow></TableHeader>
                <TableBody>{stockData.map((item) => (<TableRow key={item.id} className="hover:bg-primary/5 cursor-pointer border-b border-secondary/10" onClick={() => setSelectedStockItemId(item.id)}><TableCell className="py-5 pl-8 font-bold text-sm group flex items-center gap-2">{item.name} <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 print:hidden" /></TableCell><TableCell><div className="flex items-center gap-1 font-black text-lg">{item.stock.toFixed(2)} <span className="text-[10px] text-muted-foreground font-bold uppercase">{item.unit}</span></div></TableCell><TableCell><div className="font-black text-lg text-primary">{item.value.toFixed(2)}</div></TableCell><TableCell className="pr-8 text-right"><Badge className={cn("rounded-lg border-none font-black uppercase text-[8px] px-3", item.isLow ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")}>{item.isLow ? 'RESTOCK' : 'HEALTHY'}</Badge></TableCell></TableRow>))}</TableBody>
                <TableFooter className="bg-secondary/10 border-t-2 border-secondary/30"><TableRow><TableCell className="font-black py-8 pl-8 uppercase text-xs tracking-widest">Total Valuation:</TableCell><TableCell colSpan={3} className="font-black text-4xl text-accent pl-8">{totalStockValuation.toFixed(2)}</TableCell></TableRow></TableFooter>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 print:m-0">
          <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white print:shadow-none print:rounded-none">
            <CardHeader className="p-8 pb-4 flex items-center justify-between bg-secondary/10 border-b">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => setSelectedStockItemId(null)} className="rounded-full bg-white shadow-sm h-10 w-10 print:hidden"><ArrowLeft className="w-5 h-5" /></Button>
                <div>
                  <CardTitle className="text-2xl font-headline font-bold">{itemStockLedger?.item.name} Stock Ledger</CardTitle>
                  <CardDescription>Unit: {units.find(u => u.id === itemStockLedger?.item.baseUnitId)?.name}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl gap-2 font-bold bg-white"><Printer className="w-4 h-4 mr-2" /> Print</Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl gap-2 font-bold bg-white"><FileDown className="w-4 h-4 mr-2" /> Export PDF</Button>
                <Button variant="ghost" size="icon" onClick={() => setSelectedStockItemId(null)} className="rounded-full"><X className="w-5 h-5" /></Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
               <div className="grid grid-cols-2 md:grid-cols-4 divide-x border-b bg-secondary/5">
                 <div className="p-6 text-center"><p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Opening</p><p className="text-2xl font-black">{itemStockLedger?.opening.qty.toFixed(2)}</p></div>
                 <div className="p-6 text-center"><p className="text-[10px] font-black uppercase text-green-600 mb-1">Total Inward</p><p className="text-2xl font-black text-green-600">+{itemStockLedger?.inward.qty.toFixed(2)}</p></div>
                 <div className="p-6 text-center"><p className="text-[10px] font-black uppercase text-red-600 mb-1">Total Outward</p><p className="text-2xl font-black text-red-600">-{itemStockLedger?.outward.qty.toFixed(2)}</p></div>
                 <div className="p-6 text-center"><p className="text-[10px] font-black uppercase text-accent mb-1">Closing</p><p className="text-2xl font-black text-accent">{itemStockLedger?.closing.qty.toFixed(2)}</p></div>
               </div>
               <Table>
                 <TableHeader><TableRow className="bg-secondary/10"><TableHead className="pl-8 py-4 font-bold"><SortTrigger label="Date" sortKey="date" /></TableHead><TableHead><SortTrigger label="Ref" sortKey="ref" /></TableHead><TableHead><SortTrigger label="Type" sortKey="type" /></TableHead><TableHead className="text-right">Qty In</TableHead><TableHead className="text-right">Qty Out</TableHead><TableHead className="text-right pr-8"><SortTrigger label="Balance" sortKey="currentQty" /></TableHead></TableRow></TableHeader>
                 <TableBody>
                   <TableRow className="bg-secondary/5 font-bold italic"><TableCell className="pl-8 py-4">Initial</TableCell><TableCell>-</TableCell><TableCell>OPENING</TableCell><TableCell className="text-right">-</TableCell><TableCell className="text-right">-</TableCell><TableCell className="text-right pr-8">{itemStockLedger?.opening.qty.toFixed(2)}</TableCell></TableRow>
                   {itemStockLedger?.movements.map((m, idx) => (
                     <TableRow key={idx} className="border-b hover:bg-secondary/5">
                       <TableCell className="pl-8 py-4 font-medium text-xs">{m.date}</TableCell>
                       <TableCell className="font-black text-[10px] uppercase text-accent">{m.ref}</TableCell>
                       <TableCell><Badge variant="outline" className={cn("text-[8px] font-black uppercase px-2", m.type === 'Inward' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>{m.type}</Badge></TableCell>
                       <TableCell className="text-right font-black text-green-600">{m.type === 'Inward' ? `+${m.qty.toFixed(2)}` : '-'}</TableCell>
                       <TableCell className="text-right font-black text-red-600">{m.type === 'Outward' ? `-${m.qty.toFixed(2)}` : '-'}</TableCell>
                       <TableCell className="text-right font-black pr-8 text-primary">{m.currentQty.toFixed(2)}</TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

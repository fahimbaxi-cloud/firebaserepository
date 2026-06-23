
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
import { SearchableSelector } from '@/components/ui/searchable-selector';
import { Purchase, PurchaseItem, Supplier, RawItem, Unit } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Plus, ShoppingCart, Calendar, Trash2, PlusCircle, ReceiptText, Edit, Search, FilterX, CalendarDays, FileText, ArrowUpDown, ChevronUp, ChevronDown, Loader2, Printer, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { downloadPDF } from '@/lib/pdf-export';

export default function PurchaseManagementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  // Firestore Data
  const purchasesQuery = useMemoFirebase(() => collection(firestore, 'purchases'), [firestore]);
  const { data: purchasesData, isLoading: purchasesLoading } = useCollection<Purchase>(purchasesQuery);
  const purchases = purchasesData || [];

  const suppliersQuery = useMemoFirebase(() => collection(firestore, 'suppliers'), [firestore]);
  const { data: suppliersData } = useCollection<Supplier>(suppliersQuery);
  const suppliers = suppliersData || [];

  const rawItemsQuery = useMemoFirebase(() => collection(firestore, 'raw_items'), [firestore]);
  const { data: rawItemsData } = useCollection<RawItem>(rawItemsQuery);
  const rawItems = rawItemsData || [];

  const unitsQuery = useMemoFirebase(() => collection(firestore, 'units'), [firestore]);
  const { data: unitsData } = useCollection<Unit>(unitsQuery);
  const units = unitsData || [];

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [billNoFilter, setBillNoFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: 'date', direction: 'desc' });

  const supplierOptions = useMemo(() => suppliers.map(s => ({ value: s.id, label: s.name })), [suppliers]);
  const rawItemOptions = useMemo(() => rawItems.map(ri => ({ value: ri.id, label: ri.name })), [rawItems]);
  const unitOptions = useMemo(() => units.map(u => ({ value: u.id, label: u.name })), [units]);

  const [form, setForm] = useState<Partial<Purchase>>({
    supplierId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    status: 'Pending' as 'Pending' | 'Received',
    items: [{ rawItemId: '', quantity: 1, unitId: '', rate: 0, amount: 0 }] as PurchaseItem[]
  });

  const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || 'Unknown';

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

  const filteredPurchases = useMemo(() => {
    let data = purchases.filter(p => {
      const supplierName = getSupplierName(p.supplierId).toLowerCase();
      const refId = (p.id || '').toLowerCase();
      const query = searchTerm.toLowerCase();
      const matchesSearch = supplierName.includes(query) || refId.includes(query);
      const matchesStart = !startDate || p.date >= startDate;
      const matchesEnd = !endDate || p.date <= endDate;
      const matchesBillNo = !billNoFilter || refId.includes(billNoFilter.toLowerCase());
      return matchesSearch && matchesStart && matchesEnd && matchesBillNo;
    });

    if (sortConfig.key && sortConfig.direction) {
      data.sort((a, b) => {
        let valA = (a as any)[sortConfig.key];
        let valB = (b as any)[sortConfig.key];
        if (sortConfig.key === 'supplierName') { valA = getSupplierName(a.supplierId); valB = getSupplierName(b.supplierId); }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [purchases, searchTerm, suppliers, startDate, endDate, billNoFilter, sortConfig]);

  const totalProcurementAmount = useMemo(() => filteredPurchases.reduce((sum, p) => sum + p.totalAmount, 0), [filteredPurchases]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    const head = [['Date', 'Ref ID', 'Supplier', 'Amount', 'Status']];
    const body = filteredPurchases.map(p => [
      format(new Date(p.date), 'MMM dd, yyyy'),
      p.id.substr(0,8),
      getSupplierName(p.supplierId),
      p.totalAmount,
      p.status
    ]);
    downloadPDF('Purchase Registry Report', head, body, 'purchases_report');
  };

  const handleAddItem = () => {
    setForm({ ...form, items: [...(form.items || []), { rawItemId: '', quantity: 1, unitId: '', rate: 0, amount: 0 }] });
  };

  const handleRemoveItem = (index: number) => {
    if (!form.items || form.items.length === 1) return;
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  };

  const handleItemChange = (index: number, field: keyof PurchaseItem, value: string | number) => {
    const updatedItems = [...(form.items || [])];
    const item = updatedItems[index];
    if (field === 'rawItemId') {
      item.rawItemId = value as string;
      const rawItem = rawItems.find(r => r.id === value);
      if (rawItem) item.unitId = rawItem.baseUnitId;
    }
    if (field === 'unitId') item.unitId = value as string;
    if (field === 'quantity') item.quantity = Number(value);
    if (field === 'rate') item.rate = Number(value);
    item.amount = item.quantity * item.rate;
    setForm({ ...form, items: updatedItems });
  };

  const totalAmount = (form.items || []).reduce((sum, item) => sum + item.amount, 0);

  const handleEdit = (purchase: Purchase) => {
    setEditingId(purchase.id);
    setForm({ supplierId: purchase.supplierId, date: purchase.date, status: purchase.status, items: purchase.items.map(item => ({ ...item })) });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    const ref = doc(firestore, 'purchases', id);
    deleteDocumentNonBlocking(ref);
    toast({ title: "Purchase Removed", description: "Record has been deleted from registry." });
  };

  const handleSave = () => {
    if (!form.supplierId || (form.items || []).some(i => !i.rawItemId)) {
      toast({ title: "Validation Error", description: "Please select supplier and item details.", variant: "destructive" });
      return;
    }

    const purchaseData: any = { ...form, totalAmount: totalAmount, updatedAt: new Date().toISOString() };

    // If status is "Received", increment stock on raw items
    if (form.status === 'Received') {
      form.items?.forEach(item => {
        const rawItem = rawItems.find(r => r.id === item.rawItemId);
        if (rawItem) {
          const itemRef = doc(firestore, 'raw_items', item.rawItemId);
          // Standardize stock update to use nullish coalescing
          updateDocumentNonBlocking(itemRef, {
             currentStock: (rawItem.currentStock ?? rawItem.openingStock ?? 0) + item.quantity
          });
        }
      });
    }

    if (editingId) {
      const ref = doc(firestore, 'purchases', editingId);
      updateDocumentNonBlocking(ref, purchaseData);
      toast({ title: "Purchase Updated", description: "The record has been updated." });
    } else {
      const ref = collection(firestore, 'purchases');
      addDocumentNonBlocking(ref, { ...purchaseData, createdAt: new Date().toISOString() });
      toast({ title: "Purchase Recorded", description: "The new purchase has been added to the registry." });
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ supplierId: '', date: format(new Date(), 'yyyy-MM-dd'), status: 'Pending', items: [{ rawItemId: '', quantity: 1, unitId: '', rate: 0, amount: 0 }] });
  };

  return (
    <div className="space-y-8">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 print:mb-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-accent">Purchase Registry</h1>
          <p className="text-muted-foreground mt-1 font-medium">Record and track ingredient/item procurement.</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl font-bold bg-white gap-2">
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl font-bold bg-white gap-2">
            <FileDown className="w-4 h-4" /> Export PDF
          </Button>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="bg-primary hover:bg-primary/90 text-white rounded-2xl h-12 px-6 font-bold shadow-lg shadow-primary/20">
            <Plus className="w-5 h-5 mr-2" />Add New Purchase
          </Button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-4 mb-6 print:hidden">
        <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search by ID or Supplier..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-11 h-12 rounded-2xl bg-white border-none shadow-sm focus-visible:ring-primary/20" /></div>
        <div className="flex items-center gap-3 bg-white p-1 rounded-2xl shadow-sm border border-secondary/20">
          <div className="flex items-center gap-2 px-3 h-10"><CalendarDays className="w-4 h-4 text-muted-foreground" /><span className="text-[10px] font-black uppercase tracking-tighter">Range</span></div>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 border-none bg-secondary/20 rounded-xl text-xs w-full sm:w-32" /><span className="text-muted-foreground text-xs font-bold">to</span><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 border-none bg-secondary/20 rounded-xl text-xs w-full sm:w-32" />
        </div>
        {(searchTerm || startDate || endDate || billNoFilter) && <Button variant="ghost" onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); setBillNoFilter(''); }} className="rounded-2xl h-12 px-4 text-muted-foreground hover:text-destructive"><FilterX className="w-4 h-4 mr-2" />Clear</Button>}
      </div>

      <Card className="rounded-[2rem] border-none shadow-sm overflow-hidden bg-white print:shadow-none print:rounded-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow className="bg-secondary/20 hover:bg-secondary/20 border-none"><TableHead className="font-bold py-5 pl-8 text-xs uppercase tracking-wider"><SortTrigger label="Reference & Supplier" sortKey="id" /></TableHead><TableHead className="font-bold text-xs uppercase tracking-wider"><SortTrigger label="Date" sortKey="date" /></TableHead><TableHead className="font-bold text-xs uppercase tracking-wider"><SortTrigger label="Amount" sortKey="totalAmount" /></TableHead><TableHead className="font-bold text-xs uppercase tracking-wider"><SortTrigger label="Status" sortKey="status" /></TableHead><TableHead className="font-bold text-right pr-8 text-xs uppercase tracking-wider print:hidden">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {purchasesLoading ? (
                <TableRow><TableCell colSpan={5} className="h-64 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : filteredPurchases.length > 0 ? (
                filteredPurchases.map((p) => (
                  <TableRow key={p.id} className="hover:bg-secondary/5 border-b border-secondary/10 group"><TableCell className="py-6 pl-8"><div className="flex items-center gap-3"><div className="p-2 bg-accent/5 rounded-xl"><ReceiptText className="w-5 h-5 text-accent" /></div><div><div className="font-black text-sm text-accent">{(p.id || '').substr(0,8)}</div><div className="font-bold text-base">{getSupplierName(p.supplierId)}</div></div></div></TableCell><TableCell><div className="flex items-center gap-2 font-bold text-sm"><Calendar className="w-4 h-4 text-muted-foreground" />{format(new Date(p.date), 'MMM dd, yyyy')}</div></TableCell><TableCell><div className="font-black text-lg text-primary">{p.totalAmount}</div></TableCell><TableCell><Badge variant="outline" className={cn("rounded-lg px-2.5 py-0.5 font-bold uppercase text-[10px] tracking-wide", p.status === 'Received' ? "bg-green-100 text-green-700 border-green-200" : "bg-yellow-100 text-yellow-700 border-yellow-200")}>{p.status}</Badge></TableCell><TableCell className="text-right pr-8 print:hidden"><div className="flex justify-end gap-2"><Button variant="ghost" size="icon" onClick={() => handleEdit(p)} className="rounded-full h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/5"><Edit className="w-4 h-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="rounded-full h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/5"><Trash2 className="w-4 h-4" /></Button></div></TableCell></TableRow>
                ))
              ) : <TableRow><TableCell colSpan={5} className="h-64 text-center"><div className="p-4 bg-secondary rounded-full inline-block mb-3"><ShoppingCart className="w-8 h-8 text-muted-foreground/30" /></div><p className="text-muted-foreground font-medium">No purchase records found.</p></TableCell></TableRow>}
            </TableBody>
            <TableFooter className="bg-secondary/10 border-t-2 border-secondary/30"><TableRow><TableCell colSpan={2} className="text-right font-black py-5 uppercase text-xs tracking-widest text-muted-foreground">Total Procurement Amount:</TableCell><TableCell colSpan={3} className="font-black text-2xl text-primary pl-4">{totalProcurementAmount.toFixed(2)}</TableCell></TableRow></TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-8 pb-0"><DialogTitle className="text-2xl font-headline flex items-center gap-2"><ShoppingCart className="w-6 h-6 text-primary" />{editingId ? 'Edit Purchase' : 'Record Purchase'}</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto px-8 py-4"><div className="grid grid-cols-2 gap-4 py-4"><div className="space-y-2 col-span-2"><Label className="font-bold">Select Supplier</Label><SearchableSelector value={form.supplierId || ''} onChange={v => setForm({...form, supplierId: v})} options={supplierOptions} placeholder="Pick from Master" searchPlaceholder="Search suppliers..." /></div><div className="space-y-2"><Label>Purchase Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="rounded-xl h-11" /></div><div className="space-y-2"><Label>Status</Label><div className="flex gap-2"><Button type="button" variant={form.status === 'Pending' ? 'default' : 'outline'} onClick={() => setForm({ ...form, status: 'Pending' })} className="flex-1 rounded-xl h-11 font-bold">Pending</Button><Button type="button" variant={form.status === 'Received' ? 'default' : 'outline'} onClick={() => setForm({ ...form, status: 'Received' })} className="flex-1 rounded-xl h-11 font-bold">Received</Button></div></div><div className="col-span-2 pt-4"><div className="flex items-center justify-between mb-2"><Label className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Purchase Items</Label><Button variant="ghost" size="sm" onClick={handleAddItem} className="text-primary text-xs font-bold h-7 px-2"><PlusCircle className="w-3.5 h-3.5 mr-1" />Add Item</Button></div><div className="space-y-3">{form.items?.map((item, idx) => (<div key={idx} className="grid grid-cols-12 gap-2 items-end bg-secondary/20 p-3 rounded-2xl border border-secondary/30 group"><div className="col-span-4 space-y-1"><Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">Master Item</Label><SearchableSelector value={item.rawItemId} onChange={v => handleItemChange(idx, 'rawItemId', v)} options={rawItemOptions} placeholder="Pick item" searchPlaceholder="Search master item..." triggerClassName="h-10 border-none bg-white text-xs text-left" /></div><div className="col-span-2 space-y-1"><Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">Unit</Label><SearchableSelector value={item.unitId} onChange={v => handleItemChange(idx, 'unitId', v)} options={unitOptions} placeholder="Unit" searchPlaceholder="Search units..." triggerClassName="h-10 border-none bg-white text-xs text-left" /></div><div className="col-span-1 space-y-1"><Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">Qty</Label><Input type="number" value={item.quantity} onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)} className="h-10 rounded-xl bg-white border-none text-xs" /></div><div className="col-span-2 space-y-1"><Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">Rate</Label><Input type="number" value={item.rate} onChange={(e) => handleItemChange(idx, 'rate', e.target.value)} className="h-10 rounded-xl bg-white border-none text-xs" /></div><div className="col-span-2 space-y-1"><Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">Amt</Label><div className="h-10 flex items-center justify-center font-bold text-xs text-primary bg-white rounded-xl">{item.amount}</div></div><div className="col-span-1 flex items-center justify-center h-10"><Button variant="ghost" size="icon" onClick={() => handleRemoveItem(idx)} disabled={form.items?.length === 1} className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button></div></div>))}</div></div></div></div><DialogFooter className="p-8 pt-4 bg-secondary/5 border-t border-secondary/20"><div className="flex-1 flex flex-col justify-center"><span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Estimated Total</span><span className="text-2xl font-black text-accent">{totalAmount}</span></div><div className="flex gap-2"><Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl h-12">Cancel</Button><Button onClick={handleSave} className="bg-primary hover:bg-primary/90 rounded-xl h-12 px-8 font-bold">{editingId ? 'Update Purchase' : 'Save Purchase'}</Button></div></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

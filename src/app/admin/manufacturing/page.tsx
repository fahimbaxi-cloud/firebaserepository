"use client";

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ManufacturingLog, RawItem, BroadcastPackage, MenuItem, Unit, Purchase } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Factory, Package, ArrowRight, Save, History, Calculator, Calendar as CalendarIcon, AlertTriangle, Edit, Trash2, X, Loader2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';

interface IngredientRequirement {
  rawItemId: string;
  name: string;
  baseUnitId: string;
  baseUnitName: string;
  totalRequired: number;
  currentStock: number;
  alternateUnitName?: string;
  alternateFactor?: number;
}

export default function ManufacturingPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  
  // Firestore Data
  const logsQuery = useMemoFirebase(() => collection(firestore, 'manufacturing_logs'), [firestore]);
  const { data: logsData, isLoading: logsLoading } = useCollection<ManufacturingLog>(logsQuery);
  const logs = logsData || [];

  const packagesQuery = useMemoFirebase(() => collection(firestore, 'packages'), [firestore]);
  const { data: packagesData } = useCollection<BroadcastPackage>(packagesQuery);
  const broadcastPackages = packagesData || [];

  const rawItemsQuery = useMemoFirebase(() => collection(firestore, 'raw_items'), [firestore]);
  const { data: rawItemsData } = useCollection<RawItem>(rawItemsQuery);
  const rawItems = rawItemsData || [];

  const menuQuery = useMemoFirebase(() => collection(firestore, 'menu_items'), [firestore]);
  const { data: menuData } = useCollection<MenuItem>(menuQuery);
  const menuItems = menuData || [];

  const unitsQuery = useMemoFirebase(() => collection(firestore, 'units'), [firestore]);
  const { data: unitsData } = useCollection<Unit>(unitsQuery);
  const units = unitsData || [];

  const purchasesQuery = useMemoFirebase(() => collection(firestore, 'purchases'), [firestore]);
  const { data: purchasesData } = useCollection<Purchase>(purchasesQuery);
  const purchases = purchasesData || [];

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [qtyToManufacture, setQtyToManufacture] = useState<string>('1');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  /**
   * Ledger-based stock calculation helper.
   * Calculates: Opening Stock + Received Purchases - Manufacturing Logs.
   * If editingLogId is set, it IGNORES that specific log to show 'available' stock.
   */
  const calculateStockInHand = (itemId: string) => {
    const item = rawItems.find(ri => ri.id === itemId);
    if (!item) return 0;

    let stock = item.openingStock ?? 0;

    // Add all received purchases
    purchases.forEach(p => {
      if (p.status === 'Received') {
        const pItem = p.items?.find(i => i.rawItemId === itemId);
        if (pItem) stock += pItem.quantity;
      }
    });

    // Deduct all manufacturing logs
    logs.forEach(log => {
      // If we are editing this log, don't deduct it from the "available" pool
      if (log.id === editingLogId) return;
      
      const logItem = log.ingredientsUsed?.find(i => i.rawItemId === itemId);
      if (logItem) stock -= logItem.quantity;
    });

    return stock;
  };

  const selectedPackage = useMemo(() => 
    broadcastPackages.find(p => p.id === selectedPackageId), 
    [selectedPackageId, broadcastPackages]
  );

  const requirements = useMemo(() => {
    if (!selectedPackage || !qtyToManufacture || isNaN(Number(qtyToManufacture))) return [];

    const reqMap: Record<string, number> = {};
    const manufacturingQty = Number(qtyToManufacture);

    selectedPackage.items?.forEach(menuItemId => {
      const menuItem = menuItems.find(m => m.id === menuItemId);
      menuItem?.ingredients?.forEach(ing => {
        const total = ing.quantity * manufacturingQty;
        reqMap[ing.rawItemId] = (reqMap[ing.rawItemId] || 0) + total;
      });
    });

    return Object.entries(reqMap).map(([id, total]) => {
      const rawItem = rawItems.find(r => r.id === id);
      const baseUnit = units.find(u => u.id === rawItem?.baseUnitId);
      
      const altConv = rawItem?.conversions?.[0];
      const altUnit = altConv ? units.find(u => u.id === altConv.unitId) : null;

      // Use calculated ledger stock for hand check
      const stockInHand = calculateStockInHand(id);

      return {
        rawItemId: id,
        name: rawItem?.name || 'Unknown',
        baseUnitId: rawItem?.baseUnitId || '',
        baseUnitName: baseUnit?.name || '',
        totalRequired: total,
        currentStock: stockInHand,
        alternateUnitName: altUnit?.name,
        alternateFactor: altConv?.factor
      } as IngredientRequirement;
    });
  }, [selectedPackage, qtyToManufacture, rawItems, menuItems, units, purchases, logs, editingLogId]);

  const hasInsufficientStock = useMemo(() => 
    requirements.some(req => req.totalRequired > req.currentStock),
    [requirements]
  );

  const handleFinalize = () => {
    if (!selectedPackage) return;
    
    // In this ledger-based system, we primarily rely on the Logs to deduct stock 
    // We update the cached currentStock field for performance in other simple list views
    requirements.forEach(req => {
      const rawItemRef = doc(firestore, 'raw_items', req.rawItemId);
      updateDocumentNonBlocking(rawItemRef, {
        currentStock: req.currentStock - req.totalRequired
      });
    });

    const updatedLog: any = {
      packageId: selectedPackage.id,
      packageName: selectedPackage.name,
      quantity: Number(qtyToManufacture),
      date: (selectedDate || new Date()).toISOString(),
      ingredientsUsed: requirements.map(r => ({
        rawItemId: r.rawItemId,
        name: r.name,
        quantity: r.totalRequired,
        unitName: r.baseUnitName
      }))
    };

    if (editingLogId) {
      const ref = doc(firestore, 'manufacturing_logs', editingLogId);
      updateDocumentNonBlocking(ref, updatedLog);
      toast({ title: "Log Updated", description: `Production record has been recalculated.` });
    } else {
      const ref = collection(firestore, 'manufacturing_logs');
      addDocumentNonBlocking(ref, updatedLog);
      toast({ title: "Manufacturing Complete", description: `Production of ${qtyToManufacture}x ${selectedPackage.name} logged.` });
    }

    resetForm();
  };

  const handleDeleteLog = (id: string) => {
    const ref = doc(firestore, 'manufacturing_logs', id);
    deleteDocumentNonBlocking(ref);
    if (editingLogId === id) resetForm();
    toast({ title: "Log Deleted", description: "Production record removed." });
  };

  const handleEditLog = (log: ManufacturingLog) => {
    setEditingLogId(log.id);
    setSelectedPackageId(log.packageId);
    setQtyToManufacture(log.quantity.toString());
    setSelectedDate(new Date(log.date));
    toast({ title: "Editing Log", description: "In-hand stock has been adjusted to include current production usage." });
  };

  const resetForm = () => {
    setEditingLogId(null);
    setSelectedPackageId('');
    setQtyToManufacture('1');
    setSelectedDate(new Date());
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-headline font-bold text-accent">Package Manufacturing</h1>
          <p className="text-muted-foreground mt-1 font-medium">Ledger-calculated stock in hand used for shortfall detection.</p>
        </div>
        {editingLogId && (
          <Button variant="ghost" onClick={resetForm} className="text-muted-foreground hover:text-destructive">
            <X className="w-4 h-4 mr-2" />
            Cancel Edit
          </Button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <Card className={cn(
            "rounded-[2rem] border-none shadow-sm bg-white overflow-hidden transition-all duration-300",
            editingLogId ? "ring-2 ring-primary ring-offset-4 ring-offset-secondary/10" : ""
          )}>
            <CardHeader className={cn(
              "border-b transition-colors",
              editingLogId ? "bg-primary/10 border-primary/20" : "bg-primary/5 border-primary/10"
            )}>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" />
                {editingLogId ? 'Update Production' : 'Production Setup'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Production Date</Label>
                <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full h-12 justify-start text-left font-bold rounded-xl bg-secondary/20 border-none px-4",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                      {mounted && selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-3xl border-none shadow-2xl" align="start">
                    <Calendar mode="single" selected={selectedDate} onSelect={(date) => {
                      setSelectedDate(date);
                      setIsDatePickerOpen(false);
                    }} initialFocus className="rounded-3xl" />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Target Package</Label>
                <Select value={selectedPackageId} onValueChange={setSelectedPackageId}>
                  <SelectTrigger className="rounded-xl h-12 bg-secondary/20 border-none font-bold">
                    <SelectValue placeholder="Select broadcasted package" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {broadcastPackages.map(pkg => (
                      <SelectItem key={pkg.id} value={pkg.id}>{pkg.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Quantity to Produce</Label>
                <Input type="number" min="1" value={qtyToManufacture} onChange={(e) => setQtyToManufacture(e.target.value)} className="h-12 rounded-xl bg-secondary/20 border-none font-black text-lg" />
              </div>

              {selectedPackage && (
                <div className="p-4 bg-accent/5 rounded-2xl border border-accent/10 space-y-3">
                  <p className="text-[10px] font-black uppercase text-accent tracking-widest">Package Contents</p>
                  <div className="space-y-1">
                    {selectedPackage.items?.map(itemId => {
                      const item = menuItems.find(m => m.id === itemId);
                      return (
                        <div key={itemId} className="flex justify-between text-xs font-bold">
                          <span>• {item?.name}</span>
                          <Badge variant="outline" className="text-[9px] h-4">{item?.type}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <Button onClick={handleFinalize} disabled={!selectedPackage || hasInsufficientStock} className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 font-bold text-lg shadow-lg shadow-primary/20">
                <Save className="w-5 h-5 mr-2" />
                {editingLogId ? 'Update Production Record' : 'Process Manufacturing'}
              </Button>

              {hasInsufficientStock && (
                <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-xl border border-red-100">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-bold">Shortfall in calculated ledger stock. Check Purchases or Master Opening Stock.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <Card className="rounded-[2.5rem] border-none shadow-sm bg-white overflow-hidden min-h-[400px]">
            <CardHeader className="p-8 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-headline font-bold">Stock Analysis (Ledger)</CardTitle>
                  <CardDescription className="font-medium">Calculated hand balance based on full transaction history.</CardDescription>
                </div>
                {selectedPackage && (
                  <Badge className="bg-primary/10 text-primary border-none text-xs font-bold px-4 py-1.5 rounded-full">
                    {qtyToManufacture} Units Batch
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {selectedPackage ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/20 hover:bg-secondary/20 border-none">
                      <TableHead className="font-bold pl-8 py-5">Ingredient</TableHead>
                      <TableHead className="font-bold">Needed</TableHead>
                      <TableHead className="font-bold text-right">In Hand (Ledger)</TableHead>
                      <TableHead className="font-bold pr-8 text-right">Shortfall</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requirements.map((req) => {
                      const shortfallAmt = Math.max(0, req.totalRequired - req.currentStock);
                      return (
                        <TableRow key={req.rawItemId} className="hover:bg-secondary/5 border-b border-secondary/10">
                          <TableCell className="pl-8 py-6">
                            <p className="font-bold text-base">{req.name}</p>
                            {req.alternateUnitName && req.alternateFactor && (
                              <p className="text-[10px] text-muted-foreground font-medium">
                                1 {req.baseUnitName} = {req.alternateFactor} {req.alternateUnitName}
                              </p>
                            )}
                          </TableCell>
                          <TableCell><div className="font-black text-lg text-slate-500">{req.totalRequired.toFixed(2)} <span className="text-[10px] uppercase">{req.baseUnitName}</span></div></TableCell>
                          <TableCell className="text-right">
                            <div className={cn("font-black text-lg", req.currentStock >= req.totalRequired ? "text-green-600" : "text-amber-600")}>
                              {req.currentStock.toFixed(2)}
                            </div>
                          </TableCell>
                          <TableCell className="pr-8 text-right">
                            {shortfallAmt > 0 ? (
                              <Badge variant="destructive" className="font-black rounded-lg px-2.5 py-1 animate-pulse">
                                {shortfallAmt.toFixed(2)} {req.baseUnitName}
                              </Badge>
                            ) : (
                              <div className="flex justify-end"><CheckCircle2 className="w-5 h-5 text-green-500" /></div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-32 text-center opacity-40">
                  <Factory className="w-16 h-16 mb-4" />
                  <p className="text-xl font-bold">Pick a target package to calculate requirements</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <History className="w-5 h-5 text-muted-foreground" />
                Production History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {logsLoading ? (
                <div className="p-12 text-center">
                  <Loader2 className="animate-spin mx-auto w-6 h-6 text-primary" />
                </div>
              ) : logs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/10 hover:bg-transparent border-none">
                      <TableHead className="pl-8 font-bold">Production Run</TableHead>
                      <TableHead className="text-center font-bold">Batch Size</TableHead>
                      <TableHead className="pr-8 text-right font-bold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id} className={cn("border-b border-secondary/10 transition-colors group", editingLogId === log.id ? "bg-primary/5" : "hover:bg-secondary/5")}>
                        <TableCell className="pl-8 py-4">
                          <p className="font-bold text-sm">{log.packageName}</p>
                          <p className="text-[10px] text-muted-foreground font-medium">{mounted ? format(new Date(log.date), 'PPpp') : '...'}</p>
                        </TableCell>
                        <TableCell className="text-center"><Badge className="bg-secondary text-primary border-none font-black">{log.quantity} Sets</Badge></TableCell>
                        <TableCell className="pr-8">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEditLog(log)} className={cn("h-8 w-8 rounded-full", editingLogId === log.id ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/5")}><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteLog(log.id)} className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/5"><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <div className="p-12 text-center text-muted-foreground italic text-sm">No production data available.</div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

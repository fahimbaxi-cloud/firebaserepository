
"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Supplier, RawItem, Unit, Category, RawItemConversion, ExpenseCategory, IncomeCategory, GLAccount, GLAccountGroup } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, PlusCircle, MinusCircle, LayoutGrid, Tags, Ruler, ArrowUpDown, ChevronUp, ChevronDown, TrendingUp, TrendingDown, Loader2, BookOpen, ShieldCheck, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';

const ACCOUNT_GROUPS: GLAccountGroup[] = [
  'Capital', 'Secured Loan', 'Drawings', 'Creditors', 'Unsecured Loan', 
  'Outstanding Expense', 'Pre-received Income', 'Fixed Assets', 'Investment', 
  'Cash', 'Bank', 'UPI', 'Profit & Loss', 'Advance Given', 'Advance Received', 'Debtors', 
  'Loan Given', 'Reserves and Surplus', 'Outstanding Income', 'Pre-paid Expense'
];

const SYSTEM_CRITICAL_GROUPS = ['Cash', 'Bank', 'UPI', 'Capital', 'Profit & Loss'];

export default function MasterModulePage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  // Firestore Data
  const { data: suppliersData = [], isLoading: suppliersLoading } = useCollection<Supplier>(useMemoFirebase(() => collection(firestore, 'suppliers'), [firestore]));
  const { data: rawItemsData = [], isLoading: itemsLoading } = useCollection<RawItem>(useMemoFirebase(() => collection(firestore, 'raw_items'), [firestore]));
  const { data: unitsData = [], isLoading: unitsLoading } = useCollection<Unit>(useMemoFirebase(() => collection(firestore, 'units'), [firestore]));
  const { data: categoriesData = [], isLoading: catsLoading } = useCollection<Category>(useMemoFirebase(() => collection(firestore, 'categories'), [firestore]));
  const { data: expenseCategoriesData = [], isLoading: exLoading } = useCollection<ExpenseCategory>(useMemoFirebase(() => collection(firestore, 'expense_categories'), [firestore]));
  const { data: incomeCategoriesData = [], isLoading: inLoading } = useCollection<IncomeCategory>(useMemoFirebase(() => collection(firestore, 'income_categories'), [firestore]));
  const { data: glAccountsData = [], isLoading: glLoading } = useCollection<GLAccount>(useMemoFirebase(() => collection(firestore, 'gl_accounts'), [firestore]));
  
  const suppliers = suppliersData || [];
  const rawItems = rawItemsData || [];
  const units = unitsData || [];
  const categories = categoriesData || [];
  const expenseCategories = expenseCategoriesData || [];
  const incomeCategories = incomeCategoriesData || [];
  const glAccounts = glAccountsData || [];

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: 'name', direction: 'asc' });

  // Dialog States
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [isRawItemDialogOpen, setIsRawItemDialogOpen] = useState(false);
  const [isUnitDialogOpen, setIsUnitDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isExpenseCatDialogOpen, setIsExpenseCatDialogOpen] = useState(false);
  const [isIncomeCatDialogOpen, setIsIncomeCatDialogOpen] = useState(false);
  const [isGLAccountDialogOpen, setIsGLAccountDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form States
  const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({});
  const [rawItemForm, setRawItemForm] = useState<Partial<RawItem>>({ conversions: [], openingStock: 0, openingValue: 0 });
  const [unitForm, setUnitForm] = useState<Partial<Unit>>({});
  const [categoryForm, setCategoryForm] = useState<Partial<Category>>({});
  const [expenseCatForm, setExpenseCatForm] = useState<Partial<ExpenseCategory>>({});
  const [incomeCatForm, setIncomeCatForm] = useState<Partial<IncomeCategory>>({});
  const [glAccountForm, setGLAccountForm] = useState<Partial<GLAccount>>({ group: 'Capital', openingBalance: 0, openingType: 'Credit' });

  // Search & Filter States
  const [rawItemSearch, setRawItemSearch] = useState('');
  const [rawItemCategoryFilter, setRawItemCategoryFilter] = useState('all');

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortTrigger = ({ label, sortKey, className }: { label: string, sortKey: string, className?: string }) => (
    <div 
      className={cn("flex items-center gap-1 cursor-pointer group select-none hover:text-primary transition-colors", className)}
      onClick={() => handleSort(sortKey)}
    >
      <span>{label}</span>
      {sortConfig.key === sortKey ? (
        sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
      ) : (
        <ArrowUpDown className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary" />
      )}
    </div>
  );

  const sortedSuppliers = useMemo(() => {
    const data = [...suppliers];
    if (sortConfig.key && sortConfig.direction) {
      data.sort((a, b) => {
        const valA = (a as any)[sortConfig.key] || '';
        const valB = (b as any)[sortConfig.key] || '';
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [suppliers, sortConfig]);

  const sortedRawItems = useMemo(() => {
    let data = [...rawItems];
    
    // Filter by search
    if (rawItemSearch.trim() !== '') {
      const searchLower = rawItemSearch.toLowerCase();
      data = data.filter(item => (item.name || '').toLowerCase().includes(searchLower));
    }
    
    // Filter by category
    if (rawItemCategoryFilter !== 'all') {
      data = data.filter(item => item.categoryId === rawItemCategoryFilter);
    }

    if (sortConfig.key && sortConfig.direction) {
      data.sort((a, b) => {
        if (sortConfig.key === 'currentStock') {
          const valA = Number(a.currentStock ?? a.openingStock ?? 0);
          const valB = Number(b.currentStock ?? b.openingStock ?? 0);
          return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        }
        const valA = String((a as any)[sortConfig.key] || '').toLowerCase();
        const valB = String((b as any)[sortConfig.key] || '').toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // Default: namewise ascending order
      data.sort((a, b) => {
        const nameA = String(a.name || '');
        const nameB = String(b.name || '');
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
      });
    }
    return data;
  }, [rawItems, sortConfig, rawItemSearch, rawItemCategoryFilter]);

  const sortedGLAccounts = useMemo(() => {
    const data = [...glAccounts];
    if (sortConfig.key && sortConfig.direction) {
      data.sort((a, b) => {
        const valA = (a as any)[sortConfig.key] || '';
        const valB = (b as any)[sortConfig.key] || '';
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [glAccounts, sortConfig]);

  const handleSaveSupplier = () => {
    if (!supplierForm.name || !supplierForm.phone) {
      toast({ title: "Error", description: "Name and Phone are required.", variant: "destructive" });
      return;
    }
    if (editingId) {
      const ref = doc(firestore, 'suppliers', editingId);
      updateDocumentNonBlocking(ref, supplierForm);
    } else {
      const ref = collection(firestore, 'suppliers');
      addDocumentNonBlocking(ref, { ...supplierForm, createdAt: new Date().toISOString() });
    }
    setIsSupplierDialogOpen(false);
    setEditingId(null);
    setSupplierForm({});
  };

  const handleSaveRawItem = () => {
    if (!rawItemForm.name || !rawItemForm.baseUnitId || !rawItemForm.categoryId) {
      toast({ title: "Error", description: "Name, Basic Unit, and Category are required.", variant: "destructive" });
      return;
    }

    const itemData = {
      ...rawItemForm,
      openingStock: Number(rawItemForm.openingStock ?? 0),
      openingValue: Number(rawItemForm.openingValue ?? 0),
      currentStock: Number(rawItemForm.currentStock ?? (rawItemForm.openingStock ?? 0)),
    };

    if (editingId) {
      const ref = doc(firestore, 'raw_items', editingId);
      updateDocumentNonBlocking(ref, itemData);
    } else {
      const ref = collection(firestore, 'raw_items');
      addDocumentNonBlocking(ref, { 
        ...itemData, 
        createdAt: new Date().toISOString() 
      });
    }
    setIsRawItemDialogOpen(false);
    setEditingId(null);
    setRawItemForm({ conversions: [], openingStock: 0, openingValue: 0 });
  };

  const handleSaveGLAccount = () => {
    if (!glAccountForm.name || !glAccountForm.group) {
      toast({ title: "Error", description: "Name and Account Type are required.", variant: "destructive" });
      return;
    }

    const glData = {
      ...glAccountForm,
      openingBalance: Number(glAccountForm.openingBalance ?? 0),
    };

    if (editingId) {
      const ref = doc(firestore, 'gl_accounts', editingId);
      updateDocumentNonBlocking(ref, glData);
    } else {
      const ref = collection(firestore, 'gl_accounts');
      addDocumentNonBlocking(ref, { 
        ...glData, 
        createdAt: new Date().toISOString() 
      });
    }
    setIsGLAccountDialogOpen(false);
    setEditingId(null);
    setGLAccountForm({ group: 'Capital', openingBalance: 0, openingType: 'Credit' });
  };

  const handleSaveUnit = () => {
    if (!unitForm.name) return;
    if (editingId) {
      updateDocumentNonBlocking(doc(firestore, 'units', editingId), unitForm);
    } else {
      addDocumentNonBlocking(collection(firestore, 'units'), { ...unitForm, createdAt: new Date().toISOString() });
    }
    setIsUnitDialogOpen(false);
    setEditingId(null);
    setUnitForm({});
  };

  const handleSaveCategory = () => {
    if (!categoryForm.name) return;
    if (editingId) {
      updateDocumentNonBlocking(doc(firestore, 'categories', editingId), categoryForm);
    } else {
      addDocumentNonBlocking(collection(firestore, 'categories'), { ...categoryForm, createdAt: new Date().toISOString() });
    }
    setIsCategoryDialogOpen(false);
    setEditingId(null);
    setCategoryForm({});
  };

  const handleSaveExpenseCat = () => {
    if (!expenseCatForm.name) return;
    if (editingId) {
      updateDocumentNonBlocking(doc(firestore, 'expense_categories', editingId), expenseCatForm);
    } else {
      addDocumentNonBlocking(collection(firestore, 'expense_categories'), { ...expenseCatForm, createdAt: new Date().toISOString() });
    }
    setIsExpenseCatDialogOpen(false);
    setEditingId(null);
    setExpenseCatForm({});
  };

  const handleSaveIncomeCat = () => {
    if (!incomeCatForm.name) return;
    if (editingId) {
      updateDocumentNonBlocking(doc(firestore, 'income_categories', editingId), incomeCatForm);
    } else {
      addDocumentNonBlocking(collection(firestore, 'income_categories'), { ...incomeCatForm, createdAt: new Date().toISOString() });
    }
    setIsIncomeCatDialogOpen(false);
    setEditingId(null);
    setIncomeCatForm({});
  };

  const handleAddConversionRow = () => {
    setRawItemForm({
      ...rawItemForm,
      conversions: [...(rawItemForm.conversions || []), { unitId: '', factor: 0 }]
    });
  };

  const handleRemoveConversionRow = (index: number) => {
    setRawItemForm({
      ...rawItemForm,
      conversions: (rawItemForm.conversions || []).filter((_, i) => i !== index)
    });
  };

  const handleConversionChange = (index: number, field: keyof RawItemConversion, value: any) => {
    const updated = [...(rawItemForm.conversions || [])];
    updated[index] = { ...updated[index], [field]: value };
    setRawItemForm({ ...rawItemForm, conversions: updated });
  };

  const getUnitName = (id?: string) => units.find(u => u.id === id)?.name || 'N/A';
  const getCategoryName = (id?: string) => categories.find(c => c.id === id)?.name || 'N/A';

  return (
    <div className="space-y-8">
      <header className="mb-8">
        <h1 className="text-3xl font-headline font-bold text-accent">Master Module</h1>
        <p className="text-muted-foreground mt-1 font-medium">Manage fundamental business records via Firestore.</p>
      </header>

      <Tabs defaultValue="suppliers" className="space-y-6">
        <TabsList className="bg-white rounded-2xl p-1 shadow-sm border h-12 flex overflow-x-auto no-scrollbar">
          <TabsTrigger value="suppliers" className="rounded-xl font-bold h-full px-6 whitespace-nowrap">Suppliers</TabsTrigger>
          <TabsTrigger value="raw-items" className="rounded-xl font-bold h-full px-6 whitespace-nowrap">Raw Items</TabsTrigger>
          <TabsTrigger value="gl-accounts" className="rounded-xl font-bold h-full px-6 whitespace-nowrap">GL Accounts</TabsTrigger>
          <TabsTrigger value="expense-cats" className="rounded-xl font-bold h-full px-6 whitespace-nowrap">Expenses</TabsTrigger>
          <TabsTrigger value="income-cats" className="rounded-xl font-bold h-full px-6 whitespace-nowrap">Incomes</TabsTrigger>
          <TabsTrigger value="categories" className="rounded-xl font-bold h-full px-6 whitespace-nowrap">Item Cats</TabsTrigger>
          <TabsTrigger value="units" className="rounded-xl font-bold h-full px-6 whitespace-nowrap">Units</TabsTrigger>
        </TabsList>

        <TabsContent value="suppliers">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Supplier Database</h2>
            <Button onClick={() => { setEditingId(null); setSupplierForm({}); setIsSupplierDialogOpen(true); }}>
              <PlusCircle className="w-4 h-4 mr-2" /> Add Supplier
            </Button>
          </div>
          <Card className="rounded-2xl overflow-hidden border-none shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/20">
                  <TableHead><SortTrigger label="Name" sortKey="name" /></TableHead>
                  <TableHead><SortTrigger label="Contact" sortKey="phone" /></TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliersLoading ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="animate-spin mx-auto w-6 h-6" /></TableCell></TableRow>
                ) : sortedSuppliers.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-bold">{s.name}</TableCell>
                    <TableCell className="text-xs">{s.phone}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingId(s.id); setSupplierForm(s); setIsSupplierDialogOpen(true); }}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'suppliers', s.id))} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="raw-items">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Raw Items</h2>
            <Button onClick={() => { setEditingId(null); setRawItemForm({ conversions: [], openingStock: 0, openingValue: 0 }); setIsRawItemDialogOpen(true); }}>
              <PlusCircle className="w-4 h-4 mr-2" /> Add Raw Item
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search raw item by name..." 
                value={rawItemSearch} 
                onChange={(e) => setRawItemSearch(e.target.value)} 
                className="pl-10 h-11 rounded-2xl bg-white border border-secondary/20 shadow-sm focus-visible:ring-primary/20"
              />
            </div>
            <div className="w-full sm:w-[220px]">
              <SearchableSelect
                value={rawItemCategoryFilter}
                onChange={setRawItemCategoryFilter}
                options={[{ id: 'all', name: 'All Categories' }, ...categories]}
                getOptionLabel={c => c.name}
                getOptionValue={c => c.id}
                placeholder="All Categories"
                searchPlaceholder="Search category..."
                triggerClassName="h-11 bg-white border border-secondary/20 shadow-sm font-semibold text-xs"
              />
            </div>
            {(rawItemSearch || rawItemCategoryFilter !== 'all') && (
              <Button 
                variant="ghost" 
                onClick={() => { setRawItemSearch(''); setRawItemCategoryFilter('all'); }} 
                className="h-11 px-4 rounded-xl font-semibold text-xs text-muted-foreground hover:text-destructive shrink-0"
              >
                Clear Filters
              </Button>
            )}
          </div>

          <Card className="rounded-2xl overflow-hidden border-none shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/20">
                  <TableHead><SortTrigger label="Item Name" sortKey="name" /></TableHead>
                  <TableHead><SortTrigger label="Category" sortKey="categoryId" /></TableHead>
                  <TableHead><SortTrigger label="Basic Unit" sortKey="baseUnitId" /></TableHead>
                  <TableHead className="text-right"><SortTrigger label="Current Stock" sortKey="currentStock" /></TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="animate-spin mx-auto w-6 h-6" /></TableCell></TableRow>
                ) : sortedRawItems.map(i => (
                  <TableRow key={i.id}>
                    <TableCell className="font-bold">{i.name}</TableCell>
                    <TableCell><Badge variant="outline">{getCategoryName(i.categoryId)}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{getUnitName(i.baseUnitId)}</Badge></TableCell>
                    <TableCell className="text-right">
                       <span className={cn("font-black", (i.currentStock ?? i.openingStock ?? 0) < 5 ? "text-destructive" : "text-primary")}>
                         {Number(i.currentStock ?? i.openingStock ?? 0).toFixed(2)}
                       </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingId(i.id); setRawItemForm(i); setIsRawItemDialogOpen(true); }}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'raw_items', i.id))} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="gl-accounts">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">General Ledger Accounts</h2>
            <Button onClick={() => { setEditingId(null); setGLAccountForm({ group: 'Capital', openingBalance: 0, openingType: 'Credit' }); setIsGLAccountDialogOpen(true); }}>
              <PlusCircle className="w-4 h-4 mr-2" /> Add GL Account
            </Button>
          </div>
          <Card className="rounded-2xl overflow-hidden border-none shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/20">
                  <TableHead><SortTrigger label="Account Name" sortKey="name" /></TableHead>
                  <TableHead><SortTrigger label="Account Type" sortKey="group" /></TableHead>
                  <TableHead className="text-right"><SortTrigger label="Opening Balance" sortKey="openingBalance" /></TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {glLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="animate-spin mx-auto w-6 h-6" /></TableCell></TableRow>
                ) : sortedGLAccounts.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-bold">
                      <div className="flex items-center gap-2">
                        {a.name}
                        {SYSTEM_CRITICAL_GROUPS.includes(a.group) && (
                          <Badge variant="outline" className="bg-accent/5 text-accent border-accent/20 text-[8px] font-black uppercase px-1.5 h-4">
                            <ShieldCheck className="w-2.5 h-2.5 mr-1" /> System
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100">{a.group}</Badge></TableCell>
                    <TableCell className="text-right font-black">
                      {a.openingBalance} <span className="text-[10px] text-muted-foreground">{a.openingType === 'Debit' ? 'Dr' : 'Cr'}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingId(a.id); setGLAccountForm(a); setIsGLAccountDialogOpen(true); }}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'gl_accounts', a.id))} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="expense-cats">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Expenses</h2>
            <Button onClick={() => { setEditingId(null); setExpenseCatForm({}); setIsExpenseCatDialogOpen(true); }}>
              <PlusCircle className="w-4 h-4 mr-2" /> Add Expense
            </Button>
          </div>
          <Card className="rounded-2xl overflow-hidden border-none shadow-sm">
            <Table>
              <TableHeader><TableRow className="bg-secondary/20"><TableHead>Category Name</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {exLoading ? (
                  <TableRow><TableCell colSpan={2} className="text-center py-10"><Loader2 className="animate-spin mx-auto w-6 h-6" /></TableCell></TableRow>
                ) : expenseCategories.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-bold">{c.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingId(c.id); setExpenseCatForm(c); setIsExpenseCatDialogOpen(true); }}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'expense_categories', c.id))} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="income-cats">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Incomes</h2>
            <Button onClick={() => { setEditingId(null); setIncomeCatForm({}); setIsIncomeCatDialogOpen(true); }}>
              <PlusCircle className="w-4 h-4 mr-2" /> Add Income
            </Button>
          </div>
          <Card className="rounded-2xl overflow-hidden border-none shadow-sm">
            <Table>
              <TableHeader><TableRow className="bg-secondary/20"><TableHead>Category Name</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {inLoading ? (
                  <TableRow><TableCell colSpan={2} className="text-center py-10"><Loader2 className="animate-spin mx-auto w-6 h-6" /></TableCell></TableRow>
                ) : incomeCategories.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-bold">{c.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingId(c.id); setIncomeCatForm(c); setIsIncomeCatDialogOpen(true); }}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'income_categories', c.id))} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Item Categories</h2>
            <Button onClick={() => { setEditingId(null); setCategoryForm({}); setIsCategoryDialogOpen(true); }}>
              <PlusCircle className="w-4 h-4 mr-2" /> Add Category
            </Button>
          </div>
          <Card className="rounded-2xl overflow-hidden border-none shadow-sm">
            <Table>
              <TableHeader><TableRow className="bg-secondary/20"><TableHead>Category Name</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {catsLoading ? (
                  <TableRow><TableCell colSpan={2} className="text-center py-10"><Loader2 className="animate-spin mx-auto w-6 h-6" /></TableCell></TableRow>
                ) : categories.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-bold">{c.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingId(c.id); setCategoryForm(c); setIsCategoryDialogOpen(true); }}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'categories', c.id))} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="units">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Measurement Units</h2>
            <Button onClick={() => { setEditingId(null); setUnitForm({}); setIsUnitDialogOpen(true); }}>
              <PlusCircle className="w-4 h-4 mr-2" /> Add Unit
            </Button>
          </div>
          <Card className="rounded-2xl overflow-hidden border-none shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/20">
                  <TableHead>Unit Name</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unitsLoading ? (
                  <TableRow><TableCell colSpan={2} className="text-center py-10"><Loader2 className="animate-spin mx-auto w-6 h-6" /></TableCell></TableRow>
                ) : units.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-bold">{u.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingId(u.id); setUnitForm(u); setIsUnitDialogOpen(true); }}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'units', u.id))} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* GL Account Dialog */}
      <Dialog open={isGLAccountDialogOpen} onOpenChange={setIsGLAccountDialogOpen}>
        <DialogContent className="max-w-md rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-primary" /> {editingId ? 'Edit GL Account' : 'New GL Account'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Account Name</Label>
              <Input value={glAccountForm.name || ''} onChange={e => setGLAccountForm({...glAccountForm, name: e.target.value})} placeholder="e.g. System Cash" />
            </div>
            <div className="space-y-2">
              <Label>Account Type (Group)</Label>
              <SearchableSelect
                value={glAccountForm.group}
                onChange={(v: any) => setGLAccountForm({...glAccountForm, group: v})}
                options={ACCOUNT_GROUPS}
                getOptionLabel={g => SYSTEM_CRITICAL_GROUPS.includes(g) ? `${g} (System)` : g}
                getOptionValue={g => g}
                placeholder="Pick Group"
                searchPlaceholder="Search group..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Opening Balance</Label>
                <Input type="number" value={glAccountForm.openingBalance ?? ''} onChange={e => setGLAccountForm({...glAccountForm, openingBalance: Number(e.target.value)})} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Nature</Label>
                <Select value={glAccountForm.openingType} onValueChange={(v: 'Debit' | 'Credit') => setGLAccountForm({...glAccountForm, openingType: v})}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Debit">Debit (+ / Assets)</SelectItem>
                    <SelectItem value="Credit">Credit (- / Liab)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSaveGLAccount} className="w-full h-12 rounded-xl">Save GL Account</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense Dialog */}
      <Dialog open={isExpenseCatDialogOpen} onOpenChange={setIsExpenseCatDialogOpen}>
        <DialogContent className="max-w-md rounded-[2rem]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><TrendingDown className="w-5 h-5 text-red-500" /> Expense Category</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Label>Category Name</Label>
            <Input value={expenseCatForm.name || ''} onChange={e => setExpenseCatForm({...expenseCatForm, name: e.target.value})} placeholder="e.g. Electricity Bill" />
          </div>
          <DialogFooter><Button onClick={handleSaveExpenseCat} className="w-full h-12 rounded-xl">Save Expense</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Income Dialog */}
      <Dialog open={isIncomeCatDialogOpen} onOpenChange={setIsIncomeCatDialogOpen}>
        <DialogContent className="max-w-md rounded-[2rem]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-green-500" /> Income Category</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Label>Category Name</Label>
            <Input value={incomeCatForm.name || ''} onChange={e => setIncomeCatForm({...incomeCatForm, name: e.target.value})} placeholder="e.g. Scrap Sale" />
          </div>
          <DialogFooter><Button onClick={handleSaveIncomeCat} className="w-full h-12 rounded-xl">Save Income</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Raw Item Dialog */}
      <Dialog open={isRawItemDialogOpen} onOpenChange={setIsRawItemDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-[2rem]">
          <DialogHeader className="p-6 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2"><LayoutGrid className="w-5 h-5 text-primary" /> {editingId ? 'Edit Raw Item' : 'New Raw Item'}</DialogTitle>
            <DialogDescription>Define item details, category, and unit relationships.</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Item Name</Label>
                <Input value={rawItemForm.name || ''} onChange={e => setRawItemForm({...rawItemForm, name: e.target.value})} placeholder="e.g. Onion" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <SearchableSelect
                  value={rawItemForm.categoryId}
                  onChange={v => setRawItemForm({...rawItemForm, categoryId: v})}
                  options={categories}
                  getOptionLabel={c => c.name}
                  getOptionValue={c => c.id}
                  placeholder="Pick Category"
                  searchPlaceholder="Search category..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Opening Stock</Label>
                <Input 
                  type="number" 
                  value={rawItemForm.openingStock ?? ''} 
                  onChange={e => setRawItemForm({...rawItemForm, openingStock: Number(e.target.value)})} 
                  placeholder="0.00" 
                />
              </div>
              <div className="space-y-2">
                <Label>Opening Value (Total Cost)</Label>
                <Input 
                  type="number" 
                  value={rawItemForm.openingValue ?? ''} 
                  onChange={e => setRawItemForm({...rawItemForm, openingValue: Number(e.target.value)})} 
                  placeholder="0.00" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Basic Unit</Label>
              <SearchableSelect
                value={rawItemForm.baseUnitId}
                onChange={v => setRawItemForm({...rawItemForm, baseUnitId: v})}
                options={units}
                getOptionLabel={u => u.name}
                getOptionValue={u => u.id}
                placeholder="Select Basic Unit"
                searchPlaceholder="Search unit..."
              />
            </div>

            {editingId && (
              <div className="space-y-2">
                <Label className="text-primary font-bold">Override Current Stock</Label>
                <Input 
                  type="number" 
                  value={rawItemForm.currentStock ?? ''} 
                  onChange={e => setRawItemForm({...rawItemForm, currentStock: Number(e.target.value)})} 
                  placeholder="Only edit if you need to manual correct stock" 
                />
              </div>
            )}

            <div className="space-y-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Conversions</Label>
                <Button variant="ghost" size="sm" onClick={handleAddConversionRow} className="text-primary text-xs font-bold" disabled={!rawItemForm.baseUnitId}>
                  <PlusCircle className="w-4 h-4 mr-1" /> Add Alternate Unit
                </Button>
              </div>

              {rawItemForm.baseUnitId ? (
                <div className="space-y-3">
                  {(rawItemForm.conversions || []).map((conv, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-secondary/20 p-3 rounded-xl border border-secondary/30">
                      <span className="text-xs font-bold min-w-[30px]">1 {getUnitName(rawItemForm.baseUnitId)} =</span>
                      <Input type="number" className="w-20 bg-white" placeholder="Factor" value={conv.factor || ''} onChange={e => handleConversionChange(idx, 'factor', Number(e.target.value))} />
                      <SearchableSelect
                        value={conv.unitId}
                        onChange={v => handleConversionChange(idx, 'unitId', v)}
                        options={units.filter(u => u.id !== rawItemForm.baseUnitId)}
                        getOptionLabel={u => u.name}
                        getOptionValue={u => u.id}
                        placeholder="Unit"
                        searchPlaceholder="Search unit..."
                        triggerClassName="flex-1 h-10 border-none bg-white font-normal"
                      />
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveConversionRow(idx)}><MinusCircle className="w-4 h-4 text-muted-foreground" /></Button>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-muted-foreground italic text-center py-4">Select basic unit first.</p>}
            </div>
          </div>

          <DialogFooter className="p-6 border-t shrink-0">
            <Button onClick={handleSaveRawItem} className="w-full h-12 rounded-xl font-bold">Save Raw Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="max-md rounded-[2rem]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Tags className="w-5 h-5" /> Category</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Label>Category Name</Label>
            <Input value={categoryForm.name || ''} onChange={e => setCategoryForm({...categoryForm, name: e.target.value})} placeholder="e.g. Grains" />
          </div>
          <DialogFooter><Button onClick={handleSaveCategory} className="w-full h-12 rounded-xl">Save Category</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unit Dialog */}
      <Dialog open={isUnitDialogOpen} onOpenChange={setIsUnitDialogOpen}>
        <DialogContent className="max-md rounded-[2rem]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Ruler className="w-5 h-5" /> Unit</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Label>Unit Name</Label>
            <Input value={unitForm.name || ''} onChange={e => setUnitForm({...unitForm, name: e.target.value})} placeholder="e.g. kg" />
          </div>
          <DialogFooter><Button onClick={handleSaveUnit} className="w-full h-12 rounded-xl">Save Unit</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supplier Dialog */}
      <Dialog open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-[2rem]">
          <DialogHeader className="p-6 border-b shrink-0"><DialogTitle>Supplier Details</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={supplierForm.name || ''} onChange={e => setSupplierForm({...supplierForm, name: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Phone</Label><Input value={supplierForm.phone || ''} onChange={e => setSupplierForm({...supplierForm, phone: e.target.value})} /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={supplierForm.email || ''} onChange={e => setSupplierForm({...supplierForm, email: e.target.value})} /></div>
            </div>
            <div className="space-y-2"><Label>Address</Label><Textarea value={supplierForm.address || ''} onChange={e => setSupplierForm({...supplierForm, address: e.target.value})} /></div>
          </div>
          <DialogFooter className="p-6 border-t shrink-0"><Button onClick={handleSaveSupplier} className="w-full h-12 rounded-xl font-bold">Save Supplier</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

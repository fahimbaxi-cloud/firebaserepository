"use client";

import { useState, useRef, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit, Trash2, Sparkles, RefreshCw, Upload, PlusCircle, MinusCircle, Loader2, ZoomIn, AlertCircle, Search } from 'lucide-react';
import { adminMenuItemDescriptionGeneration } from '@/ai/flows/admin-menu-item-description-generation';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { MenuItem, RawItem, MenuItemIngredient, Unit, BroadcastPackage } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';

export default function MenuManagement() {
  const firestore = useFirestore();
  const { toast } = useToast();

  // Firestore Data
  const menuQuery = useMemoFirebase(() => collection(firestore, 'menu_items'), [firestore]);
  const { data: menuData, isLoading: menuLoading } = useCollection<MenuItem>(menuQuery);
  const menu = menuData || [];

  const rawItemsQuery = useMemoFirebase(() => collection(firestore, 'raw_items'), [firestore]);
  const { data: rawItemsData } = useCollection<RawItem>(rawItemsQuery);
  const rawItems = useMemo(() => {
    return [...(rawItemsData || [])].sort((a, b) => 
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
    );
  }, [rawItemsData]);

  const unitsQuery = useMemoFirebase(() => collection(firestore, 'units'), [firestore]);
  const { data: unitsData } = useCollection<Unit>(unitsQuery);
  const units = unitsData || [];

  const packagesQuery = useMemoFirebase(() => collection(firestore, 'packages'), [firestore]);
  const { data: allPackages } = useCollection<BroadcastPackage>(packagesQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formItem, setFormItem] = useState({
    name: '',
    type: 'Veg' as 'Veg' | 'Non-Veg',
    price: '',
    description: '',
    ingredients: [] as MenuItemIngredient[],
    show: true
  });
  
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateDescription = async () => {
    if (!formItem.name) {
      toast({ title: "Name missing", description: "Please enter an item name first.", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      const result = await adminMenuItemDescriptionGeneration({
        itemName: formItem.name,
        vegNonVegType: formItem.type
      });
      setFormItem({ ...formItem, description: result.description });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to generate description.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 1MB is the absolute Firestore limit for a whole document including data.
      // Base64 encoding adds ~33% overhead, so 750KB is the safe physical limit.
      if (file.size > 750 * 1024) { 
        toast({ 
          title: "Image Too Large", 
          description: "Firestore limits documents to 1MB. Please use an image under 750KB to ensure it can be saved.", 
          variant: "destructive" 
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => { 
        setImagePreview(reader.result as string);
        toast({ title: "Photo Ready", description: "Image processed successfully." });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItemId(item.id);
    setFormItem({
      name: item.name,
      type: item.type,
      price: item.price.toString(),
      description: item.description,
      ingredients: item.ingredients || [],
      show: item.show !== false
    });
    setImagePreview(item.imageUrl);
    setIsDialogOpen(true);
  };

  const handleAddIngredient = () => {
    setFormItem({
      ...formItem,
      ingredients: [...formItem.ingredients, { rawItemId: '', quantity: 0, unitId: '' }]
    });
  };

  const handleRemoveIngredient = (index: number) => {
    setFormItem({
      ...formItem,
      ingredients: formItem.ingredients.filter((_, i) => i !== index)
    });
  };

  const handleIngredientChange = (index: number, field: keyof MenuItemIngredient, value: any) => {
    const updated = [...formItem.ingredients];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'rawItemId') {
      const rawItem = rawItems.find(r => r.id === value);
      if (rawItem) {
        updated[index].unitId = rawItem.baseUnitId;
      }
    }
    
    setFormItem({ ...formItem, ingredients: updated });
  };

  const isItemUsedInBroadcast = (itemId: string) => {
    return (allPackages || []).some(pkg => pkg.items?.includes(itemId));
  };

  const handleDelete = (itemId: string, itemName: string) => {
    if (isItemUsedInBroadcast(itemId)) {
      toast({
        title: "Cannot Delete Item",
        description: `"${itemName}" is currently used in one or more broadcast packages. Remove it from those packages first.`,
        variant: "destructive"
      });
      return;
    }

    const ref = doc(firestore, 'menu_items', itemId);
    deleteDocumentNonBlocking(ref);
    toast({ title: "Item Deleted", description: `"${itemName}" has been removed from the collection.` });
  };

  const resetForm = () => {
    setFormItem({ name: '', type: 'Veg', price: '', description: '', ingredients: [], show: true });
    setImagePreview(null);
    setEditingItemId(null);
  };

  const handleSave = () => {
    if (!formItem.name || !formItem.price) {
      toast({ title: "Missing Fields", description: "Please fill in the name and price.", variant: "destructive" });
      return;
    }
    const filteredIngredients = formItem.ingredients.filter(ing => ing.rawItemId !== '');
    
    const itemData: any = {
      ...formItem,
      price: Number(formItem.price),
      imageUrl: imagePreview || `https://picsum.photos/seed/${Math.random()}/600/400`,
      ingredients: filteredIngredients,
      updatedAt: new Date().toISOString()
    };

    if (editingItemId) {
      const ref = doc(firestore, 'menu_items', editingItemId);
      updateDocumentNonBlocking(ref, itemData);
      toast({ title: "Menu Item Updated", description: `${formItem.name} has been updated.` });
    } else {
      const ref = collection(firestore, 'menu_items');
      addDocumentNonBlocking(ref, { ...itemData, createdAt: new Date().toISOString() });
      toast({ title: "Menu Item Added", description: `${formItem.name} is now in your collection.` });
    }
    setIsDialogOpen(false);
    resetForm();
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground">Item Collection</h1>
          <p className="text-muted-foreground mt-1 font-medium">Create and manage your food items library.</p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="bg-primary hover:bg-primary/90 rounded-xl h-12 px-6 font-bold shadow-lg shadow-primary/20">
          <Plus className="w-5 h-5 mr-2" />
          Add New Item
        </Button>
      </header>

      {menuLoading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Syncing Menu...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menu.map((item) => (
            <Card key={item.id} className="rounded-3xl border-none shadow-sm overflow-hidden bg-white group hover:shadow-md transition-all">
              <div className="flex h-40">
                <div className="w-1/3 relative shrink-0 overflow-hidden group/image">
                  <img src={item.imageUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover/image:scale-110" alt={item.name} />
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity">
                        <ZoomIn className="w-6 h-6 text-white" />
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-none">
                      <DialogHeader className="sr-only">
                        <DialogTitle>{item.name}</DialogTitle>
                        <DialogDescription>Enlarged view of {item.name}</DialogDescription>
                      </DialogHeader>
                      <div className="relative w-full aspect-video rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl">
                        <img src={item.imageUrl} className="w-full h-full object-cover" alt={item.name} />
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <CardContent className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-lg leading-tight flex-1 mr-2">{item.name}</h4>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(item)} className="w-8 h-8 rounded-full text-muted-foreground hover:text-primary">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(item.id, item.name)} 
                          className="w-8 h-8 rounded-full text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <Badge className={`text-[9px] h-4 rounded-md border-none mt-1 ${item.type === 'Veg' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{item.type}</Badge>
                  </div>
                  <span className="font-bold text-primary text-lg">{item.price}</span>
                </CardContent>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-8 pb-0">
            <DialogTitle className="text-2xl font-headline">{editingItemId ? 'Edit Item' : 'Add to Item'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-8 py-4 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2"><Label>Item Name</Label><Input value={formItem.name} onChange={e => setFormItem({...formItem, name: e.target.value})} className="rounded-xl h-11" /></div>
              <div className="space-y-2"><Label>Base Price</Label><Input type="number" value={formItem.price} onChange={e => setFormItem({...formItem, price: e.target.value})} className="rounded-xl h-11" /></div>
              <div className="space-y-2"><Label>Dietary Type</Label>
                <Select value={formItem.type} onValueChange={(v: any) => setFormItem({...formItem, type: v})}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Veg">Veg</SelectItem><SelectItem value="Non-Veg">Non-Veg</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-8 pl-1">
                <Checkbox 
                  id="show-btn" 
                  checked={formItem.show} 
                  onCheckedChange={(checked) => setFormItem({...formItem, show: !!checked})} 
                  className="rounded-lg h-5 w-5"
                />
                <Label htmlFor="show-btn" className="font-bold cursor-pointer text-sm select-none">Show</Label>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center"><Label>Description</Label>
                <Button variant="ghost" size="sm" onClick={handleGenerateDescription} disabled={isGenerating} className="text-accent text-[10px] font-bold h-auto p-0">
                  {isGenerating ? <RefreshCw className="w-3 h-3 mr-1 animate-spin"/> : <Sparkles className="w-3 h-3 mr-1"/>} AI Generate
                </Button>
              </div>
              <Textarea value={formItem.description} onChange={e => setFormItem({...formItem, description: e.target.value})} className="rounded-xl min-h-[80px]" />
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Item Recipe (Ingredients)</Label>
                <Button variant="ghost" size="sm" onClick={handleAddIngredient} className="text-primary text-xs font-bold h-7 px-2">
                  <PlusCircle className="w-3.5 h-3.5 mr-1" /> Add Ingredient
                </Button>
              </div>
              <div className="space-y-3">
                {formItem.ingredients.length > 0 ? (
                  formItem.ingredients.map((ing, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-secondary/20 p-3 rounded-2xl border border-secondary/30 group">
                      <div className="col-span-5 space-y-1">
                        <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">Raw Item</Label>
                        <RawItemSelector 
                          value={ing.rawItemId} 
                          onChange={v => handleIngredientChange(idx, 'rawItemId', v)} 
                          rawItems={rawItems}
                        />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">Qty</Label>
                        <Input 
                          type="number" 
                          value={ing.quantity || ''} 
                          onChange={e => handleIngredientChange(idx, 'quantity', Number(e.target.value))}
                          placeholder="0.00"
                          className="h-10 rounded-xl bg-white border-none text-xs"
                        />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">Unit</Label>
                        <Select value={ing.unitId} onValueChange={v => handleIngredientChange(idx, 'unitId', v)}>
                          <SelectTrigger className="h-10 rounded-xl bg-white border-none text-xs">
                            <SelectValue placeholder="Unit" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {units.map(u => (
                              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-1 flex items-center justify-center h-10">
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveIngredient(idx)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 border-2 border-dashed border-secondary rounded-2xl bg-secondary/5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">No ingredients added yet</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <Label>Item Picture</Label>
              <div onClick={() => fileInputRef.current?.click()} className="relative w-full aspect-video rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-secondary/20 hover:bg-secondary/40 transition-all cursor-pointer flex flex-col items-center justify-center overflow-hidden">
                {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" /> : <div className="text-center p-4"><Upload className="w-8 h-8 text-primary mx-auto mb-2"/><span className="text-xs font-bold">Upload Food Photo</span></div>}
              </div>
              <div className="flex items-start gap-2 bg-blue-50 p-3 rounded-xl border border-blue-100">
                <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-blue-700 leading-tight">
                  DATABASE LIMIT: Please use images under 750KB. High-resolution photos exceed the 1MB database document size limit when converted to text.
                </p>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            </div>
          </div>
          <DialogFooter className="p-8 pt-4 bg-secondary/5 border-t"><Button onClick={handleSave} className="w-full h-14 rounded-2xl font-bold text-lg shadow-lg">Save Item</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface RawItemSelectorProps {
  value: string;
  onChange: (value: string) => void;
  rawItems: RawItem[];
}

function RawItemSelector({ value, onChange, rawItems }: RawItemSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  
  const selectedItem = rawItems.find(ri => ri.id === value);
  
  const filtered = useMemo(() => {
    return rawItems.filter(ri => 
      (ri.name || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [rawItems, search]);

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) setSearch("");
    }}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          role="combobox" 
          aria-expanded={open} 
          className="w-full h-10 rounded-xl bg-white border-none text-xs justify-between font-normal text-foreground px-3 flex items-center"
        >
          <span className="truncate">
            {selectedItem ? selectedItem.name : "Pick item"}
          </span>
          <span className="text-muted-foreground ml-2 text-[10px]">▼</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[200px] p-2 rounded-2xl shadow-xl border border-secondary/30 bg-white" align="start">
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input 
            placeholder="Search raw item..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="pl-8 pr-3 h-8 text-xs rounded-lg border border-secondary/30 bg-secondary/5 focus-visible:ring-primary/20"
          />
        </div>
        <ScrollArea className="h-[200px] pr-1">
          {filtered.length > 0 ? (
            <div className="space-y-1">
              {filtered.map(ri => (
                <button
                  key={ri.id}
                  type="button"
                  onClick={() => {
                    onChange(ri.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition-colors truncate block ${
                    ri.id === value 
                      ? "bg-primary text-white" 
                      : "hover:bg-primary/10 text-foreground"
                  }`}
                >
                  {ri.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-center text-[10px] text-muted-foreground py-4 font-bold uppercase">No items found</p>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

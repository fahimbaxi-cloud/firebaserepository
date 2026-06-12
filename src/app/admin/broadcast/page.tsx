"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getMonth, getYear, isValid, parse } from 'date-fns';
import { 
  Sparkles, 
  Send, 
  RefreshCw, 
  Info, 
  PlusCircle, 
  Calendar as CalendarIcon, 
  Edit, 
  Trash2, 
  Plus, 
  ArrowLeft, 
  Megaphone, 
  Tag, 
  Upload, 
  Loader2,
  ZoomIn
} from 'lucide-react';
import { adminMenuNotificationGeneration } from '@/ai/flows/admin-menu-notification-generation';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, getDocs, limit } from 'firebase/firestore';
import { BroadcastPackage, MenuItem, User } from '@/lib/types';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

export default function BroadcastPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Auth check to gate queries
  useEffect(() => {
    const checkUser = async () => {
      const loggedId = localStorage.getItem('bacchabite_logged_id');
      if (loggedId) {
        const q = query(collection(firestore, 'users'), where('bacchabiteId', '==', loggedId), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setCurrentUser({ ...snap.docs[0].data(), id: snap.docs[0].id } as User);
        }
      }
    };
    checkUser();
    setMounted(true);
  }, [firestore]);

  // Firestore Data - Gated by currentUser
  const packagesQuery = useMemoFirebase(() => {
    if (!currentUser) return null;
    return collection(firestore, 'packages');
  }, [firestore, currentUser]);
  const { data: packagesData, isLoading: packagesLoading } = useCollection<BroadcastPackage>(packagesQuery);
  const packages = packagesData || [];

  const menuQuery = useMemoFirebase(() => {
    if (!currentUser) return null;
    return collection(firestore, 'menu_items');
  }, [firestore, currentUser]);
  const { data: menuData } = useCollection<MenuItem>(menuQuery);
  const menuItems = menuData || [];

  // Form State
  const [broadcastType, setBroadcastType] = useState<'daily' | 'monthly'>('daily');
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [packageName, setPackageName] = useState('');
  const [message, setMessage] = useState('');
  const [specialOffers, setSpecialOffers] = useState('');
  const [packagePrice, setPackagePrice] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Daily State
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dailySelectedItems, setDailySelectedItems] = useState<string[]>([]);

  // Monthly State
  const [currentMonth, setCurrentMonth] = useState<number>(getMonth(new Date()));
  const [currentYear, setCurrentYear] = useState<number>(getYear(new Date()));
  const [monthlyAssignments, setMonthlyAssignments] = useState<Record<string, string[]>>({});

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(new Date(currentYear, currentMonth));
    const end = endOfMonth(start);
    return eachDayOfInterval({ start, end });
  }, [currentMonth, currentYear]);

  const selectedItemsValue = useMemo(() => {
    if (broadcastType === 'daily') {
      return (menuItems || [])
        .filter(item => dailySelectedItems.includes(item.id))
        .reduce((sum, item) => sum + item.price, 0);
    } else {
      const uniqueItemIds = Array.from(new Set(Object.values(monthlyAssignments).flat()));
      return (menuItems || [])
        .filter(item => uniqueItemIds.includes(item.id))
        .reduce((sum, item) => sum + item.price, 0);
    }
  }, [broadcastType, dailySelectedItems, monthlyAssignments, menuItems]);

  const handleToggleDailyItem = (itemId: string) => {
    setDailySelectedItems(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const handleToggleMonthlyItem = (dateKey: string, itemId: string) => {
    setMonthlyAssignments(prev => {
      const current = prev[dateKey] || [];
      const updated = current.includes(itemId) 
        ? current.filter(id => id !== itemId)
        : [...current, itemId];
      return { ...prev, [dateKey]: updated };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 750KB limit to account for Base64 overhead (1MB hard limit in Firestore)
      if (file.size > 750 * 1024) { 
        toast({ 
          title: "File too large", 
          description: "Photos must be under 750KB to fit within database limits.", 
          variant: "destructive" 
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        toast({ title: "Photo Ready", description: "Package visual has been prepared." });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (broadcastType === 'daily' && dailySelectedItems.length === 0) {
      toast({ title: "No Items", description: "Select items for your daily special.", variant: "destructive" });
      return;
    }

    const assignedDatesCount = Object.keys(monthlyAssignments).filter(k => (monthlyAssignments[k]?.length || 0) > 0).length;
    if (broadcastType === 'monthly' && assignedDatesCount === 0) {
      toast({ title: "Empty Plan", description: "Assign menu items to the monthly calendar.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      let menuItemsToGenerate: any[] = [];
      let context = "";

      if (broadcastType === 'daily') {
        menuItemsToGenerate = (menuItems || [])
          .filter(item => dailySelectedItems.includes(item.id))
          .map(item => ({
            itemName: item.name || 'Unnamed Item',
            vegNonVegType: item.type || 'Veg',
            timeSlot: item.slot || 'Morning',
            price: item.price || 0,
            description: item.description || 'Nutritious meal'
          }));
        context = `Daily menu for ${format(selectedDate || new Date(), 'PPP')}`;
      } else {
        const uniqueItemIds = Array.from(new Set(Object.values(monthlyAssignments).flat()));
        menuItemsToGenerate = (menuItems || [])
          .filter(item => uniqueItemIds.includes(item.id))
          .map(item => ({
            itemName: item.name || 'Unnamed Item',
            vegNonVegType: item.type || 'Veg',
            timeSlot: item.slot || 'Morning',
            price: item.price || 0,
            description: item.description || 'Nutritious meal'
          }));
        context = `Monthly subscription for ${format(new Date(currentYear, currentMonth), 'MMMM yyyy')}`;
      }

      const result = await adminMenuNotificationGeneration({
        menuItems: menuItemsToGenerate,
        specialOffers: `${specialOffers} (${context})`.trim(),
        packagePrice: packagePrice ? Number(packagePrice) : undefined
      });

      if (result && result.notificationMessage) {
        setMessage(result.notificationMessage);
        toast({ title: "Message Ready!", description: "AI has crafted your broadcast content." });
      } else {
        throw new Error('No message generated');
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Generation Failed", description: "The AI service encountered an issue. Please check item details.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = () => {
    if (!packageName) {
      toast({ title: "Name Required", description: "Please enter a name for this package.", variant: "destructive" });
      return;
    }

    const dateStr = broadcastType === 'daily' 
      ? format(selectedDate || new Date(), 'MMMM d, yyyy') 
      : format(new Date(currentYear, currentMonth), 'MMMM yyyy');

    let finalItems: string[] = [];
    const dayItems: Record<string, string[]> = {};
    if (broadcastType === 'daily') {
      finalItems = dailySelectedItems;
    } else {
      const sortedDays = [...daysInMonth].sort((a, b) => a.getTime() - b.getTime());
      sortedDays.forEach(day => {
        const key = format(day, 'yyyy-MM-dd');
        const itemsForDay = monthlyAssignments[key] || [];
        if (itemsForDay.length > 0) {
          finalItems.push(...itemsForDay);
          dayItems[key] = itemsForDay;
          dayItems[day.getDate().toString()] = itemsForDay;
        }
      });
    }

    const newPackageData: any = {
      name: packageName,
      type: broadcastType,
      dateContext: dateStr,
      itemsCount: finalItems.length,
      price: Number(packagePrice),
      message: message,
      imageUrl: imagePreview || null,
      items: finalItems,
      dayItems: broadcastType === 'monthly' ? dayItems : null,
      updatedAt: new Date().toISOString()
    };

    if (editingPackageId) {
      const ref = doc(firestore, 'packages', editingPackageId);
      updateDocumentNonBlocking(ref, newPackageData);
      toast({ title: "Broadcast Updated!", description: "The live broadcast has been modified." });
    } else {
      newPackageData.createdAt = new Date().toISOString();
      const ref = collection(firestore, 'packages');
      addDocumentNonBlocking(ref, newPackageData);
      toast({ title: "Broadcast Created!", description: "New special is now live for customers." });
    }
    
    resetForm();
    setView('list');
  };

  const handleEdit = (pkg: BroadcastPackage) => {
    setEditingPackageId(pkg.id);
    setPackageName(pkg.name);
    setBroadcastType(pkg.type);
    setPackagePrice(pkg.price.toString());
    setMessage(pkg.message || '');
    setSpecialOffers('');
    setImagePreview(pkg.imageUrl || null);
    
    if (pkg.type === 'daily' && pkg.dateContext) {
      try {
        const date = parse(pkg.dateContext, 'MMMM d, yyyy', new Date());
        if (isValid(date)) {
          setSelectedDate(date);
          setDailySelectedItems(pkg.items || []);
        }
      } catch (e) {
        console.error(e);
        setSelectedDate(new Date());
      }
    } else if (pkg.type === 'monthly' && pkg.dateContext) {
      try {
        const date = parse(pkg.dateContext, 'MMMM yyyy', new Date());
        if (isValid(date)) {
          setCurrentMonth(getMonth(date));
          setCurrentYear(getYear(date));
          const loadedAssignments: Record<string, string[]> = {};
          if ((pkg as any).dayItems) {
            Object.keys((pkg as any).dayItems).forEach(k => {
              if (k.includes('-')) {
                loadedAssignments[k] = (pkg as any).dayItems[k];
              }
            });
          }
          setMonthlyAssignments(loadedAssignments);
        }
      } catch (e) {
        console.error(e);
      }
    }
    
    setView('edit');
  };

  const handleDelete = (id: string) => {
    const ref = doc(firestore, 'packages', id);
    deleteDocumentNonBlocking(ref);
    toast({ title: "Broadcast Removed", description: "Package cleared from database." });
  };

  const resetForm = () => {
    setEditingPackageId(null);
    setPackageName('');
    setDailySelectedItems([]);
    setMonthlyAssignments({});
    setMessage('');
    setPackagePrice('');
    setSpecialOffers('');
    setImagePreview(null);
    setBroadcastType('daily');
    setSelectedDate(new Date());
  };

  return (
    <div className="space-y-8">
      {view === 'list' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-headline font-bold text-accent">Broadcast Hub</h1>
              <p className="text-muted-foreground mt-1 font-medium">Manage specials and subscription plans.</p>
            </div>
            <Button onClick={() => { resetForm(); setView('edit'); }} className="bg-primary hover:bg-primary/90 text-white rounded-xl h-12 px-6 font-bold shadow-lg shadow-primary/20">
              <Plus className="w-5 h-5 mr-2" />
              Create New Broadcast
            </Button>
          </header>

          {packagesLoading || !currentUser ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Syncing Registry...</p>
            </div>
          ) : packages.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {packages.map((pkg) => (
                <Card key={pkg.id} className="rounded-3xl border-none shadow-sm overflow-hidden bg-white group hover:shadow-md transition-all">
                  <div className="flex h-40">
                    <div className="w-1/3 relative shrink-0 bg-slate-50 border-r border-secondary/10 overflow-hidden group/image">
                      {pkg.imageUrl ? (
                        <>
                          <img src={pkg.imageUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover/image:scale-110" alt={pkg.name} />
                          <Dialog>
                            <DialogTrigger asChild>
                              <button className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity">
                                <ZoomIn className="w-6 h-6 text-white" />
                              </button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-none">
                              <div className="relative w-full aspect-video rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl">
                                <img src={pkg.imageUrl} className="w-full h-full object-cover" alt={pkg.name} />
                              </div>
                            </DialogContent>
                          </Dialog>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center opacity-20">
                          <Megaphone className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4 flex-1 flex flex-col justify-between overflow-hidden">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-bold text-base leading-tight flex-1 truncate">{pkg.name}</h4>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(pkg)} className="w-8 h-8 rounded-full text-muted-foreground hover:text-primary">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDelete(pkg.id)} 
                              className="w-8 h-8 rounded-full text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{pkg.dateContext}</p>
                        <Badge variant="secondary" className={cn(
                          "rounded-lg px-2 py-0 h-4 border-none uppercase text-[8px] font-black mt-2",
                          pkg.type === 'daily' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                        )}>
                          {pkg.type}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-black text-primary text-lg">Rs {pkg.price}</span>
                        <div className="text-[9px] font-black text-muted-foreground uppercase bg-secondary/50 px-2 py-0.5 rounded">
                          {pkg.itemsCount} Dishes
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-24 bg-white rounded-[3rem] shadow-sm border-2 border-dashed border-secondary">
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="p-4 bg-secondary rounded-full">
                  <Megaphone className="w-8 h-8 text-muted-foreground/30" />
                </div>
                <p className="text-muted-foreground font-medium">No active broadcasts.</p>
                <Button variant="link" onClick={() => { resetForm(); setView('edit'); }} className="text-primary font-bold">Start your first broadcast</Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <header className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => { resetForm(); setView('list'); }} className="rounded-full bg-white shadow-sm">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-headline font-bold text-accent">
                {editingPackageId ? 'Edit Broadcast' : 'New Broadcast'}
              </h1>
              <p className="text-muted-foreground mt-1 font-medium">Define your menu offering for customers.</p>
            </div>
          </header>

          <Tabs value={broadcastType} onValueChange={(v) => setBroadcastType(v as any)} className="w-full">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-6">
                <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white">
                  <CardHeader className="pb-4">
                    <TabsList className="grid w-full grid-cols-2 rounded-2xl h-14 bg-secondary/50 p-1">
                      <TabsTrigger value="daily" className="rounded-xl font-bold h-full data-[state=active]:bg-white data-[state=active]:shadow-sm">Daily Special</TabsTrigger>
                      <TabsTrigger value="monthly" className="rounded-xl font-bold h-full data-[state=active]:bg-white data-[state=active]:shadow-sm">Monthly Subscription</TabsTrigger>
                    </TabsList>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <TabsContent value="daily" className="m-0 space-y-6">
                      <div className="space-y-4">
                        <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Package Title</Label>
                        <div className="relative">
                          <Input 
                            placeholder="e.g. Nutri-Power Breakfast Box" 
                            value={packageName}
                            onChange={(e) => setPackageName(e.target.value)}
                            className="h-14 bg-secondary/30 border-none rounded-2xl font-bold px-11"
                          />
                          <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">For Which Date?</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full h-14 justify-start text-left font-bold rounded-2xl bg-secondary/30 border-none px-6",
                                  !selectedDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-3 h-5 w-5 text-primary" />
                                {mounted && selectedDate ? format(selectedDate, "PPP") : <span>Pick date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 rounded-3xl border-none shadow-2xl" align="start">
                              <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus className="rounded-3xl" />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-4">
                          <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Select Menu Items</Label>
                          <ScrollArea className="h-[300px] pr-4 border-2 border-secondary/50 rounded-2xl p-4 bg-secondary/10">
                            <div className="space-y-3">
                              {menuItems.map((item) => (
                                <div 
                                  key={item.id} 
                                  className={cn(
                                    "flex items-center space-x-3 p-3 rounded-2xl border-2 transition-all cursor-pointer",
                                    dailySelectedItems.includes(item.id) 
                                      ? "border-primary bg-primary/5 shadow-sm" 
                                      : "border-transparent bg-white hover:border-primary/30"
                                  )}
                                  onClick={() => handleToggleDailyItem(item.id)}
                                >
                                  <Checkbox checked={dailySelectedItems.includes(item.id)} className="rounded-md h-5 w-5" />
                                  <div className="flex-1">
                                    <p className="font-bold text-sm">{item.name}</p>
                                    <p className="text-[10px] text-muted-foreground">Rs {item.price}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="monthly" className="m-0 space-y-6">
                      <div className="space-y-4">
                        <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Plan Name</Label>
                        <div className="relative">
                          <Input 
                            placeholder="e.g. June Summer-Bite Plan" 
                            value={packageName}
                            onChange={(e) => setPackageName(e.target.value)}
                            className="h-14 bg-secondary/30 border-none rounded-2xl font-bold px-11"
                          />
                          <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="flex-1 space-y-2">
                          <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Target Month</Label>
                          <Select 
                            value={currentMonth.toString()} 
                            onValueChange={(val) => setCurrentMonth(parseInt(val))}
                          >
                            <SelectTrigger className="rounded-2xl h-14 bg-secondary/30 border-none font-bold px-6">
                              <SelectValue placeholder="Month" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl">
                              {Array.from({ length: 12 }).map((_, i) => (
                                <SelectItem key={i} value={i.toString()}>
                                  {mounted ? format(new Date(2024, i), 'MMMM') : '...'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1 space-y-2">
                          <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Year</Label>
                          <Input 
                            type="number" 
                            value={currentYear} 
                            onChange={(e) => setCurrentYear(parseInt(e.target.value) || new Date().getFullYear())}
                            className="rounded-2xl h-14 bg-secondary/30 border-none font-bold px-6 focus-visible:ring-0"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Assign Items to Calendar</Label>
                        <ScrollArea className="h-[400px] pr-4 border-2 border-secondary/50 rounded-2xl bg-secondary/10 overflow-hidden">
                          <div className="divide-y divide-secondary/30">
                            {daysInMonth.map((day) => {
                              const dateKey = format(day, 'yyyy-MM-dd');
                              const assignments = monthlyAssignments[dateKey] || [];
                              return (
                                <div key={dateKey} className="p-4 flex items-center justify-between hover:bg-white/50 transition-colors">
                                  <div className="flex items-center gap-4">
                                    <div className="text-center bg-white rounded-2xl p-2 min-w-[65px] shadow-sm border border-secondary/50">
                                      <p className="text-[10px] font-black text-primary uppercase">{mounted ? format(day, 'EEE') : '...'}</p>
                                      <p className="text-xl font-black leading-none">{mounted ? format(day, 'dd') : '..'}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                                      {assignments.length > 0 ? (
                                        assignments.map(id => {
                                          const item = menuItems.find(m => m.id === id);
                                          return (
                                            <Badge key={id} variant="secondary" className="bg-primary/10 text-primary border-none text-[10px] font-bold py-1">
                                              {item?.name}
                                            </Badge>
                                          );
                                        })
                                      ) : (
                                        <span className="text-[10px] text-muted-foreground italic">No meal set</span>
                                      )}
                                    </div>
                                  </div>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button size="sm" variant="outline" className="rounded-xl border-dashed border-primary text-primary h-10 px-4 font-bold">
                                        <PlusCircle className="w-4 h-4 mr-2" />
                                        Assign
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-72 p-0 rounded-2xl shadow-2xl border-none overflow-hidden" align="end">
                                      <div className="bg-secondary/20 p-3 border-b">
                                        <p className="text-[10px] font-black uppercase text-accent">{mounted ? format(day, 'PPPP') : '...'}</p>
                                      </div>
                                      <ScrollArea className="h-64 p-2">
                                        <div className="space-y-1">
                                          {menuItems.map((item) => (
                                            <div 
                                              key={item.id}
                                              className={cn(
                                                "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors",
                                                assignments.includes(item.id) ? "bg-primary/5" : "hover:bg-secondary/50"
                                              )}
                                              onClick={() => handleToggleMonthlyItem(dateKey, item.id)}
                                            >
                                              <Checkbox checked={assignments.includes(item.id)} className="rounded-md h-5 w-5" />
                                              <div className="flex-1">
                                                <p className="text-xs font-black">{item.name}</p>
                                                <p className="text-[10px] text-muted-foreground">Rs {item.price}</p>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </ScrollArea>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </div>
                    </TabsContent>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-4 space-y-6">
                <Card className="rounded-[2.5rem] border-none shadow-lg overflow-hidden bg-accent text-white">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-6 h-6" />
                        Pricing & Visuals
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-5">
                      <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
                        <p className="text-[10px] font-black uppercase text-white/60 tracking-widest mb-1">Estimated Value</p>
                        <p className="text-2xl font-black">Rs {selectedItemsValue}</p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white/90 font-bold uppercase text-[10px] tracking-widest">Broadcast Price (Rs)</Label>
                        <Input 
                          type="number" 
                          placeholder="e.g. 450" 
                          value={packagePrice}
                          onChange={(e) => setPackagePrice(e.target.value)}
                          className="h-14 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-2xl font-black text-lg"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-white/90 font-bold uppercase text-[10px] tracking-widest">Featured Photo</Label>
                        <div 
                          onClick={() => fileInputRef.current?.click()} 
                          className="relative w-full aspect-video rounded-2xl border-2 border-dashed border-white/20 bg-white/10 hover:bg-white/20 transition-all cursor-pointer flex flex-col items-center justify-center overflow-hidden"
                        >
                          {imagePreview ? (
                            <>
                              <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                <span className="text-[10px] font-black text-white uppercase bg-white/20 px-3 py-1 rounded-full backdrop-blur-md">Change Photo</span>
                              </div>
                            </>
                          ) : (
                            <div className="text-center p-4">
                              <Upload className="w-8 h-8 text-white mx-auto mb-2"/>
                              <span className="text-[10px] font-bold">Upload Food Pic</span>
                            </div>
                          )}
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                      </div>
                    </div>

                    <Button 
                      onClick={handleGenerate} 
                      disabled={isGenerating}
                      className="w-full bg-white text-accent hover:bg-white/90 rounded-[1.5rem] h-16 font-black text-lg shadow-2xl"
                    >
                      {isGenerating ? <RefreshCw className="w-6 h-6 mr-3 animate-spin" /> : <Sparkles className="w-6 h-6 mr-3" />}
                      {message ? "Rewrite Message" : "Generate Description"}
                    </Button>
                  </CardContent>
                </Card>

                {message && (
                  <Card className="rounded-[2.5rem] border-none shadow-md overflow-hidden bg-white animate-in zoom-in-95 duration-300">
                    <CardContent className="p-7 space-y-6">
                      <div className="space-y-3">
                        <Label className="font-black text-lg text-accent">Marketing Copy</Label>
                        <Textarea 
                          value={message} 
                          onChange={(e) => setMessage(e.target.value)}
                          className="rounded-2xl min-h-[160px] bg-secondary/20 border-none font-bold text-sm leading-relaxed"
                        />
                      </div>
                      
                      <Button 
                        onClick={handleSend} 
                        className="w-full bg-green-600 hover:bg-green-700 text-white rounded-[1.5rem] h-16 font-black text-xl shadow-2xl shadow-green-200"
                      >
                        <Send className="w-6 h-6 mr-3" />
                        {editingPackageId ? 'Update Broadcast' : 'Push To Customers'}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {!message && (
                  <div className="p-10 border-4 border-dashed border-secondary/50 rounded-[3rem] flex flex-col items-center justify-center text-center space-y-4 bg-white/50">
                    <div className="p-5 bg-secondary rounded-full">
                      <Info className="w-10 h-10 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm font-bold text-muted-foreground max-w-[200px]">Define your package contents to create a broadcast message.</p>
                  </div>
                )}
              </div>
            </div>
          </Tabs>
        </div>
      )}
    </div>
  );
}

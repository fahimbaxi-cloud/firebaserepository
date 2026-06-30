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
  Send, 
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
  ZoomIn,
  Search,
  X
} from 'lucide-react';
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

  const sortedPackages = useMemo(() => {
    if (!packagesData) return [];
    return [...packagesData].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;
      
      const updateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const updateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return updateB - updateA;
    });
  }, [packagesData]);

  const menuQuery = useMemoFirebase(() => {
    if (!currentUser) return null;
    return collection(firestore, 'menu_items');
  }, [firestore, currentUser]);
  const { data: menuData } = useCollection<MenuItem>(menuQuery);
  const menuItems = menuData || [];

  const [dailySearchQuery, setDailySearchQuery] = useState('');
  const [monthlySearchQuery, setMonthlySearchQuery] = useState('');
  const [packageSearchQuery, setPackageSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'daily' | 'scheme'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'price-asc' | 'price-desc'>('newest');
  const [filterStartDate, setFilterStartDate] = useState<Date | undefined>(undefined);
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(undefined);
  const [isFilterStartDateOpen, setIsFilterStartDateOpen] = useState(false);
  const [isFilterEndDateOpen, setIsFilterEndDateOpen] = useState(false);

  const filteredPackages = useMemo(() => {
    let result = [...sortedPackages];

    if (typeFilter !== 'all') {
      result = result.filter(pkg => pkg.type === typeFilter);
    }

    if (packageSearchQuery.trim() !== '') {
      const q = packageSearchQuery.toLowerCase();
      result = result.filter(pkg => (pkg.name || '').toLowerCase().includes(q));
    }

    if (filterStartDate || filterEndDate) {
      result = result.filter(pkg => {
        const sStart = filterStartDate ? new Date(filterStartDate) : new Date(0);
        sStart.setHours(0, 0, 0, 0);
        const sEnd = filterEndDate ? new Date(filterEndDate) : new Date(8640000000000000);
        sEnd.setHours(23, 59, 59, 999);

        if (pkg.type === 'scheme') {
          if (!pkg.startDate || !pkg.endDate) return false;
          const pStart = new Date(pkg.startDate);
          const pEnd = new Date(pkg.endDate);
          return pStart <= sEnd && pEnd >= sStart;
        } else {
          if (!pkg.createdAt) return false;
          const createdAtDate = new Date(pkg.createdAt);
          return createdAtDate >= sStart && createdAtDate <= sEnd;
        }
      });
    }

    if (sortOrder === 'oldest') {
      result = [...result].reverse();
    } else if (sortOrder === 'price-asc') {
      result.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortOrder === 'price-desc') {
      result.sort((a, b) => (b.price || 0) - (a.price || 0));
    }

    return result;
  }, [sortedPackages, typeFilter, packageSearchQuery, sortOrder, filterStartDate, filterEndDate]);

  const sortedMenuItems = useMemo(() => {
    return [...menuItems].sort((a, b) => {
      const nameA = a.name || '';
      const nameB = b.name || '';
      return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    });
  }, [menuItems]);

  const filteredDailyMenuItems = useMemo(() => {
    return sortedMenuItems.filter(item => {
      const name = (item.name || '').toLowerCase();
      const q = dailySearchQuery.toLowerCase();
      return name.includes(q);
    });
  }, [sortedMenuItems, dailySearchQuery]);

  const filteredMonthlyMenuItems = useMemo(() => {
    return sortedMenuItems.filter(item => {
      const name = (item.name || '').toLowerCase();
      const q = monthlySearchQuery.toLowerCase();
      return name.includes(q);
    });
  }, [sortedMenuItems, monthlySearchQuery]);

  // Form State
  const [broadcastType, setBroadcastType] = useState<'daily' | 'scheme'>('daily');
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [packageName, setPackageName] = useState('');
  const [message, setMessage] = useState('');
  const [packagePrice, setPackagePrice] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Daily State
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [dailySelectedItems, setDailySelectedItems] = useState<string[]>([]);

  // Scheme State
  const [schemeStartDate, setSchemeStartDate] = useState<Date | undefined>(new Date());
  const [schemeEndDate, setSchemeEndDate] = useState<Date | undefined>(new Date());
  const [isStartPopoverOpen, setIsStartPopoverOpen] = useState(false);
  const [isEndPopoverOpen, setIsEndPopoverOpen] = useState(false);
  const [schemeAssignments, setSchemeAssignments] = useState<Record<string, string[]>>({});

  const daysInRange = useMemo(() => {
    if (!schemeStartDate || !schemeEndDate) return [];
    return eachDayOfInterval({ start: schemeStartDate, end: schemeEndDate });
  }, [schemeStartDate, schemeEndDate]);

  const selectedItemsValue = useMemo(() => {
    if (broadcastType === 'daily') {
      return (menuItems || [])
        .filter(item => dailySelectedItems.includes(item.id))
        .reduce((sum, item) => sum + item.price, 0);
    } else {
      const uniqueItemIds = Array.from(new Set(Object.values(schemeAssignments).flat()));
      return (menuItems || [])
        .filter(item => uniqueItemIds.includes(item.id))
        .reduce((sum, item) => sum + item.price, 0);
    }
  }, [broadcastType, dailySelectedItems, schemeAssignments, menuItems]);

  const handleToggleDailyItem = (itemId: string) => {
    setDailySelectedItems(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const handleToggleSchemeItem = (dateKey: string, itemId: string) => {
    setSchemeAssignments(prev => {
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

  const handleSend = () => {
    if (!packageName) {
      toast({ title: "Name Required", description: "Please enter a name for this package.", variant: "destructive" });
      return;
    }

    if (!message || !message.trim()) {
      toast({ title: "Description Required", description: "Please enter a description for this package.", variant: "destructive" });
      return;
    }

    const dateStr = broadcastType === 'daily' 
      ? format(selectedDate || new Date(), 'MMMM d, yyyy') 
      : `Scheme: ${schemeStartDate ? format(schemeStartDate, 'MMM d, yyyy') : ''} to ${schemeEndDate ? format(schemeEndDate, 'MMM d, yyyy') : ''}`;

    let finalItems: string[] = [];
    if (broadcastType === 'daily') {
      finalItems = dailySelectedItems;
    } else {
      const sortedDays = [...daysInRange].sort((a, b) => a.getTime() - b.getTime());
      sortedDays.forEach(day => {
        const key = format(day, 'yyyy-MM-dd');
        const itemsForDay = schemeAssignments[key] || [];
        if (itemsForDay.length > 0) {
          finalItems.push(...itemsForDay);
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
      updatedAt: new Date().toISOString()
    };

    if (broadcastType === 'scheme') {
      newPackageData.schemeAssignments = schemeAssignments;
    }

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
    } else if (pkg.type === 'scheme' && pkg.dateContext) {
      // For now, simple parsing might fail, so we might need a better way to store date range
      // or assume the dateContext is NOT used for parsing
      if (pkg.schemeAssignments) {
        setSchemeAssignments(pkg.schemeAssignments);
      } else if (pkg.items && pkg.items.length > 0) {
        // Fallback or just empty
        setSchemeAssignments({});
      } else {
        setSchemeAssignments({});
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
    setSchemeAssignments({});
    setMessage('');
    setPackagePrice('');
    setImagePreview(null);
    setBroadcastType('daily');
    setSelectedDate(new Date());
    setSchemeStartDate(new Date());
    setSchemeEndDate(new Date());
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
          ) : sortedPackages.length > 0 ? (
            <div className="space-y-6">
              {/* Desktop and Mobile Responsive Filters Bar */}
              <div className="flex flex-col gap-4 bg-white p-5 rounded-[2rem] shadow-sm border border-secondary/10">
                <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                  <div className="relative flex-1">
                    <Input
                      placeholder="Search broadcast by name..."
                      value={packageSearchQuery}
                      onChange={(e) => setPackageSearchQuery(e.target.value)}
                      className="h-12 bg-secondary/20 border-none rounded-2xl font-bold px-11 text-sm focus-visible:ring-1 focus-visible:ring-primary/20"
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="flex bg-secondary/30 p-1 rounded-2xl h-12 items-center flex-1 sm:flex-none">
                      <button
                        type="button"
                        onClick={() => setTypeFilter('all')}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all h-full flex-1 sm:flex-none whitespace-nowrap",
                          typeFilter === 'all' 
                            ? "bg-white text-primary shadow-sm" 
                            : "text-muted-foreground hover:text-accent"
                        )}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setTypeFilter('daily')}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all h-full flex-1 sm:flex-none whitespace-nowrap",
                          typeFilter === 'daily' 
                            ? "bg-white text-primary shadow-sm" 
                            : "text-muted-foreground hover:text-accent"
                        )}
                      >
                        Daily
                      </button>
                      <button
                        type="button"
                        onClick={() => setTypeFilter('scheme')}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all h-full flex-1 sm:flex-none whitespace-nowrap",
                          typeFilter === 'scheme' 
                            ? "bg-white text-primary shadow-sm" 
                            : "text-muted-foreground hover:text-accent"
                        )}
                      >
                        Scheme
                      </button>
                    </div>

                    <div className="w-full sm:w-[180px]">
                      <Select value={sortOrder} onValueChange={(v: any) => setSortOrder(v)}>
                        <SelectTrigger className="h-12 bg-secondary/30 border-none text-xs font-black uppercase tracking-wider rounded-2xl cursor-pointer">
                          <SelectValue placeholder="Sort order" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          <SelectItem value="newest" className="font-bold text-xs uppercase tracking-wider cursor-pointer">Newest First</SelectItem>
                          <SelectItem value="oldest" className="font-bold text-xs uppercase tracking-wider cursor-pointer">Oldest First</SelectItem>
                          <SelectItem value="price-asc" className="font-bold text-xs uppercase tracking-wider cursor-pointer">Price: Low to High</SelectItem>
                          <SelectItem value="price-desc" className="font-bold text-xs uppercase tracking-wider cursor-pointer">Price: High to Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Date range row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-3 border-t border-secondary/10">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                      <CalendarIcon className="w-4 h-4 text-primary" />
                      <span>Date Range:</span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Popover open={isFilterStartDateOpen} onOpenChange={setIsFilterStartDateOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "h-10 text-xs font-bold rounded-xl bg-secondary/20 hover:bg-secondary/30 border-none px-4 flex-1 sm:flex-initial min-w-[130px] justify-start",
                              !filterStartDate && "text-muted-foreground"
                            )}
                          >
                            {filterStartDate ? format(filterStartDate, "MMM d, yyyy") : "Start Date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-3xl border-none shadow-2xl" align="start">
                          <Calendar
                            mode="single"
                            selected={filterStartDate}
                            onSelect={(date) => {
                              setFilterStartDate(date);
                              setIsFilterStartDateOpen(false);
                            }}
                            initialFocus
                            className="rounded-3xl"
                          />
                        </PopoverContent>
                      </Popover>

                      <span className="text-muted-foreground text-xs font-bold">to</span>

                      <Popover open={isFilterEndDateOpen} onOpenChange={setIsFilterEndDateOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "h-10 text-xs font-bold rounded-xl bg-secondary/20 hover:bg-secondary/30 border-none px-4 flex-1 sm:flex-initial min-w-[130px] justify-start",
                              !filterEndDate && "text-muted-foreground"
                            )}
                          >
                            {filterEndDate ? format(filterEndDate, "MMM d, yyyy") : "End Date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-3xl border-none shadow-2xl" align="start">
                          <Calendar
                            mode="single"
                            selected={filterEndDate}
                            onSelect={(date) => {
                              setFilterEndDate(date);
                              setIsFilterEndDateOpen(false);
                            }}
                            initialFocus
                            className="rounded-3xl"
                          />
                        </PopoverContent>
                      </Popover>

                      {(filterStartDate || filterEndDate) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFilterStartDate(undefined);
                            setFilterEndDate(undefined);
                          }}
                          className="h-8 px-2 text-[10px] font-black uppercase text-destructive hover:bg-destructive/5 hover:text-destructive rounded-lg"
                        >
                          Reset Dates
                        </Button>
                      )}
                    </div>
                  </div>

                  {(packageSearchQuery || typeFilter !== 'all' || sortOrder !== 'newest' || filterStartDate || filterEndDate) && (
                    <Button 
                      type="button"
                      variant="ghost" 
                      onClick={() => {
                        setPackageSearchQuery('');
                        setTypeFilter('all');
                        setSortOrder('newest');
                        setFilterStartDate(undefined);
                        setFilterEndDate(undefined);
                      }}
                      className="h-10 px-4 text-xs font-black uppercase tracking-wider text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-xl ml-auto"
                    >
                      Clear All Filters
                    </Button>
                  )}
                </div>
              </div>

              {filteredPackages.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredPackages.map((pkg) => (
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
                      <Search className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                    <p className="text-muted-foreground font-medium">No active broadcasts matched your filters.</p>
                    <Button 
                      variant="link" 
                      onClick={() => {
                        setPackageSearchQuery('');
                        setTypeFilter('all');
                        setSortOrder('newest');
                        setFilterStartDate(undefined);
                        setFilterEndDate(undefined);
                      }} 
                      className="text-primary font-bold"
                    >
                      Clear search & filters &times;
                    </Button>
                  </div>
                </div>
              )}
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
                      <TabsTrigger value="scheme" className="rounded-xl font-bold h-full data-[state=active]:bg-white data-[state=active]:shadow-sm">Scheme</TabsTrigger>
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
                          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
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
                              <Calendar mode="single" selected={selectedDate} onSelect={(date) => {
                                setSelectedDate(date);
                                setIsDatePickerOpen(false);
                              }} initialFocus className="rounded-3xl" />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-4">
                          <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Select Menu Items</Label>
                          <div className="relative">
                            <Input 
                              placeholder="Search item..." 
                              value={dailySearchQuery}
                              onChange={(e) => setDailySearchQuery(e.target.value)}
                              className="h-12 bg-secondary/30 border-none rounded-2xl font-bold px-11"
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          </div>
                          <ScrollArea className="h-[250px] pr-4 border-2 border-secondary/50 rounded-2xl p-4 bg-secondary/10">
                            <div className="space-y-3">
                              {filteredDailyMenuItems.length > 0 ? (
                                filteredDailyMenuItems.map((item) => (
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
                                    <Checkbox checked={dailySelectedItems.includes(item.id)} className="rounded-md h-5 w-5 animate-in fade-in zoom-in-50 duration-200" />
                                    <div className="flex-1">
                                      <p className="font-bold text-sm">{item.name}</p>
                                      <p className="text-[10px] text-muted-foreground">Rs {item.price}</p>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-center py-8 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                  No items found
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                          {menuItems && (menuItems.filter(item => dailySelectedItems.includes(item.id)).length > 0) && (
                            <div className="p-4 border-2 border-primary/20 bg-primary/5 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-3 duration-200">
                              <div className="flex justify-between items-center">
                                <Label className="text-xs font-bold text-primary uppercase tracking-wider">
                                  Selected Items ({menuItems.filter(item => dailySelectedItems.includes(item.id)).length})
                                </Label>
                                <Button 
                                  variant="link" 
                                  onClick={() => setDailySelectedItems([])} 
                                  className="h-auto p-0 text-xs font-extrabold text-destructive hover:no-underline"
                                >
                                  Clear All
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto pr-1">
                                {menuItems.filter(item => dailySelectedItems.includes(item.id)).map((item) => (
                                  <div 
                                    key={item.id} 
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-primary/20 rounded-xl text-xs font-bold text-accent shadow-sm"
                                  >
                                    <span>{item.name}</span>
                                    <button 
                                      type="button"
                                      onClick={() => handleToggleDailyItem(item.id)}
                                      className="text-muted-foreground hover:text-destructive focus:outline-none transition-colors border-none bg-transparent"
                                      title="Remove item"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="scheme" className="m-0 space-y-6">
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
                          <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Start Date</Label>
                          <Popover open={isStartPopoverOpen} onOpenChange={setIsStartPopoverOpen}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full h-14 justify-start text-left font-bold rounded-2xl bg-secondary/30 border-none px-6">
                                <CalendarIcon className="mr-3 h-5 w-5 text-primary" />
                                {schemeStartDate ? format(schemeStartDate, "PPP") : <span>Pick date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 rounded-3xl border-none shadow-2xl" align="start">
                              <Calendar mode="single" selected={schemeStartDate} onSelect={(date) => { setSchemeStartDate(date); setIsStartPopoverOpen(false); }} initialFocus className="rounded-3xl" />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="flex-1 space-y-2">
                          <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">End Date</Label>
                          <Popover open={isEndPopoverOpen} onOpenChange={setIsEndPopoverOpen}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full h-14 justify-start text-left font-bold rounded-2xl bg-secondary/30 border-none px-6">
                                <CalendarIcon className="mr-3 h-5 w-5 text-primary" />
                                {schemeEndDate ? format(schemeEndDate, "PPP") : <span>Pick date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 rounded-3xl border-none shadow-2xl" align="start">
                              <Calendar mode="single" selected={schemeEndDate} onSelect={(date) => { setSchemeEndDate(date); setIsEndPopoverOpen(false); }} initialFocus className="rounded-3xl" />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Assign Items to Calendar</Label>
                        <ScrollArea className="h-[400px] pr-4 border-2 border-secondary/50 rounded-2xl bg-secondary/10 overflow-hidden">
                          <div className="divide-y divide-secondary/30">
                            {daysInRange.map((day) => {
                              const dateKey = format(day, 'yyyy-MM-dd');
                              const assignments = schemeAssignments[dateKey] || [];
                              return (
                                <div key={dateKey} className="p-4 flex items-center justify-between hover:bg-white/50 transition-colors">
                                  <div className="flex items-center gap-4">
                                    <div className="text-center bg-white rounded-2xl p-2 min-w-[65px] shadow-sm border border-secondary/50">
                                      <p className="text-[10px] font-black text-primary uppercase">{format(day, 'EEE')}</p>
                                      <p className="text-xl font-black leading-none">{format(day, 'dd')}</p>
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
                                        <p className="text-[10px] font-black uppercase text-accent">{format(day, 'PPPP')}</p>
                                      </div>
                                      <div className="p-2 border-b bg-white relative">
                                        <Input 
                                          placeholder="Search item..." 
                                          value={monthlySearchQuery}
                                          onChange={(e) => setMonthlySearchQuery(e.target.value)}
                                          className="h-10 bg-secondary/20 border-none rounded-xl font-bold pl-9 pr-4 text-xs focus-visible:ring-0 placeholder:text-muted-foreground/60"
                                        />
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                      </div>
                                      <ScrollArea className="h-64 p-2">
                                        <div className="space-y-1">
                                          {filteredMonthlyMenuItems.length > 0 ? (
                                            filteredMonthlyMenuItems.map((item) => (
                                              <div 
                                                key={item.id}
                                                className={cn(
                                                  "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors",
                                                  assignments.includes(item.id) ? "bg-primary/5" : "hover:bg-secondary/50"
                                                )}
                                                onClick={() => handleToggleSchemeItem(dateKey, item.id)}
                                              >
                                                <Checkbox checked={assignments.includes(item.id)} className="rounded-md h-5 w-5 animate-in fade-in zoom-in-50 duration-200" />
                                                <div className="flex-1">
                                                  <p className="text-xs font-black">{item.name}</p>
                                                  <p className="text-[10px] text-muted-foreground">Rs {item.price}</p>
                                                </div>
                                              </div>
                                            ))
                                          ) : (
                                            <div className="text-center py-8 text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                                              No items found
                                            </div>
                                          )}
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
                        <Megaphone className="w-6 h-6 text-white/90" />
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
                  </CardContent>
                </Card>

                <Card className="rounded-[2.5rem] border-none shadow-md overflow-hidden bg-white">
                  <CardContent className="p-7 space-y-6">
                    <div className="space-y-3">
                      <Label className="font-black text-lg text-accent">Broadcast Description</Label>
                      <Textarea 
                        value={message} 
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="e.g. Treat your tastebuds with our hand-picked healthy items of the day!"
                        className="rounded-2xl min-h-[160px] bg-secondary/20 border-none font-bold text-sm leading-relaxed text-accent"
                      />
                    </div>
                    
                    <Button 
                      onClick={handleSend} 
                      className="w-full bg-green-600 hover:bg-green-700 text-white rounded-[1.5rem] h-16 font-black text-xl shadow-2xl shadow-green-200 cursor-pointer"
                    >
                      <Send className="w-6 h-6 mr-3" />
                      {editingPackageId ? 'Update Broadcast' : 'Push To Customers'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </Tabs>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from 'react';
import { BroadcastPackage, MenuItem } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogHeader, DialogDescription } from '@/components/ui/dialog';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { 
  Plus, 
  ShoppingCart, 
  Calendar, 
  Info, 
  CheckCircle2, 
  ZoomIn, 
  ChevronDown, 
  ChevronUp, 
  UtensilsCrossed 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';

interface PackageGridProps {
  packages: BroadcastPackage[];
  onOrder: (pkg: BroadcastPackage) => void;
  orderedIds?: string[];
  pastIds?: string[];
  menuItems: MenuItem[];
}

export function PackageGrid({ packages, onOrder, orderedIds = [], pastIds = [], menuItems }: PackageGridProps) {
  // Track open state for monthly days to toggle icons
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});

  const toggleDay = (key: string) => {
    setOpenDays(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {packages.map((pkg) => {
        const isOrdered = orderedIds.includes(pkg.id);
        const isPast = pastIds.includes(pkg.id);
        const isDisabled = isOrdered || isPast;

        let buttonText = pkg.type === 'daily' ? 'Order Today' : 'Get Subscribed';
        if (isOrdered) buttonText = 'Already Ordered';
        if (isPast) buttonText = 'Order Closed';

        return (
          <Card key={pkg.id} className={cn(
            "overflow-hidden group hover:shadow-xl transition-all border-none shadow-md bg-white rounded-[2.5rem]",
            pkg.type === 'monthly' ? "ring-2 ring-accent/20" : "ring-2 ring-primary/20",
            isDisabled && "opacity-80 grayscale-[0.2]"
          )}>
            <div className="relative">
              <div className="relative h-48 w-full overflow-hidden">
                {pkg.imageUrl ? (
                  <>
                    <Image 
                      src={pkg.imageUrl} 
                      alt={pkg.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                      data-ai-hint="kid friendly food"
                    />
                    <Dialog>
                      <DialogTrigger asChild>
                        <button className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-md p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-white text-primary">
                          <ZoomIn className="w-5 h-5" />
                        </button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-none">
                        <DialogHeader className="sr-only">
                          <DialogTitle>{pkg.name}</DialogTitle>
                          <DialogDescription>Full view of the package image</DialogDescription>
                        </DialogHeader>
                        <div className="relative w-full aspect-video rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl">
                          <Image 
                            src={pkg.imageUrl} 
                            alt={pkg.name}
                            fill
                            className="object-cover"
                            data-ai-hint="healthy meal zoom"
                          />
                        </div>
                      </DialogContent>
                    </Dialog>
                  </>
                ) : (
                  <div className="w-full h-full bg-secondary/30 flex items-center justify-center">
                    <Info className="w-10 h-10 text-muted-foreground/20" />
                  </div>
                )}
              </div>
              
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                <Badge variant="secondary" className={cn(
                  "rounded-lg px-3 py-1 font-bold uppercase text-[10px] shadow-sm backdrop-blur-md",
                  pkg.type === 'daily' ? "bg-primary/90 text-white" : "bg-accent/90 text-white"
                )}>
                  {pkg.type === 'daily' ? 'Daily Special' : 'Monthly Plan'}
                </Badge>
              </div>
            </div>

            <CardHeader className={cn(
              "p-8 pb-4",
              pkg.type === 'daily' ? "bg-primary/5" : "bg-accent/5"
            )}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold">{pkg.dateContext}</span>
                </div>
              </div>
              <CardTitle className="text-2xl font-bold leading-tight text-accent">{pkg.name}</CardTitle>
              <p className="text-muted-foreground font-medium text-sm mt-2 italic">"{pkg.message}"</p>
            </CardHeader>
            <CardContent className="p-8 pt-4 space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Info className="w-3.5 h-3.5" />
                  {pkg.type === 'monthly' ? "Subscription Roadmap" : "What's Inside"}
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {pkg.type === 'monthly' ? (
                    (() => {
                      const itemsToRender = (() => {
                        if (pkg.monthlyAssignments && Object.keys(pkg.monthlyAssignments).length > 0) {
                          const sortedDates = Object.keys(pkg.monthlyAssignments)
                            .filter(dateStr => {
                              const itemIds = pkg.monthlyAssignments?.[dateStr] || [];
                              return itemIds.length > 0;
                            })
                            .sort();
                          return sortedDates.map((dateStr, idx) => {
                            const itemIds = pkg.monthlyAssignments?.[dateStr] || [];
                            const item = menuItems.find(m => m.id === itemIds[0]);
                            return {
                              item,
                              label: format(parseISO(dateStr), 'EEEE, MMM dd, yyyy'),
                              dayNumber: parseISO(dateStr).getDate()
                            };
                          }).filter(x => x.item && x.item.show !== false);
                        } else {
                          return (pkg.items || []).map((itemId, idx) => {
                            const item = menuItems.find(m => m.id === itemId);
                            return {
                              item,
                              label: `Day ${idx + 1} Package`,
                              dayNumber: idx + 1
                            };
                          }).filter(x => x.item && x.item.show !== false);
                        }
                      })();

                      return itemsToRender.map(({ item, label, dayNumber }) => {
                        const dayKey = `${pkg.id}-day-${dayNumber}`;
                        const isOpen = !!openDays[dayKey];

                        return (
                          <Collapsible 
                            key={dayKey} 
                            open={isOpen} 
                            onOpenChange={() => toggleDay(dayKey)}
                            className="w-full"
                          >
                            <div className={cn(
                              "flex items-center justify-between p-3 rounded-2xl border transition-all",
                              isOpen ? "bg-white border-primary/30 shadow-sm" : "bg-secondary/20 border-secondary/30"
                            )}>
                              <div className="flex items-center gap-3">
                                <div className="bg-primary text-white font-black text-[10px] w-8 h-8 flex items-center justify-center rounded-lg shadow-sm">
                                  D{dayNumber}
                                </div>
                                <div>
                                  <p className="text-xs font-black">{label}</p>
                                  <p className="text-[10px] text-muted-foreground font-bold">{item?.name || "Surprise Meal"}</p>
                                </div>
                              </div>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0 hover:bg-primary/10 hover:text-primary">
                                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                            <CollapsibleContent className="animate-in slide-in-from-top-2 duration-300">
                              <div className="mx-4 p-4 bg-primary/5 rounded-b-2xl border-x border-b border-primary/10 space-y-3">
                                <div className="flex gap-3">
                                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-primary/20">
                                    <img src={item?.imageUrl} className="w-full h-full object-cover" alt="" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs font-black text-accent">{item?.name}</p>
                                      <Badge variant="outline" className="text-[8px] h-4 border-primary/30 text-primary font-black uppercase">{item?.type}</Badge>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed italic">
                                      {item?.description}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 pt-2 border-t border-primary/10">
                                  <UtensilsCrossed className="w-3 h-3 text-primary/60" />
                                  <span className="text-[9px] font-black uppercase text-primary/60 tracking-wider">Nutri-Balanced Meal Set</span>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      });
                    })()
                  ) : (
                    pkg.items?.map(itemId => {
                      const item = menuItems.find(m => m.id === itemId);
                      if (item && item.show === false) return null;
                      return (
                        <div key={itemId} className="flex items-center gap-2 bg-secondary/20 p-2.5 rounded-2xl border border-secondary/30">
                          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                            <img src={item?.imageUrl} className="object-cover w-full h-full" alt="" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold">{item?.name}</p>
                            <p className="text-[10px] text-muted-foreground">{item?.type}</p>
                          </div>
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-accent/5 rounded-2xl border border-accent/10">
                <div>
                  <p className="text-[10px] font-black uppercase text-accent/60">Special Price</p>
                  <p className="text-2xl font-black text-accent">{pkg.price}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Value Pack</p>
                  <p className="text-xs font-bold text-muted-foreground">{pkg.itemsCount} Total Dishes</p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-8 pt-0 flex gap-4">
              <Button 
                onClick={() => onOrder(pkg)} 
                disabled={isDisabled}
                className={cn(
                  "flex-1 rounded-[1.25rem] h-14 font-bold text-lg shadow-lg transition-all active:scale-95",
                  pkg.type === 'daily' 
                    ? "bg-primary hover:bg-primary/90 shadow-primary/20" 
                    : "bg-accent hover:bg-accent/90 shadow-accent/20",
                  isDisabled && "bg-muted text-muted-foreground shadow-none hover:bg-muted"
                )}
              >
                {!isDisabled && (pkg.type === 'daily' ? <Plus className="w-5 h-5 mr-2" /> : <ShoppingCart className="w-5 h-5 mr-2" />)}
                <div className="flex flex-col items-center justify-center">
                  <span className="leading-tight">{buttonText}</span>
                  {isPast && <span className="text-[10px] font-black text-red-500 mt-0.5 uppercase tracking-wide">(Contact Admin)</span>}
                </div>
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

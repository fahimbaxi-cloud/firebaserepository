
"use client";

import { useState } from 'react';
import { MenuItem, TimeSlot } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, ShoppingCart, Leaf, Flame, ZoomIn } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface MenuGridProps {
  items: MenuItem[];
  onOrder: (item: MenuItem) => void;
}

export function MenuGrid({ items, onOrder }: MenuGridProps) {
  const [activeSlot, setActiveSlot] = useState<TimeSlot | 'All'>('Morning');

  const filteredItems = items.filter(item => 
    activeSlot === 'All' ? true : item.slot === activeSlot
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold font-headline text-foreground">Today's Delicious Menu</h2>
        <Tabs value={activeSlot} onValueChange={(val) => setActiveSlot(val as any)}>
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="Morning">Morning</TabsTrigger>
            <TabsTrigger value="Noon">Noon</TabsTrigger>
            <TabsTrigger value="All">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => (
          <Card key={item.id} className="overflow-hidden group hover:shadow-xl transition-all border-none shadow-md bg-white rounded-[2.5rem]">
            <div className="relative h-48 w-full overflow-hidden group/image">
              <Image 
                src={item.imageUrl} 
                alt={item.name}
                fill
                className="object-cover transition-transform duration-500 group-hover/image:scale-110"
                data-ai-hint="kid-friendly food"
              />
              <Dialog>
                <DialogTrigger asChild>
                  <button className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity">
                    <ZoomIn className="w-8 h-8 text-white" />
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-none">
                  <DialogHeader className="sr-only">
                    <DialogTitle>{item.name}</DialogTitle>
                    <DialogDescription>Full view of {item.name}</DialogDescription>
                  </DialogHeader>
                  <div className="relative w-full aspect-video rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl">
                    <Image 
                      src={item.imageUrl} 
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                </DialogContent>
              </Dialog>
              <div className="absolute top-4 right-4 flex gap-2">
                <Badge className={cn(
                  item.type === 'Veg' ? "bg-green-500" : "bg-red-500",
                  "text-white border-none shadow-sm flex items-center gap-1"
                )}>
                  {item.type === 'Veg' ? <Leaf className="w-3 h-3" /> : <Flame className="w-3 h-3" />}
                  {item.type}
                </Badge>
              </div>
            </div>
            <CardHeader className="p-6 pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl font-bold leading-tight">{item.name}</CardTitle>
                <span className="text-primary font-black text-2xl">{item.price}</span>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <p className="text-sm text-muted-foreground line-clamp-2 italic font-medium">
                {item.description}
              </p>
            </CardContent>
            <CardFooter className="p-6 pt-2 border-t border-border/50 flex gap-2">
              <Button 
                onClick={() => onOrder(item)} 
                className="flex-1 bg-primary hover:bg-primary/90 rounded-2xl h-12 font-bold"
              >
                <Plus className="w-4 h-4 mr-2" />
                Select
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

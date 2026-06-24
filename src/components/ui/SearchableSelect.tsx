'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  id: string;
  name: string;
  label?: React.ReactNode; // Optional custom display node
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  triggerClassName?: string;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select item...",
  searchPlaceholder = "Search...",
  className,
  triggerClassName,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(() => {
    return options.find(opt => opt.id === value);
  }, [options, value]);

  // Filter & sort options in alphabetical ascending order by name
  const sortedAndFiltered = useMemo(() => {
    return [...options]
      .filter(opt => {
        const textToSearch = (opt.name || '').toLowerCase();
        const searchLower = search.toLowerCase();
        return textToSearch.includes(searchLower);
      })
      .sort((a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
      });
  }, [options, search]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full h-11 rounded-xl bg-white border border-secondary/50 text-xs justify-between font-semibold text-foreground px-3 flex items-center hover:bg-secondary/10 transition-colors shadow-sm",
          triggerClassName
        )}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground ml-2 shrink-0 opacity-60" />
      </Button>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 p-2 rounded-2xl shadow-xl border border-secondary/30 bg-white min-w-[200px] animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground opacity-60" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              autoFocus
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 h-9 text-xs rounded-xl border border-secondary/30 bg-secondary/5 focus-visible:ring-primary/20"
            />
          </div>
          <ScrollArea className="h-[200px] pr-1">
            {sortedAndFiltered.length > 0 ? (
              <div className="space-y-0.5">
                {sortedAndFiltered.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onChange(opt.id);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition-colors truncate flex items-center justify-between",
                      opt.id === value
                        ? "bg-primary text-white"
                        : "hover:bg-primary/10 text-foreground"
                    )}
                  >
                    <span className="truncate">{opt.label || opt.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-center text-[10px] text-muted-foreground py-6 font-bold uppercase tracking-wider">
                No items found
              </p>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

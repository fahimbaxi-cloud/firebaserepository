"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from './button';
import { Input } from './input';
import { ScrollArea } from './scroll-area';
import { Search, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchableSelectProps<T> {
  value?: string;
  onChange: (value: string) => void;
  options: T[];
  getOptionLabel: (option: T) => string;
  getOptionValue: (option: T) => string;
  placeholder?: string;
  searchPlaceholder?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

export function SearchableSelect<T>({
  value,
  onChange,
  options,
  getOptionLabel,
  getOptionValue,
  placeholder = "Select options...",
  searchPlaceholder = "Search...",
  triggerClassName,
  disabled = false,
}: SearchableSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(() => {
    return options.find(opt => getOptionValue(opt) === value);
  }, [options, value, getOptionValue]);

  // Force ascending alphabetical order by computed label
  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => {
      const labelA = getOptionLabel(a) || '';
      const labelB = getOptionLabel(b) || '';
      return labelA.localeCompare(labelB, undefined, { sensitivity: 'base', numeric: true });
    });
  }, [options, getOptionLabel]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return sortedOptions;
    const query = search.toLowerCase();
    return sortedOptions.filter(opt => {
      const label = (getOptionLabel(opt) || '').toLowerCase();
      return label.includes(query);
    });
  }, [sortedOptions, search, getOptionLabel]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full h-11 rounded-xl bg-white border border-secondary/30 text-xs text-left justify-between font-medium text-foreground px-4 flex items-center shadow-sm hover:bg-secondary/10",
          triggerClassName
        )}
      >
        <span className="truncate">
          {selectedOption ? getOptionLabel(selectedOption) : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground opacity-70 shrink-0" />
      </Button>
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 p-2 rounded-2xl shadow-xl border border-secondary/30 bg-white min-w-[220px]">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              autoFocus
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 h-10 text-xs rounded-xl border border-secondary/30 bg-secondary/5 focus-visible:ring-primary/20"
            />
          </div>
          <ScrollArea className="max-h-[220px] pr-1">
            {filteredOptions.length > 0 ? (
              <div className="space-y-0.5">
                {filteredOptions.map((opt, idx) => {
                  const optVal = getOptionValue(opt);
                  const isSelected = optVal === value;
                  return (
                    <div
                      key={optVal || idx}
                      onClick={() => {
                        onChange(optVal);
                        setOpen(false);
                        setSearch("");
                      }}
                      className={cn(
                        "w-full px-3 py-2.5 text-xs font-bold rounded-xl cursor-pointer transition-colors text-left flex items-center justify-between",
                        isSelected 
                          ? "bg-primary text-white" 
                          : "text-foreground hover:bg-secondary/40"
                      )}
                    >
                      <span className="truncate">{getOptionLabel(opt)}</span>
                      {isSelected && <span className="text-[10px] uppercase font-black tracking-wider ml-2">Selected</span>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                No items match search
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

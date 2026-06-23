"use client";

import * as React from "react";
import { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface SearchableSelectorOption {
  value: string;
  label: string;
  group?: string;
}

interface SearchableSelectorProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectorOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  triggerClassName?: string;
}

export function SearchableSelector({
  value,
  onChange,
  options,
  placeholder = "Select option",
  searchPlaceholder = "Search...",
  className,
  triggerClassName,
}: SearchableSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Sort options in ascending order alphabetically by label
  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) =>
      (a.label || "").localeCompare(b.label || "", undefined, {
        sensitivity: "base",
        numeric: true,
      })
    );
  }, [options]);

  // 2. Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return sortedOptions;
    const query = search.toLowerCase();
    return sortedOptions.filter((opt) =>
      (opt.label || "").toLowerCase().includes(query) ||
      (opt.group || "").toLowerCase().includes(query)
    );
  }, [sortedOptions, search]);

  const selectedOption = sortedOptions.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
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
          "w-full h-11 rounded-xl bg-white border border-secondary/20 shadow-sm text-xs justify-between font-normal text-foreground px-3 flex items-center hover:bg-secondary/10",
          triggerClassName
        )}
      >
        <span className="truncate pr-2 text-left block w-full">
          {selectedOption ? (
            selectedOption.group ? (
              <span className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-black">
                  [{selectedOption.group}]
                </span>
                {selectedOption.label}
              </span>
            ) : (
              selectedOption.label
            )
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
      </Button>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 p-2 rounded-2xl shadow-xl border border-secondary/35 bg-white min-w-[200px] max-h-[300px] flex flex-col">
          <div className="relative mb-2 shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              autoFocus
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 h-8 text-xs rounded-lg border border-secondary/30 bg-secondary/5 focus-visible:ring-primary/20"
            />
          </div>
          <ScrollArea className="flex-1 min-h-0 pr-1 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              <div className="space-y-0.5">
                {filteredOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition-colors truncate block",
                      opt.value === value
                        ? "bg-primary text-white"
                        : "hover:bg-primary/10 text-foreground"
                    )}
                  >
                    {opt.group && (
                      <span className="text-[10px] opacity-75 mr-1 font-black">
                        [{opt.group}]
                      </span>
                    )}
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-center text-[10px] text-muted-foreground py-4 font-bold uppercase">
                No matches found
              </p>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

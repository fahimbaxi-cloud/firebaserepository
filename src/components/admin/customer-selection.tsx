"use client";

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, CheckCircle2, Search, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CustomerSelection({ users, selectedUser, onSelect, search, setSearch }: {
  users: any[],
  selectedUser: any,
  onSelect: (user: any) => void,
  search: string,
  setSearch: (s: string) => void
}) {
  const filtered = users.filter(u => 
    u.firstName.toLowerCase().includes(search.toLowerCase()) ||
    u.lastName.toLowerCase().includes(search.toLowerCase()) ||
    u.bacchabiteId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="rounded-[2rem] border-none shadow-sm overflow-hidden bg-white">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <UserIcon className="w-5 h-5 text-primary" />
          Customer Assignment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name or ID..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="pl-11 h-12 rounded-2xl bg-secondary/20 border-none font-bold" 
          />
        </div>
        <ScrollArea className="h-40 border-2 border-secondary/30 rounded-2xl bg-secondary/5">
          <div className="p-2 space-y-1">
            {filtered.map((user) => (
              <div 
                key={user.id} 
                onClick={() => onSelect(user)} 
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all",
                  selectedUser?.id === user.id ? "bg-primary text-white shadow-lg" : "hover:bg-primary/5"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs", selectedUser?.id === user.id ? "bg-white/20" : "bg-secondary text-primary")}>
                    {user.firstName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{user.firstName} {user.lastName}</p>
                    <p className={cn("text-[10px]", selectedUser?.id === user.id ? "text-white/70" : "text-muted-foreground")}>ID: {user.bacchabiteId}</p>
                  </div>
                </div>
                {selectedUser?.id === user.id && <CheckCircle2 className="w-4 h-4 text-white" />}
              </div>
            ))}
          </div>
        </ScrollArea>
        {selectedUser && (
          <div className="p-4 bg-green-50 border-2 border-green-100 rounded-2xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <p className="text-sm font-black text-green-800">{selectedUser.firstName} {selectedUser.lastName} Selected</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

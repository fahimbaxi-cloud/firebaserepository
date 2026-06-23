
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelector } from '@/components/ui/searchable-selector';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { User, UserRole } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Edit, Key, ShieldCheck, User as UserIcon, Truck, Crown, Search, Filter, Hash, Plus, UserPlus, ArrowUpDown, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, getDocs, limit } from 'firebase/firestore';

export default function UserManagementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  // Firestore Data
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users = [], isLoading } = useCollection<User>(usersQuery);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [viewerRole, setViewerRole] = useState<UserRole>('admin');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: 'createdAt', direction: 'desc' });

  const roleOptions = useMemo(() => {
    const opts = [
      { value: 'customer', label: 'Customer' },
      { value: 'delivery', label: 'Delivery Partner' },
      { value: 'admin', label: 'Administrator' }
    ];
    if (viewerRole === 'super-admin') {
      opts.push({ value: 'super-admin', label: 'Super Admin' });
    }
    return opts;
  }, [viewerRole]);

  const roleFilterOptions = useMemo(() => {
    const opts = [
      { value: 'all', label: 'All Members' },
      { value: 'customer', label: 'Customers' },
      { value: 'delivery', label: 'Delivery Partners' },
      { value: 'admin', label: 'Administrators' }
    ];
    if (viewerRole === 'super-admin') {
      opts.push({ value: 'super-admin', label: 'Super Admins' });
    }
    return opts;
  }, [viewerRole]);

  // Load the viewer role from Firestore
  useEffect(() => {
    const checkViewer = async () => {
      const loggedId = localStorage.getItem('bacchabite_logged_id');
      if (loggedId) {
        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, where('bacchabiteId', '==', loggedId), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const userData = snap.docs[0].data() as User;
          setViewerRole(userData.role);
        }
      }
    };
    checkViewer();
  }, [firestore]);

  // Dialog States
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPassOpen, setIsPassOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Form States
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const [addForm, setAddForm] = useState<Partial<User>>({
    role: 'customer'
  });
  const [newPassword, setNewPassword] = useState('');

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    const data = users.filter(user => {
      // 1. Role Visibility Rule: Admins cannot see Super Admins
      if (viewerRole === 'admin' && user.role === 'super-admin') {
        return false;
      }

      const matchesSearch = `${user.firstName} ${user.lastName} ${user.bacchabiteId} ${user.email}`.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'all' ? true : user.role === roleFilter;
      
      return matchesSearch && matchesRole;
    });

    if (sortConfig.key && sortConfig.direction) {
      data.sort((a, b) => {
        const valA = (a as any)[sortConfig.key];
        const valB = (b as any)[sortConfig.key];
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [users, search, roleFilter, viewerRole, sortConfig]);

  const handleEditClick = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      mobileNumber: user.mobileNumber,
      address: user.address,
      role: user.role
    });
    setIsEditOpen(true);
  };

  const handlePasswordClick = (user: User) => {
    setSelectedUser(user);
    setNewPassword('');
    setIsPassOpen(true);
  };

  const saveEdit = () => {
    if (!selectedUser) return;
    const userRef = doc(firestore, 'users', selectedUser.id);
    updateDocumentNonBlocking(userRef, { ...editForm, updatedAt: new Date().toISOString() });
    
    toast({ title: "User Updated", description: `Details for ${selectedUser.bacchabiteId} have been saved.` });
    setIsEditOpen(false);
  };

  const saveNewUser = () => {
    if (!addForm.bacchabiteId || !addForm.firstName || !addForm.lastName || !addForm.email || !addForm.password) {
      toast({ title: "Required Fields", description: "Please fill in all mandatory fields.", variant: "destructive" });
      return;
    }

    const usersRef = collection(firestore, 'users');
    addDocumentNonBlocking(usersRef, {
      bacchabiteId: addForm.bacchabiteId,
      firstName: addForm.firstName,
      lastName: addForm.lastName,
      email: addForm.email,
      mobileNumber: addForm.mobileNumber || '',
      address: addForm.address || '',
      role: addForm.role as UserRole,
      password: addForm.password,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    toast({ title: "User Created", description: `${addForm.firstName} has been added as a ${addForm.role}.` });
    setIsAddOpen(false);
    setAddForm({ role: 'customer' });
  };

  const savePassword = () => {
    if (!selectedUser || !newPassword) return;
    const userRef = doc(firestore, 'users', selectedUser.id);
    updateDocumentNonBlocking(userRef, { password: newPassword, updatedAt: new Date().toISOString() });
    
    toast({ title: "Password Changed", description: `New password set for ${selectedUser.bacchabiteId}.` });
    setIsPassOpen(false);
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'super-admin': return <Crown className="w-3 h-3 mr-1" />;
      case 'admin': return <ShieldCheck className="w-3 h-3 mr-1" />;
      case 'delivery': return <Truck className="w-3 h-3 mr-1" />;
      default: return <UserIcon className="w-3 h-3 mr-1" />;
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'super-admin': return "bg-purple-100 text-purple-700 border-purple-200";
      case 'admin': return "bg-blue-100 text-blue-700 border-blue-200";
      case 'delivery': return "bg-orange-100 text-orange-700 border-orange-200";
      default: return "bg-green-100 text-green-700 border-green-200";
    }
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

  return (
    <div className="space-y-8">
      <header className="mb-8 space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold text-accent">User Directory</h1>
            <p className="text-muted-foreground mt-1 font-medium">Manage all platform members and their permissions from Cloud Firestore.</p>
          </div>
          <div className="flex items-center gap-3">
            {viewerRole === 'super-admin' && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-100 px-4 py-1.5 rounded-full font-bold">
                <Crown className="w-4 h-4 mr-2" />
                Super Admin Access
              </Badge>
            )}
            <Button onClick={() => setIsAddOpen(true)} className="bg-primary hover:bg-primary/90 text-white rounded-2xl h-12 px-6 font-bold shadow-lg shadow-primary/20">
              <Plus className="w-5 h-5 mr-2" />
              Add New User
            </Button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by ID, Name or Email..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-12 rounded-2xl bg-white border-none shadow-sm focus-visible:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-3 bg-white p-1 rounded-2xl shadow-sm border border-secondary/20 min-w-[240px]">
            <div className="p-2 bg-secondary/50 rounded-xl ml-1">
              <Filter className="w-4 h-4 text-muted-foreground" />
            </div>
            <SearchableSelector 
              value={roleFilter} 
              onChange={(v) => setRoleFilter(v as any)} 
              options={roleFilterOptions} 
              placeholder="All Roles" 
              searchPlaceholder="Search roles..."
              triggerClassName="border-none bg-transparent h-10 shadow-none focus:ring-0 text-left" 
            />
          </div>
        </div>
      </header>

      <Card className="rounded-[2rem] border-none shadow-sm overflow-hidden bg-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/20 hover:bg-secondary/20 border-none">
                <TableHead className="font-bold py-5 pl-8"><SortTrigger label="Member Profile" sortKey="firstName" /></TableHead>
                <TableHead className="font-bold"><SortTrigger label="BacchaBite ID" sortKey="bacchabiteId" /></TableHead>
                <TableHead className="font-bold"><SortTrigger label="Contact Info" sortKey="email" /></TableHead>
                <TableHead className="font-bold"><SortTrigger label="Role" sortKey="role" /></TableHead>
                <TableHead className="font-bold"><SortTrigger label="Joined On" sortKey="createdAt" /></TableHead>
                <TableHead className="font-bold text-right pr-8">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                    <p className="mt-2 text-sm font-bold text-muted-foreground uppercase tracking-widest">Loading Directory...</p>
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <TableRow key={user.id} className="hover:bg-secondary/5 border-b border-secondary/10 group">
                    <TableCell className="py-6 pl-8">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-primary">
                          {user.firstName[0]}{user.lastName[0]}
                        </div>
                        <div className="font-bold text-base leading-tight">
                          {user.firstName} {user.lastName}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-accent/5 rounded-lg">
                          <Hash className="w-3.5 h-3.5 text-accent" />
                        </div>
                        <span className="font-black text-sm text-accent">{user.bacchabiteId}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{user.email}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{user.mobileNumber}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "rounded-lg px-2.5 py-0.5 font-bold uppercase text-[10px] tracking-wide",
                        getRoleBadgeColor(user.role)
                      )}>
                        {getRoleIcon(user.role)}
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium">{new Date(user.createdAt).toLocaleDateString()}</div>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(user)} className="rounded-full h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/5">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handlePasswordClick(user)} className="rounded-full h-9 w-9 text-muted-foreground hover:text-accent hover:bg-accent/5">
                          <Key className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <UserIcon className="w-8 h-8 text-muted-foreground/30" />
                      <p className="text-muted-foreground font-medium">No members found matching your search.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-8 pb-0">
            <DialogTitle className="text-2xl font-headline flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-primary" />
              Add New Member
            </DialogTitle>
            <DialogDescription>Register a new user, delivery partner, or administrator.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-8 py-4">
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2 col-span-2">
                <Label className="font-bold">BacchaBite ID (Unique Login ID)</Label>
                <div className="relative">
                  <Input 
                    placeholder="e.g. BB-DELV-102" 
                    value={addForm.bacchabiteId || ''} 
                    onChange={(e) => setAddForm({ ...addForm, bacchabiteId: e.target.value })}
                    className="rounded-xl h-11 pl-10"
                  />
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input 
                  placeholder="First Name"
                  value={addForm.firstName || ''} 
                  onChange={(e) => setAddForm({ ...addForm, firstName: e.target.value })}
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input 
                  placeholder="Last Name"
                  value={addForm.lastName || ''} 
                  onChange={(e) => setAddForm({ ...addForm, lastName: e.target.value })}
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Email Address</Label>
                <Input 
                  type="email"
                  placeholder="email@example.com"
                  value={addForm.email || ''} 
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Mobile Number</Label>
                <Input 
                  placeholder="9876543210"
                  value={addForm.mobileNumber || ''} 
                  onChange={(e) => setAddForm({ ...addForm, mobileNumber: e.target.value })}
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Initial Password</Label>
                <Input 
                  type="password"
                  placeholder="••••••••"
                  value={addForm.password || ''} 
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Role Selection</Label>
                <SearchableSelector 
                  value={addForm.role || ''} 
                  onChange={(v) => setAddForm({ ...addForm, role: v as any })} 
                  options={roleOptions} 
                  placeholder="Select Role" 
                  searchPlaceholder="Search roles..."
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Primary Address</Label>
                <Textarea 
                  placeholder="Full address details..."
                  value={addForm.address || ''} 
                  onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                  className="rounded-xl min-h-[80px]"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="p-8 pt-0">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl h-12">Cancel</Button>
            <Button onClick={saveNewUser} className="bg-primary hover:bg-primary/90 rounded-xl h-12 px-8 font-bold">Register Member</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-8 pb-0">
            <DialogTitle className="text-2xl font-headline">Edit Member</DialogTitle>
            <DialogDescription>Update profile details for {selectedUser?.bacchabiteId}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-8 py-4">
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input 
                  value={editForm.firstName || ''} 
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input 
                  value={editForm.lastName || ''} 
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Email Address</Label>
                <Input 
                  type="email"
                  value={editForm.email || ''} 
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Mobile Number</Label>
                <Input 
                  value={editForm.mobileNumber || ''} 
                  onChange={(e) => setEditForm({ ...editForm, mobileNumber: e.target.value })}
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <SearchableSelector 
                  value={editForm.role || ''} 
                  onChange={(v) => setEditForm({ ...editForm, role: v as any })} 
                  options={roleOptions} 
                  placeholder="Select Role" 
                  searchPlaceholder="Search roles..."
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Delivery Address</Label>
                <Textarea 
                  value={editForm.address || ''} 
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="rounded-xl min-h-[80px]"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="p-8 pt-0">
            <Button variant="outline" onClick={() => setIsEditOpen(false)} className="rounded-xl h-12">Cancel</Button>
            <Button onClick={saveEdit} className="bg-primary hover:bg-primary/90 rounded-xl h-12 px-8 font-bold">Update Details</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={isPassOpen} onOpenChange={setIsPassOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-headline">Reset Password</DialogTitle>
            <DialogDescription>Set a new secure login password for {selectedUser?.bacchabiteId}</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <Input 
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-11 h-14 rounded-2xl border-secondary focus:border-accent"
                />
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-[10px] text-muted-foreground px-1 italic">
                Member will be required to use this new password for their next login.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPassOpen(false)} className="rounded-xl h-12">Cancel</Button>
            <Button onClick={savePassword} disabled={!newPassword} className="bg-accent hover:bg-accent/90 rounded-xl h-12 px-8 font-bold text-white shadow-lg shadow-accent/20">Set New Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

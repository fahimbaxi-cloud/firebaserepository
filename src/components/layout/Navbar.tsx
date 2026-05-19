
"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Utensils, ClipboardList, User, Bell, LogOut, Truck, Users, ShoppingCart, CreditCard, LayoutGrid, Factory, ReceiptText, BarChart3, MapPinned, Settings, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { ChatMessage } from '@/lib/types';

export function Navbar({ role }: { role: 'customer' | 'admin' | 'delivery' }) {
  const pathname = usePathname();
  const router = useRouter();
  const firestore = useFirestore();
  const [userRole, setUserRole] = React.useState<string | null>(null);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

  React.useEffect(() => {
    const checkRole = async () => {
      const loggedId = localStorage.getItem('bacchabite_logged_id');
      if (loggedId) {
        const q = query(collection(firestore, 'users'), where('bacchabiteId', '==', loggedId), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const doc = snap.docs[0];
          setUserId(doc.id);
          setUserRole(doc.data().role);
        }
      }
    };
    checkRole();
  }, [firestore]);

  // Unread messages listener for customer
  const chatsQuery = useMemoFirebase(() => {
    if (role !== 'customer' || !userId) return null;
    return collection(firestore, 'chats');
  }, [firestore, role, userId]);

  const { data: allChats } = useCollection<ChatMessage>(chatsQuery);

  React.useEffect(() => {
    if (role === 'customer' && userId && allChats) {
      const count = allChats.filter(
        m => m.customerId === userId && m.senderRole !== 'customer' && !m.read
      ).length;
      setUnreadCount(count);
    }
  }, [allChats, userId, role]);

  const navItems = {
    customer: [
      { label: 'Menu', href: '/customer', icon: Utensils },
      { label: 'Chat', href: '/customer/chat', icon: MessageSquare, badge: unreadCount > 0 ? unreadCount : undefined },
      { label: 'Orders', href: '/customer/orders', icon: ClipboardList },
      { label: 'Profile', href: '/customer/profile', icon: User },
    ],
    admin: [
      { label: 'Dashboard', href: '/admin', icon: ClipboardList },
      { label: 'Support', href: '/admin/chat', icon: MessageSquare },
      { label: 'Items', href: '/admin/menu', icon: Utensils },
      { label: 'Manufacturing', href: '/admin/manufacturing', icon: Factory },
      { label: 'Broadcast', href: '/admin/broadcast', icon: Bell },
      { label: 'Users', href: '/admin/users', icon: Users },
      { label: 'Purchases', href: '/admin/purchases', icon: ShoppingCart },
      { label: 'Payments', href: '/admin/payments', icon: CreditCard },
      { label: 'Receipts', href: '/admin/receipts', icon: ReceiptText },
      { label: 'Reports', href: '/admin/reports', icon: BarChart3 },
      { label: 'Master', href: '/admin/master', icon: LayoutGrid },
      ...(userRole === 'super-admin' ? [{ label: 'Settings', href: '/admin/settings', icon: Settings }] : []),
    ],
    delivery: [
      { label: 'Deliveries', href: '/delivery', icon: Truck },
      { label: 'Reports', href: '/delivery/reports', icon: BarChart3 },
      { label: 'Route Order', href: '/delivery/addresses', icon: MapPinned },
      { label: 'Profile', href: '/delivery/profile', icon: User },
    ]
  };

  const items = navItems[role] || [];

  const handleLogout = () => {
    localStorage.removeItem('bacchabite_logged_id');
    router.replace('/');
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border md:top-0 md:bottom-auto md:border-b md:border-t-0 shadow-sm print:hidden">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="relative w-10 h-10 shrink-0 overflow-hidden rounded-full border-2 border-primary/20 shadow-md bg-white">
            <Image 
              src={logo?.imageUrl || "/logo.png"}
              alt="BacchaBite Logo"
              fill
              className="object-contain p-1"
              data-ai-hint="food logo"
            />
          </div>
          <span className="font-headline font-bold text-xl text-primary hidden lg:inline-block">BacchaBite</span>
        </Link>

        <div className="flex flex-1 justify-center md:justify-end gap-1 md:gap-2 overflow-x-auto no-scrollbar">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex flex-col md:flex-row items-center gap-1 md:gap-2 px-3 py-1 rounded-lg transition-colors whitespace-nowrap relative",
                  isActive ? "text-primary bg-secondary/50" : "text-muted-foreground hover:text-primary hover:bg-secondary/30"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] md:text-xs font-bold">{item.label}</span>
                {item.badge !== undefined && (
                  <Badge className="absolute -top-1 -right-1 md:top-0 md:right-1 bg-accent text-white border-none rounded-full h-4 min-w-[16px] flex items-center justify-center text-[8px] font-black px-1 scale-90">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center ml-2 md:ml-4 border-l pl-2 md:pl-4 border-border/50">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            className="text-muted-foreground hover:text-primary h-9 px-2 md:px-3"
          >
            <LogOut className="w-4 h-4 md:mr-2" />
            <span className="hidden sm:inline text-xs md:text-sm font-bold">Logout</span>
          </Button>
        </div>
      </div>
    </nav>
  );
}

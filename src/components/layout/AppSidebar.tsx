"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  Utensils,
  Factory,
  Bell,
  Users,
  ShoppingCart,
  CreditCard,
  ReceiptText,
  BarChart3,
  LogOut,
  Wallet,
  BookText,
  Settings,
  MessageSquare,
  ChevronRight,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs, limit, doc } from "firebase/firestore";
import { AppConfig, User } from "@/lib/types";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutGrid },
  { title: "Chat Board", url: "/admin/chat", icon: MessageSquare },
  { title: "Item", url: "/admin/menu", icon: Utensils },
  { title: "Broadcast", url: "/admin/broadcast", icon: Bell },
  { title: "Manufacturing", url: "/admin/manufacturing", icon: Factory },
  { title: "Purchases", url: "/admin/purchases", icon: ShoppingCart },
  { title: "Supplier Payment", url: "/admin/payments", icon: CreditCard },
  { title: "Receipts", url: "/admin/receipts", icon: ReceiptText },
  { title: "Income and Expense", url: "/admin/cashbook", icon: Wallet },
  { title: "Journal Voucher", url: "/admin/journal", icon: BookText },
  { 
    title: "Reports", 
    url: "/admin/reports", 
    icon: BarChart3,
    items: [
      { title: "Accounting", url: "/admin/reports/accounting" },
      { title: "Inventory", url: "/admin/reports/inventory" },
      { title: "Lists", url: "/admin/reports/lists" },
      { title: "Final Accounts", url: "/admin/reports/final-accounts" },
    ]
  },
  { title: "Master Data", url: "/admin/master", icon: LayoutGrid },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Settings", url: "/admin/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const firestore = useFirestore();
  const { setOpenMobile, isMobile } = useSidebar();
  const [role, setRole] = React.useState<string | null>(null);
  
  // Dynamic Logo from Config
  const configRef = useMemoFirebase(() => doc(firestore, 'settings', 'branding'), [firestore]);
  const { data: config } = useDoc<AppConfig>(configRef);

  const placeholderLogo = PlaceHolderImages.find(img => img.id === 'app-logo');
  const appLogo = config?.appIconUrl || placeholderLogo?.imageUrl || "/logo.png";

  React.useEffect(() => {
    const checkRole = async () => {
      const loggedId = localStorage.getItem('bacchabite_logged_id');
      if (loggedId) {
        const q = query(collection(firestore, 'users'), where('bacchabiteId', '==', loggedId), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setRole(snap.docs[0].data().role);
        }
      }
    };
    checkRole();
  }, [firestore]);

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('bacchabite_logged_id');
    if (isMobile) setOpenMobile(false);
    router.replace('/');
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="h-20 flex items-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 shrink-0 overflow-hidden rounded-full border-2 border-primary shadow-lg shadow-primary/20 bg-white">
            <Image 
              src={appLogo}
              alt="BacchaBite Logo"
              fill
              className="object-contain p-1"
            />
          </div>
          <span className="font-headline font-bold text-xl text-primary group-data-[collapsible=icon]:hidden">
            BacchaBite
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[10px] font-black uppercase tracking-widest text-sidebar-foreground/50">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="px-2">
              {adminNavItems.map((item) => {
                const hasSubItems = item.items && item.items.length > 0;
                const isActive = pathname === item.url || item.items?.some(sub => pathname === sub.url);

                if (!hasSubItems) {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.url}
                        tooltip={item.title}
                        className="h-11 rounded-xl data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground transition-all font-bold text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      >
                        <Link href={item.url} onClick={handleLinkClick}>
                          <item.icon className={cn("w-5 h-5", pathname === item.url ? 'text-primary' : '')} />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                return (
                  <Collapsible key={item.title} asChild defaultOpen={isActive} className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={item.title}
                          className="h-11 rounded-xl font-bold text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        >
                          <item.icon className="w-5 h-5" />
                          <span>{item.title}</span>
                          <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items?.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton asChild isActive={pathname === subItem.url}>
                                <Link href={subItem.url} onClick={handleLinkClick}>
                                  <span className={cn("text-xs", pathname === subItem.url ? "text-primary font-black" : "font-bold")}>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2 bg-sidebar">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleLogout}
              tooltip="Logout" 
              className="h-11 rounded-xl text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors font-bold w-full"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
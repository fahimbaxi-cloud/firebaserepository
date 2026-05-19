
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Send, 
  MessageSquare, 
  Loader2, 
  User as UserIcon, 
  Search, 
  ChevronDown, 
  UserPlus, 
  ShieldCheck,
  Check,
  Users
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, getDocs, limit, doc } from 'firebase/firestore';
import { User, ChatMessage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function AdminChatDashboard() {
  const router = useRouter();
  const firestore = useFirestore();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [isComboOpen, setIsComboOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auth check
  useEffect(() => {
    const checkUser = async () => {
      const loggedId = localStorage.getItem('bacchabite_logged_id');
      if (!loggedId) {
        router.replace('/');
        return;
      }
      try {
        const q = query(collection(firestore, 'users'), where('bacchabiteId', '==', loggedId), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const userData = { ...snap.docs[0].data(), id: snap.docs[0].id } as User;
          if (userData.role === 'admin' || userData.role === 'super-admin') {
            setCurrentUser(userData);
          } else {
            router.replace('/');
          }
        } else {
          router.replace('/');
        }
      } catch (e) {
        console.error("Auth check failed", e);
      }
    };
    checkUser();
  }, [firestore, router]);

  // Fetch all messages
  const allMessagesQuery = useMemoFirebase(() => {
    if (!currentUser) return null;
    return collection(firestore, 'chats');
  }, [firestore, currentUser]);

  const { data: rawAllMessages, isLoading: messagesLoading } = useCollection<ChatMessage>(allMessagesQuery);
  const allMessages = rawAllMessages || [];

  // Fetch all users to find all customers
  const usersQuery = useMemoFirebase(() => {
    if (!currentUser) return null;
    return collection(firestore, 'users');
  }, [firestore, currentUser]);

  const { data: rawUsers, isLoading: usersLoading } = useCollection<User>(usersQuery);
  const allUsers = rawUsers || [];

  // Merge message history with the full customer list
  const conversationList = useMemo(() => {
    const customers = allUsers.filter(u => u.role === 'customer');
    const map = new Map<string, { id: string, name: string, lastText: string, lastDate: string, unreadCount: number, bacchabiteId: string }>();
    
    customers.forEach(cust => {
      map.set(cust.id, {
        id: cust.id,
        name: `${cust.firstName} ${cust.lastName}`,
        bacchabiteId: cust.bacchabiteId,
        lastText: 'No history',
        lastDate: '',
        unreadCount: 0
      });
    });

    allMessages.forEach(msg => {
      if (msg && msg.customerId) {
        const existing = map.get(msg.customerId);
        if (existing) {
          if (!existing.lastDate || new Date(msg.createdAt) > new Date(existing.lastDate)) {
            existing.lastText = msg.text;
            existing.lastDate = msg.createdAt;
          }
          if (msg.senderRole === 'customer' && !msg.read) {
            existing.unreadCount += 1;
          }
        }
      }
    });

    return Array.from(map.values())
      .filter(c => 
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
        c.bacchabiteId.toLowerCase().includes(customerSearch.toLowerCase())
      )
      .sort((a, b) => {
        if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
        if (a.lastDate && b.lastDate) return new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime();
        return a.name.localeCompare(b.name);
      });
  }, [allUsers, allMessages, customerSearch]);

  const activeMessages = useMemo(() => {
    if (!selectedCustomerId) return [];
    return allMessages
      .filter(m => m.customerId === selectedCustomerId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [allMessages, selectedCustomerId]);

  // Mark messages as read when a conversation is selected
  useEffect(() => {
    if (selectedCustomerId && allMessages.length > 0) {
      const unreadFromThisCustomer = allMessages.filter(
        m => m.customerId === selectedCustomerId && m.senderRole === 'customer' && !m.read
      );
      
      unreadFromThisCustomer.forEach(msg => {
        const ref = doc(firestore, 'chats', msg.id);
        updateDocumentNonBlocking(ref, { read: true });
      });
    }
  }, [selectedCustomerId, allMessages, firestore]);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeMessages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !currentUser || !selectedCustomerId) return;

    const selectedCust = conversationList.find(c => c.id === selectedCustomerId);

    const chatRef = collection(firestore, 'chats');
    addDocumentNonBlocking(chatRef, {
      customerId: selectedCustomerId,
      customerName: selectedCust?.name || 'Customer',
      senderId: currentUser.id,
      senderName: `${currentUser.firstName} ${currentUser.lastName}`,
      senderRole: currentUser.role,
      text: inputText.trim(),
      read: true,
      createdAt: new Date().toISOString()
    });

    setInputText('');
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-secondary/10">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Opening Support Hub...</p>
      </div>
    );
  }

  const selectedConversation = conversationList.find(c => c.id === selectedCustomerId);
  const totalUnread = conversationList.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-accent">Support Dashboard</h1>
          <p className="text-muted-foreground mt-1 font-medium italic">Communicate with parents in real-time.</p>
        </div>
        
        {/* COMBOBOX SELECTOR */}
        <Popover open={isComboOpen} onOpenChange={setIsComboOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              role="combobox" 
              className={cn(
                "w-full md:w-[350px] justify-between h-14 rounded-2xl border-none bg-white shadow-md px-6 font-bold text-base",
                !selectedCustomerId && "text-muted-foreground"
              )}
            >
              {selectedConversation ? (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-[10px] text-white">
                    {selectedConversation.name[0]}
                  </div>
                  <span className="truncate">{selectedConversation.name}</span>
                </div>
              ) : "Select a Customer to Chat"}
              <ChevronDown className="ml-2 h-5 w-5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[350px] p-0 rounded-2xl shadow-2xl border-none overflow-hidden" align="end">
            <div className="p-4 bg-accent text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest">Customer Directory</span>
              </div>
              {totalUnread > 0 && (
                <Badge className="bg-white text-accent border-none text-[9px] font-black">{totalUnread} NEW</Badge>
              )}
            </div>
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by name or ID..." 
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="pl-9 h-10 rounded-xl bg-secondary/30 border-none text-sm font-bold"
                />
              </div>
            </div>
            <ScrollArea className="h-[400px]">
              <div className="p-2 space-y-1">
                {conversationList.length > 0 ? (
                  conversationList.map((conv) => (
                    <div 
                      key={conv.id}
                      onClick={() => {
                        setSelectedCustomerId(conv.id);
                        setIsComboOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all group",
                        selectedCustomerId === conv.id ? "bg-primary text-white" : "hover:bg-primary/5"
                      )}
                    >
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-sm",
                        selectedCustomerId === conv.id ? "bg-white/20" : "bg-secondary text-primary"
                      )}>
                        {conv.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <p className="font-bold text-xs truncate">{conv.name}</p>
                          {conv.unreadCount > 0 && (
                            <Badge className="bg-accent text-white border-none rounded-full h-4 min-w-[16px] px-1 text-[8px] flex items-center justify-center font-black">
                              {conv.unreadCount}
                            </Badge>
                          )}
                        </div>
                        <p className={cn(
                          "text-[9px] truncate mt-0.5",
                          selectedCustomerId === conv.id ? "text-white/70" : "text-muted-foreground font-medium"
                        )}>
                          {conv.lastText}
                        </p>
                      </div>
                      {selectedCustomerId === conv.id && <Check className="w-4 h-4 text-white" />}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 opacity-30">
                    <p className="text-xs font-bold uppercase tracking-widest">No customers found</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </header>

      {/* ACTIVE CHAT AREA */}
      <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white flex flex-col h-[800px] md:max-h-[85vh]">
        {selectedCustomerId && selectedConversation ? (
          <>
            <CardHeader className="p-6 border-b bg-accent/5 flex flex-row items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                  <UserIcon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 leading-none">{selectedConversation.name}</h3>
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Active Chat • ID: {selectedConversation.bacchabiteId}</span>
                  </div>
                </div>
              </div>
              <Badge className="bg-accent text-white border-none rounded-lg text-[10px] font-black uppercase px-4 py-1.5 hidden sm:flex">
                <ShieldCheck className="w-3.5 h-3.5 mr-2" />
                Staff Secure
              </Badge>
            </CardHeader>

            <CardContent className="flex-1 p-0 overflow-hidden relative bg-slate-50/50">
              <ScrollArea className="h-full px-8 py-8">
                <div className="space-y-6">
                  {activeMessages.length > 0 ? (
                    activeMessages.map((msg) => {
                      const isMe = msg.senderId === currentUser.id;
                      return (
                        <div 
                          key={msg.id} 
                          className={cn(
                            "flex gap-3 max-w-[85%] md:max-w-[70%]",
                            isMe ? "ml-auto flex-row-reverse" : "mr-auto"
                          )}
                        >
                          <Avatar className="w-8 h-8 shrink-0 shadow-sm border border-secondary mt-1">
                            <AvatarFallback className={cn(
                              "text-[10px] font-black text-white",
                              isMe ? "bg-accent" : "bg-primary"
                            )}>
                              {msg.senderName ? msg.senderName[0] : '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className={cn(
                            "space-y-1",
                            isMe ? "items-end text-right" : "items-start text-left"
                          )}>
                            <div className={cn(
                              "px-6 py-3.5 rounded-[1.75rem] shadow-sm",
                              isMe 
                                ? "bg-accent text-white rounded-tr-none" 
                                : "bg-white text-slate-900 rounded-tl-none border border-secondary/30"
                            )}>
                              <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                            </div>
                            <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-tighter px-2">
                              {isMe ? 'Administrator' : msg.senderName} • {format(new Date(msg.createdAt), 'hh:mm a')}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-32 text-center space-y-4 opacity-40">
                      <div className="p-8 bg-secondary rounded-[3rem]">
                        <UserPlus className="w-16 h-16 text-primary" />
                      </div>
                      <div>
                        <p className="text-xl font-black text-accent uppercase tracking-widest">Start the Talk</p>
                        <p className="text-sm font-bold text-muted-foreground mt-2">Send a message to proactively help {selectedConversation.name}.</p>
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>
            </CardContent>

            <CardFooter className="p-6 bg-white border-t shrink-0">
              <form onSubmit={handleSendMessage} className="flex w-full gap-4">
                <Input 
                  placeholder="Type a response to the parent..." 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="flex-1 h-14 rounded-2xl bg-secondary/20 border-none shadow-inner font-medium px-6 focus-visible:ring-primary/20"
                />
                <Button 
                  type="submit" 
                  disabled={!inputText.trim()}
                  className="h-14 w-14 rounded-2xl bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20 transition-all active:scale-90"
                >
                  <Send className="w-6 h-6" />
                </Button>
              </form>
            </CardFooter>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-8 bg-secondary/5">
            <div className="p-12 bg-white rounded-[4rem] shadow-xl relative animate-in zoom-in duration-700">
              <MessageSquare className="w-24 h-24 text-accent" />
              <div className="absolute -top-4 -right-4 w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white border-4 border-white shadow-lg">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>
            <div>
              <p className="text-4xl font-black text-accent uppercase tracking-widest leading-none">Conversation Hub</p>
              <p className="text-lg font-bold text-muted-foreground mt-4 max-w-sm mx-auto leading-relaxed">
                Use the <span className="text-primary">Search Box</span> at the top to pick a parent and view their chat history or start a new session.
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

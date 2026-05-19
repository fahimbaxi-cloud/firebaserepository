
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageSquare, Loader2, ShieldCheck } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, getDocs, limit, doc } from 'firebase/firestore';
import { User, ChatMessage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function CustomerChatPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [inputText, setInputText] = useState('');
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
          setCurrentUser(userData);
        } else {
          router.replace('/');
        }
      } catch (e) {
        console.error("Auth verify failed", e);
      }
    };
    checkUser();
  }, [firestore, router]);

  // Chat Data
  const chatQuery = useMemoFirebase(() => {
    if (!currentUser) return null;
    return collection(firestore, 'chats');
  }, [firestore, currentUser]);

  const { data: rawMessages } = useCollection<ChatMessage>(chatQuery);
  
  const messages = useMemo(() => {
    if (!rawMessages || !currentUser) return [];
    return rawMessages
      .filter(m => m.customerId === currentUser.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [rawMessages, currentUser]);

  // Mark messages from admins as read when viewed
  useEffect(() => {
    if (currentUser && messages.length > 0) {
      const unreadFromAdmins = messages.filter(
        m => m.senderRole !== 'customer' && !m.read
      );
      
      unreadFromAdmins.forEach(msg => {
        const ref = doc(firestore, 'chats', msg.id);
        updateDocumentNonBlocking(ref, { read: true });
      });
    }
  }, [messages, currentUser, firestore]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !currentUser) return;

    const chatRef = collection(firestore, 'chats');
    addDocumentNonBlocking(chatRef, {
      customerId: currentUser.id,
      customerName: `${currentUser.firstName} ${currentUser.lastName}`,
      senderId: currentUser.id,
      senderName: `${currentUser.firstName} ${currentUser.lastName}`,
      senderRole: 'customer',
      text: inputText.trim(),
      read: false,
      createdAt: new Date().toISOString()
    });

    setInputText('');
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-secondary/10 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Opening Chat Board...</p>
      </div>
    );
  }

  return (
    <div className="pb-24 md:pb-0 md:pt-16 min-h-screen bg-secondary/10">
      <Navbar role="customer" />
      
      <main className="max-w-4xl mx-auto px-4 py-8 min-h-[800px] flex flex-col">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-headline font-bold text-accent">Private Chat Board</h1>
            <p className="text-muted-foreground mt-1 font-medium">Direct line to BacchaBite Support.</p>
          </div>
          <Badge className="bg-primary text-white border-none px-4 py-1.5 rounded-full font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20">
            Real-time Support
          </Badge>
        </header>

        <Card className="flex-1 rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white flex flex-col min-h-[800px]">
          <CardHeader className="bg-accent/5 p-6 border-b flex flex-row items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-6 h-6 text-accent" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">BacchaBite Admins</CardTitle>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Admins Online</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 p-0 overflow-hidden relative">
            <ScrollArea className="h-full p-6">
              <div className="space-y-6">
                <div className="text-center py-8 opacity-20">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest">Conversation Started</p>
                </div>

                {messages.map((msg) => {
                  const isMe = msg.senderId === currentUser.id;
                  return (
                    <div 
                      key={msg.id} 
                      className={cn(
                        "flex gap-3 max-w-[85%]",
                        isMe ? "ml-auto flex-row-reverse" : "mr-auto"
                      )}
                    >
                      <Avatar className="w-8 h-8 shrink-0 shadow-sm border border-secondary">
                        <AvatarFallback className={cn(
                          "text-[10px] font-black text-white",
                          isMe ? "bg-primary" : "bg-accent"
                        )}>
                          {msg.senderName ? msg.senderName[0] : '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        "space-y-1.5",
                        isMe ? "items-end" : "items-start"
                      )}>
                        <div className={cn(
                          "px-4 py-3 rounded-[1.5rem] shadow-sm",
                          isMe 
                            ? "bg-primary text-white rounded-tr-none" 
                            : "bg-secondary/40 text-slate-900 rounded-tl-none"
                        )}>
                          <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                        </div>
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest px-1">
                          {format(new Date(msg.createdAt), 'hh:mm a')}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>
          </CardContent>

          <CardFooter className="p-6 pt-2 bg-secondary/5 border-t">
            <form onSubmit={handleSendMessage} className="flex w-full gap-3">
              <Input 
                placeholder="Type your question for the admins..." 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 h-14 rounded-2xl bg-white border-none shadow-sm font-medium px-6 focus-visible:ring-primary/20"
              />
              <Button 
                type="submit" 
                disabled={!inputText.trim()}
                className="h-14 w-14 rounded-2xl bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all active:scale-90"
              >
                <Send className="w-6 h-6" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}

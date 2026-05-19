
"use client";

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, ArrowLeft, Loader2, CheckCircle2, Send, MailSearch, Fingerprint } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [bacchabiteId, setBacchabiteId] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !bacchabiteId) return;

    setLoading(true);

    try {
      const usersRef = collection(firestore, 'users');
      const q = query(
        usersRef, 
        where('bacchabiteId', '==', bacchabiteId.trim()),
        where('email', '==', email.trim()), 
        limit(1)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        
        // Write to 'mail' collection with specific format for the Trigger Email extension
        const mailRef = collection(firestore, 'mail');
        addDocumentNonBlocking(mailRef, {
          to: [email.trim()],
          message: {
            subject: 'BacchaBite: Your Account Password Recovery 🔑',
            text: `Hi ${userData.firstName}, your BacchaBite login password is: ${userData.password}.`,
            html: `
              <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 24px; overflow: hidden; background-color: #ffffff; border-top: 8px solid #EB7E47;">
                <div style="background-color: #fcf5f3; padding: 40px 20px; text-align: center;">
                  <h1 style="color: #EB7E47; margin: 0; font-size: 32px; font-weight: 900;">BacchaBite</h1>
                  <p style="color: #C7264B; margin: 5px 0 0 0; font-weight: bold; letter-spacing: 1px; font-size: 12px; text-transform: uppercase;">Identity Verification</p>
                </div>
                <div style="padding: 40px 35px;">
                  <p style="font-size: 18px; margin-bottom: 24px; font-weight: bold; color: #333;">Hello ${userData.firstName},</p>
                  <p style="color: #666; line-height: 1.6;">We received a request to recover the password for your BacchaBite account associated with ID: <strong style="color: #EB7E47;">${bacchabiteId}</strong>.</p>
                  
                  <div style="background: #fff9f6; padding: 35px; border-radius: 20px; margin: 35px 0; border: 2px dashed #EB7E47; text-align: center;">
                    <p style="margin: 0; font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 2px; font-weight: 900;">Your Current Password</p>
                    <p style="margin: 15px 0 0 0; font-size: 36px; font-weight: 900; color: #EB7E47; letter-spacing: 4px;">${userData.password}</p>
                  </div>
                  
                  <p style="color: #888; font-size: 13px; font-style: italic; border-left: 4px solid #f0f0f0; padding-left: 15px;">If you did not request this, you can safely ignore this message. Your account security is our priority.</p>
                  
                  <div style="margin-top: 45px; padding-top: 25px; border-top: 1px solid #f0f0f0; text-align: center;">
                    <p style="margin: 0; font-weight: bold; color: #666;">Eat Healthy, Grow Strong!</p>
                    <p style="margin: 8px 0 0 0; color: #EB7E47; font-weight: 900; font-size: 18px;">Team BacchaBite</p>
                  </div>
                </div>
              </div>
            `
          },
          createdAt: new Date().toISOString()
        });

        setIsSuccess(true);
        toast({ title: "Email Sent!", description: "Recovery details are on the way." });
      } else {
        toast({ 
          title: "Verification Failed", 
          description: "BacchaBite ID and Email do not match our records.", 
          variant: "destructive" 
        });
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Connection Error", description: "Could not reach the recovery server.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30 flex flex-col items-center justify-center p-6 py-12">
      <div className="mb-8 text-center flex flex-col items-center">
        <Link href="/">
          <div className="relative w-24 h-24 mb-4 rounded-full overflow-hidden border-4 border-white shadow-xl bg-white cursor-pointer hover:scale-105 transition-transform">
            <Image 
              src={logo?.imageUrl || "/logo.png"}
              alt="BacchaBite Logo"
              fill
              className="object-contain p-2"
            />
          </div>
        </Link>
        <h1 className="text-3xl font-headline font-bold text-primary">Account Recovery</h1>
      </div>

      <Card className="w-full max-w-md shadow-2xl border-none rounded-[2.5rem] overflow-hidden bg-white">
        {!isSuccess ? (
          <>
            <CardHeader className="pt-10 pb-4 text-center">
              <div className="flex justify-start mb-2">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="rounded-full h-8 px-3 text-muted-foreground hover:text-primary">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Login
                  </Button>
                </Link>
              </div>
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                <MailSearch className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-3xl font-headline font-bold">Credential Help</CardTitle>
              <CardDescription className="text-muted-foreground font-medium px-4">
                Enter your details to receive your current password via email.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <form onSubmit={handleRecover} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bacchabiteId" className="font-bold text-xs uppercase tracking-widest text-muted-foreground ml-1">BacchaBite ID</Label>
                    <div className="relative">
                      <Input 
                        id="bacchabiteId" 
                        placeholder="e.g. BB-CUST-01" 
                        className="pl-11 h-14 rounded-2xl border-secondary focus:border-primary transition-all font-bold"
                        value={bacchabiteId}
                        onChange={(e) => setBacchabiteId(e.target.value)}
                        required
                      />
                      <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-bold text-xs uppercase tracking-widest text-muted-foreground ml-1">Registered Email</Label>
                    <div className="relative">
                      <Input 
                        id="email" 
                        type="email"
                        placeholder="e.g. user@example.com" 
                        className="pl-11 h-14 rounded-2xl border-secondary focus:border-primary transition-all font-bold"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-14 bg-primary hover:bg-primary/90 rounded-2xl font-bold text-lg shadow-lg shadow-primary/20 transition-all active:scale-[0.98]" 
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Verifying...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Send className="w-5 h-5" />
                      <span>Request Password</span>
                    </div>
                  )}
                </Button>
              </form>
            </CardContent>
          </>
        ) : (
          <div className="p-10 text-center space-y-6 animate-in zoom-in-95 duration-500">
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-2">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <div>
              <h3 className="text-3xl font-headline font-bold text-slate-900">Email Dispatched</h3>
              <p className="text-muted-foreground font-medium mt-3 leading-relaxed">
                Your password has been sent to:<br />
                <span className="text-primary font-black">{email}</span>
              </p>
            </div>
            
            <Link href="/" className="block pt-4">
              <Button className="w-full h-14 bg-slate-900 hover:bg-slate-800 rounded-2xl font-bold text-lg shadow-xl transition-all">
                Back to Sign In
              </Button>
            </Link>
          </div>
        )}
        <CardFooter className="bg-secondary/20 p-8 border-t border-secondary/30">
          <p className="text-[10px] text-muted-foreground text-center font-bold uppercase tracking-widest leading-relaxed mx-auto">
            BacchaBite Security Protocols Active
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

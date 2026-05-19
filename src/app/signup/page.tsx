
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Utensils, Mail, Phone, User as UserIcon, MapPin, ArrowLeft, Fingerprint, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    bacchabiteId: '',
    firstName: '',
    lastName: '',
    email: '',
    mobileNumber: '',
    address: '',
    password: ''
  });

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const usersRef = collection(firestore, 'users');
      // Check if ID is unique
      const q = query(usersRef, where('bacchabiteId', '==', formData.bacchabiteId.trim()), limit(1));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        toast({ title: "ID Taken", description: "This BacchaBite ID is already registered.", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Add user to database
      addDocumentNonBlocking(usersRef, {
        bacchabiteId: formData.bacchabiteId.trim(),
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email.trim(),
        mobileNumber: formData.mobileNumber,
        address: formData.address,
        password: formData.password,
        role: 'customer',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Trigger Welcome Email via Firestore Extension (using array for 'to' field)
      const mailRef = collection(firestore, 'mail');
      addDocumentNonBlocking(mailRef, {
        to: [formData.email.trim()],
        message: {
          subject: 'Welcome to BacchaBite! 🍎 Your Journey Starts Here',
          text: `Hi ${formData.firstName}, welcome! Your login ID is ${formData.bacchabiteId}.`,
          html: `
            <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 24px; overflow: hidden; background-color: #ffffff; border-top: 8px solid #EB7E47;">
              <div style="background-color: #fcf5f3; padding: 40px 20px; text-align: center;">
                <h1 style="color: #EB7E47; margin: 0; font-size: 32px; font-weight: 900;">BacchaBite</h1>
                <p style="color: #C7264B; margin: 5px 0 0 0; font-weight: bold; letter-spacing: 1px; font-size: 12px; text-transform: uppercase;">Welcome to the Family</p>
              </div>
              <div style="padding: 40px 35px;">
                <p style="font-size: 18px; margin-bottom: 24px; font-weight: bold; color: #333;">Hi ${formData.firstName},</p>
                <p style="color: #666; line-height: 1.6;">We're thrilled to have you join our mission of providing healthy, balanced meals for kids. Your account is now active!</p>
                
                <div style="background: #f9f9f9; padding: 25px; border-radius: 20px; margin: 35px 0; border: 1px solid #EB7E47;">
                  <p style="margin: 0 0 15px 0; font-weight: 900; color: #C7264B; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">Your Login Credentials:</p>
                  <p style="margin: 5px 0; font-size: 15px; color: #333;"><strong>BacchaBite ID:</strong> ${formData.bacchabiteId}</p>
                  <p style="margin: 5px 0; font-size: 15px; color: #333;"><strong>Account Password:</strong> ${formData.password}</p>
                </div>

                <p style="color: #666; line-height: 1.6;">Head over to your dashboard to explore tomorrow's special daily menu or book a monthly subscription!</p>
                
                <div style="margin-top: 45px; padding-top: 25px; border-top: 1px solid #f0f0f0; text-align: center;">
                  <p style="margin: 0; font-weight: bold; color: #666;">Ready for a healthy bite?</p>
                  <p style="margin: 8px 0 0 0; color: #EB7E47; font-weight: 900; font-size: 18px;">Team BacchaBite</p>
                </div>
              </div>
            </div>
          `
        },
        createdAt: new Date().toISOString()
      });

      toast({ title: "Welcome!", description: "Account created. You can now log in!" });
      router.push('/');
    } catch (error) {
      console.error(error);
      toast({ title: "Signup Failed", description: "An error occurred. Please try again.", variant: "destructive" });
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-secondary/30 flex flex-col items-center justify-center p-6 py-12">
      <div className="mb-8 text-center">
        <div className="inline-flex p-4 bg-primary rounded-3xl shadow-lg mb-4">
          <Utensils className="text-white w-10 h-10" />
        </div>
        <h1 className="text-4xl font-headline font-bold text-primary">BacchaBite</h1>
        <p className="text-muted-foreground font-medium">Healthy meals for growing stars</p>
      </div>

      <Card className="w-full max-w-lg shadow-2xl border-none rounded-[2.5rem] overflow-hidden bg-white">
        <CardHeader className="pt-10 pb-6 text-center">
          <div className="flex justify-start mb-2">
             <Link href="/">
               <Button variant="ghost" size="sm" className="rounded-full">
                 <ArrowLeft className="w-4 h-4 mr-2" />
                 Return to Login
               </Button>
             </Link>
          </div>
          <CardTitle className="text-3xl font-headline font-bold">Create Account</CardTitle>
          <CardDescription className="text-muted-foreground font-medium">
            Join the BacchaBite community today
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bacchabiteId" className="font-bold text-xs uppercase tracking-widest text-muted-foreground ml-1">Unique BacchaBite ID</Label>
              <div className="relative">
                <Input 
                  id="bacchabiteId" 
                  placeholder="Create your login ID (e.g. USER-01)" 
                  className="pl-10 h-12 rounded-xl font-bold border-secondary focus:border-primary"
                  value={formData.bacchabiteId}
                  onChange={handleChange}
                  required
                />
                <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" className="h-12 rounded-xl border-secondary" value={formData.firstName} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" className="h-12 rounded-xl border-secondary" value={formData.lastName} onChange={handleChange} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" placeholder="you@example.com" className="h-12 rounded-xl border-secondary" value={formData.email} onChange={handleChange} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobileNumber">Mobile Number</Label>
              <Input id="mobileNumber" placeholder="9876543210" className="h-12 rounded-xl border-secondary" value={formData.mobileNumber} onChange={handleChange} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Delivery Address</Label>
              <Textarea id="address" placeholder="Building, Street, Area..." className="rounded-xl min-h-[80px] border-secondary" value={formData.address} onChange={handleChange} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Login Password</Label>
              <Input id="password" type="password" placeholder="••••••••" className="h-12 rounded-xl border-secondary" value={formData.password} onChange={handleChange} required />
            </div>

            <Button type="submit" className="w-full h-14 bg-primary hover:bg-primary/90 rounded-2xl font-bold text-lg shadow-lg shadow-primary/20 transition-all mt-6" disabled={loading}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Sign Up & Get Started"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="bg-secondary/20 p-8 flex flex-col gap-4 border-t border-secondary/30 text-center">
          <p className="text-sm text-muted-foreground font-medium">Already have an account? <Link href="/"><span className="text-primary font-bold hover:underline">Sign In</span></Link></p>
        </CardFooter>
      </Card>
    </div>
  );
}

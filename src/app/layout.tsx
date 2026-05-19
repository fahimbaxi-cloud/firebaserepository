"use client";

import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { AppConfig } from "@/lib/types";
import { useEffect } from "react";

function BrandingWrapper({ children }: { children: React.ReactNode }) {
  const firestore = useFirestore();
  const configRef = useMemoFirebase(() => doc(firestore, 'settings', 'branding'), [firestore]);
  const { data: config } = useDoc<AppConfig>(configRef);

  useEffect(() => {
    // Dynamic Favicon Injection
    if (config?.faviconUrl) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = config.faviconUrl;
    }

    // Dynamic Apple Touch Icon Injection (Mobile Home Screen)
    if (config?.webAppIconUrl) {
      let touchLink: HTMLLinkElement | null = document.querySelector("link[rel='apple-touch-icon']");
      if (!touchLink) {
        touchLink = document.createElement('link');
        touchLink.rel = 'apple-touch-icon';
        document.getElementsByTagName('head')[0].appendChild(touchLink);
      }
      touchLink.href = config.webAppIconUrl;
    }
  }, [config]);

  return <>{children}</>;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#EB7E47" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <title>BacchaBite | Healthy Food for Kids</title>
        <meta name="description" content="Daily meal ordering and subscription platform for busy parents and happy kids." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </head>
      <body className="font-body antialiased bg-background text-foreground min-h-screen">
        <FirebaseClientProvider>
          <BrandingWrapper>
            {children}
            <Toaster />
          </BrandingWrapper>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}

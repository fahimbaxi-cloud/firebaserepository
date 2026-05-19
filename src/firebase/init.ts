'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Initializes Firebase with environmental awareness.
 * Connects to the appropriate database based on the active domain.
 */
export function initializeFirebase() {
  let app: FirebaseApp;
  
  if (!getApps().length) {
    try {
      app = initializeApp(firebaseConfig);
    } catch (e) {
      console.error('Firebase initialization error', e);
      app = getApp();
    }
  } else {
    app = getApp();
  }

  return getSdks(app);
}

/**
 * Returns core SDK instances with database routing logic.
 */
export function getSdks(firebaseApp: FirebaseApp) {
  let dbName = "(default)";
  
  // Guard window access for build-time (SSR) safety
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    
    // bacchabite.uafsoftware.in uses the 'baccha1' database
    if (hostname.includes("bacchabite.uafsoftware.in")) {
      dbName = "baccha1";
    }
    // Other domains (including .hosted.app) default to '(default)'
  }

  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp, dbName)
  };
}


'use client';

// Re-export core providers and hooks
export { 
  useFirebase, 
  useFirestore, 
  useAuth, 
  useFirebaseApp, 
  useMemoFirebase, 
  useUser, 
  FirebaseContext,
  FirebaseProvider
} from './provider';

export { FirebaseClientProvider } from './client-provider';
export { initializeFirebase, getSdks } from './init';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
export { setDocumentNonBlocking, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from './non-blocking-updates';
export { errorEmitter } from './error-emitter';
export { FirestorePermissionError } from './errors';

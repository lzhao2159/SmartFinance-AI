
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Firebase configuration structure
// The configuration is expected to be a JSON string in process.env.FIREBASE_CONFIG
const firebaseConfigStr = process.env.FIREBASE_CONFIG;

let auth: Auth | null = null;
let db: Firestore | null = null;
let isFirebaseAvailable = false;

if (firebaseConfigStr) {
  try {
    const firebaseConfig = JSON.parse(firebaseConfigStr);
    if (firebaseConfig.apiKey && getApps().length === 0) {
      const app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      isFirebaseAvailable = true;
      console.log('Firebase initialized successfully');
    }
  } catch (error) {
    console.warn('Failed to parse Firebase config, falling back to demo mode.', error);
  }
}

export { auth, db, isFirebaseAvailable };

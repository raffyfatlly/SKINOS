
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCdvlMe7-XMrp5kJaU2IWDnes5yOfQSOg8",
  authDomain: "skinapp-1f71a.firebaseapp.com",
  projectId: "skinapp-1f71a",
  storageBucket: "skinapp-1f71a.firebasestorage.app",
  messagingSenderId: "115659351214",
  appId: "1:115659351214:web:6d21eed5aab9bedda1393f",
  measurementId: "G-RT6VLVB6GX"
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

try {
  // Simple check: if app exists, get it; otherwise initialize it.
  if (getApps().length > 0) {
      app = getApp();
  } else {
      app = initializeApp(firebaseConfig);
  }

  if (app) {
      auth = getAuth(app);
      db = getFirestore(app);
      console.log("Firebase Initialized Successfully");
  } 
} catch (e) {
  console.error("CRITICAL: Firebase Initialization Failed", e);
}

const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
    if (!auth) {
        // If auth is missing, check console for the specific initialization error
        console.error("Auth object is undefined. App likely failed to initialize.");
        throw new Error("Firebase not configured. Please refresh the page and try again.");
    }
    try {
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
    } catch (error: any) {
        console.error("Google Sign In Error:", error);
        
        if (error.code === 'auth/operation-not-allowed') {
            throw new Error("Google Sign-In is not enabled. Go to Firebase Console > Authentication > Sign-in method.");
        }
        if (error.code === 'auth/popup-closed-by-user') {
            throw new Error("Sign-in cancelled.");
        }
        if (error.code === 'auth/unauthorized-domain') {
            throw new Error("Domain not authorized. Add this website domain to Firebase Console > Authentication > Settings.");
        }
        throw error;
    }
};

export const signOut = async () => {
    if (!auth) return;
    try {
        await firebaseSignOut(auth);
    } catch (error) {
        console.error("Sign Out Error:", error);
    }
};

export { auth, db };

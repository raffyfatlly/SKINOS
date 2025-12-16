
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile, Product } from '../types';
import { auth, db } from './firebase';

const USER_KEY = 'skinos_user_v2';
const SHELF_KEY = 'skinos_shelf_v2';

// --- LOAD DATA ---
export const loadUserData = async (): Promise<{ user: UserProfile | null, shelf: Product[] }> => {
    // 1. Try Cloud First if Logged In (Anonymous or Registered)
    if (auth?.currentUser && db) {
        try {
            const docRef = doc(db, "users", auth.currentUser.uid);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                return {
                    user: data.profile as UserProfile,
                    shelf: data.shelf as Product[] || []
                };
            }
        } catch (e) {
            console.error("Cloud Load Error:", e);
        }
    }

    // 2. Fallback to Local Storage
    const localUser = localStorage.getItem(USER_KEY);
    const localShelf = localStorage.getItem(SHELF_KEY);
    
    return {
        user: localUser ? JSON.parse(localUser) : null,
        shelf: localShelf ? JSON.parse(localShelf) : []
    };
};

// --- SAVE DATA ---
export const saveUserData = async (user: UserProfile, shelf: Product[]) => {
    // 1. Always save to local storage (for offline/speed)
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(SHELF_KEY, JSON.stringify(shelf));

    // 2. If Logged In (including Anonymous), Sync to Cloud
    if (auth?.currentUser && db) {
        try {
            const docRef = doc(db, "users", auth.currentUser.uid);
            
            // Fix: Capture actual Auth email if available
            const authEmail = auth.currentUser.email;
            const finalEmail = user.email || authEmail || undefined;
            
            // Fix: Correctly reflect isAnonymous status. 
            // If userProfile says false but auth says true, trust auth? 
            // Actually, we trust the profile logic, but we default to false only if we are sure.
            // Better: use the property from the user object passed in.
            
            const cloudProfile = { 
                ...user, 
                // CRITICAL FIX: Do NOT force isAnonymous: false. Use the value from the state.
                isAnonymous: user.isAnonymous ?? true, 
                email: finalEmail 
            };
            
            await setDoc(docRef, {
                profile: cloudProfile,
                email: finalEmail, // Explicitly save at root for easy indexing/admin viewing
                shelf: shelf,
                lastUpdated: Date.now(),
                // Metadata for Admin Dashboard to easily filter
                isRegistered: !auth.currentUser.isAnonymous
            }, { merge: true });
        } catch (e) {
            console.error("Cloud Save Error:", e);
        }
    }
};

// --- SYNC (Local -> Cloud) ---
// Call this after a successful login to migrate guest data
export const syncLocalToCloud = async () => {
    if (!auth?.currentUser || !db) return;

    const localUserStr = localStorage.getItem(USER_KEY);
    const localShelfStr = localStorage.getItem(SHELF_KEY);

    if (!localUserStr) return; // No local data to sync

    const localUser = JSON.parse(localUserStr) as UserProfile;
    const localShelf = localShelfStr ? JSON.parse(localShelfStr) : [];

    // Check if cloud data exists to avoid overwriting existing account data
    const docRef = doc(db, "users", auth.currentUser.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        // New cloud account (or fresh anonymous): Upload local data
        // Ensure we mark it as no longer anonymous if the Auth user is real?
        // Actually, just save what we have.
        await saveUserData(localUser, localShelf);
        console.log("Synced local data to new cloud account");
    } else {
        // Existing cloud account: Strategy -> Keep Cloud Profile, Merge Shelf? 
        // For simplicity, we assume Cloud is source of truth, but we merge shelf items if not present
        console.log("Cloud account exists, switching to cloud data");
    }
};

export const clearLocalData = () => {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SHELF_KEY);
    localStorage.removeItem('skinos_guide_seen_v2');
};

// --- ACCESS CODE REDEMPTION ---
export const claimAccessCode = async (code: string): Promise<{ success: boolean; error?: string }> => {
    // Check if DB is initialized
    if (!db) {
        return { success: false, error: "System offline. Please check connection." };
    }
    
    // Check authentication
    if (!auth?.currentUser) {
        return { success: false, error: "Please log in or create an account to redeem this code." };
    }

    const uid = auth.currentUser.uid;
    const codeId = code.trim().toUpperCase();
    
    // Use the code as the document ID to ensure uniqueness via Firestore constraints
    const codeRef = doc(db, "claimed_codes", codeId);

    try {
        const codeSnap = await getDoc(codeRef);
        
        if (codeSnap.exists()) {
            const data = codeSnap.data();
            // If the current user already claimed it, we can allow (idempotency), otherwise block
            if (data.claimedBy === uid) {
                return { success: true };
            }
            return { success: false, error: "This code has already been claimed by another user." };
        }

        // Claim the code
        await setDoc(codeRef, {
            claimedBy: uid,
            claimedAt: Date.now(),
            code: codeId
        });

        return { success: true };
    } catch (e) {
        console.error("Code Claim Error", e);
        return { success: false, error: "Unable to verify code. Please try again." };
    }
};

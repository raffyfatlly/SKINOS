
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile, Product } from '../types';
import { auth, db } from './firebase';

const USER_KEY = 'skinos_user_v2';
const SHELF_KEY = 'skinos_shelf_v2';

// --- LOAD DATA ---
export const loadUserData = async (): Promise<{ user: UserProfile | null, shelf: Product[] }> => {
    // 1. Try Cloud First only if Registered User (Non-Anonymous)
    // This prevents permission-denied errors for guest users.
    const user = auth?.currentUser;
    if (user && !user.isAnonymous && db) {
        try {
            const docRef = doc(db, "users", user.uid);
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

    const currentUser = auth?.currentUser;

    // 2. If Logged In (Registered), Sync to Cloud
    // Anonymous users save locally only to prevent permission errors.
    if (currentUser && !currentUser.isAnonymous && db) {
        try {
            const docRef = doc(db, "users", currentUser.uid);
            
            // Fix: Capture actual Auth email if available
            const authEmail = currentUser.email;
            const finalEmail = user.email || authEmail || undefined;
            
            const cloudProfile = { 
                ...user, 
                isAnonymous: false, 
                email: finalEmail 
            };
            
            await setDoc(docRef, {
                profile: cloudProfile,
                email: finalEmail, // Explicitly save at root for easy indexing/admin viewing
                shelf: shelf,
                lastUpdated: Date.now(),
                isRegistered: true
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
        // Since the user is now authenticated, saveUserData will sync to cloud
        await saveUserData(localUser, localShelf);
        console.log("Synced local data to new cloud account");
    } else {
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

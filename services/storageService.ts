
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile, Product } from '../types';
import { auth, db } from './firebase';
import { getVisitorId } from './analyticsService';

const USER_KEY = 'skinos_user_v2';
const SHELF_KEY = 'skinos_shelf_v2';

// --- LOAD DATA ---
export const loadUserData = async (): Promise<{ user: UserProfile | null, shelf: Product[] }> => {
    // 1. Try Cloud First if DB is connected
    if (db) {
        try {
            // Fallback: Use Auth UID if logged in, otherwise use Analytics Visitor ID
            // This ensures guests are tracked in DB even if Anonymous Auth is disabled
            const uid = auth?.currentUser?.uid || getVisitorId();
            
            const docRef = doc(db, "users", uid);
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

    // 2. Sync to Cloud
    if (db) {
        try {
            const uid = auth?.currentUser?.uid || getVisitorId();
            const docRef = doc(db, "users", uid);
            
            // Fix: Capture actual Auth email if available
            const authEmail = auth?.currentUser?.email;
            const finalEmail = user.email || authEmail || undefined;
            
            const cloudProfile = { 
                ...user, 
                // Do NOT force isAnonymous: false. Use the value from the state.
                isAnonymous: user.isAnonymous ?? true, 
                email: finalEmail 
            };
            
            // Determine registration status based on actual Auth presence
            const isRegistered = !!auth?.currentUser && !auth.currentUser.isAnonymous;

            await setDoc(docRef, {
                profile: cloudProfile,
                email: finalEmail, // Explicitly save at root for easy indexing/admin viewing
                shelf: shelf,
                lastUpdated: Date.now(),
                // Metadata for Admin Dashboard to easily filter
                isRegistered: isRegistered
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
    
    // Note: For claiming codes, we generally require a robust ID. 
    // If not authed, we use visitor ID.
    const uid = auth?.currentUser?.uid || getVisitorId();
    
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

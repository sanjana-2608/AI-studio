
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { UserProfile } from "./types";

/**
 * GOOGLE CLOUD SETUP INSTRUCTIONS:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a new project and add a "Web App".
 * 3. Replace the values below with your "firebaseConfig" object.
 */
const firebaseConfig = {
  apiKey: "AIzaSyAs-placeholder", // REPLACE THIS
  authDomain: "theory2do-app.firebaseapp.com",
  projectId: "theory2do-app",
  storageBucket: "theory2do-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

let auth: any = null;
let db: any = null;
export let isFirebaseActive = false;

try {
  // Check if user has replaced the placeholder
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "AIzaSyAs-placeholder") {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseActive = true;
    console.log("☁️ Google Cloud (Firebase) is active and connected.");
  } else {
    console.warn("⚠️ Running in Local Mode. Replace placeholders in firebase.ts to save to Google Cloud.");
  }
} catch (e) {
  console.error("Firebase connection error:", e);
  isFirebaseActive = false;
}

const LOCAL_STORAGE_KEY = 'theory2practice_progress';

export const initAuth = async (): Promise<{ uid: string } | null> => {
  if (!isFirebaseActive || !auth) {
    return { uid: 'local-user-id' };
  }
  
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try {
          const cred = await signInAnonymously(auth);
          resolve(cred.user);
        } catch (err) {
          console.warn("Cloud Auth failed, falling back to local session.");
          resolve({ uid: 'local-user-id' });
        }
      } else {
        resolve(user);
      }
    });
  });
};

export const saveUserProfile = async (userId: string, profile: UserProfile) => {
  if (isFirebaseActive && db && userId !== 'local-user-id') {
    try {
      const userRef = doc(db, "users", userId);
      await setDoc(userRef, { 
        username: profile.username,
        email: profile.email,
        languages: profile.languages,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error("Google Cloud profile sync failed:", err);
    }
  }
};

export const saveProgress = async (userId: string, theory: string) => {
  // 1. Immediate Local Save
  const localData = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
  if (!localData.includes(theory)) {
    localData.push(theory);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localData));
  }

  // 2. Cloud Sync (Google Cloud Firestore)
  if (isFirebaseActive && db && userId !== 'local-user-id') {
    try {
      const userRef = doc(db, "users", userId);
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) {
        await setDoc(userRef, { 
          completedConcepts: [theory],
          lastUpdated: new Date().toISOString()
        }, { merge: true });
      } else {
        await updateDoc(userRef, {
          completedConcepts: arrayUnion(theory),
          lastUpdated: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("Google Cloud sync failed:", err);
    }
  }
};

export const fetchProgress = async (userId: string): Promise<string[]> => {
  const localData = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
  
  if (isFirebaseActive && db && userId !== 'local-user-id') {
    try {
      const userRef = doc(db, "users", userId);
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        const cloudData = docSnap.data().completedConcepts || [];
        const merged = Array.from(new Set([...localData, ...cloudData]));
        // Keep local in sync with cloud
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
    } catch (err) {
      console.warn("Cloud fetch failed, using local backup.");
    }
  }
  
  return localData;
};

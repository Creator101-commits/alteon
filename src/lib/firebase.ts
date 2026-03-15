import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDmx9WX5GHpG8Gx0xhJpNWJwo6_0fmAOsE",
  authDomain: "studypal-47e1d.firebaseapp.com",
  projectId: "studypal-47e1d",
  storageBucket: "studypal-47e1d.firebasestorage.app",
  messagingSenderId: "858977827115",
  appId: "1:858977827115:web:1dc47aa54ebc977afa2d6e",
  measurementId: "G-LEDJPPD35J"
};

// Debug logging
console.log('Firebase config loaded:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  hasApiKey: !!firebaseConfig.apiKey
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with error handling
let db: any = null;
let storage: any = null;

try {
  db = getFirestore(app);
  console.log('Firestore initialized successfully');
} catch (error) {
  console.warn('Firestore not available:', error);
  // Firestore will remain null if not available
}

try {
  storage = getStorage(app);
  console.log('Storage initialized successfully');
} catch (error) {
  console.warn('Storage not available:', error);
  // Storage will remain null if not available
}

export { db, storage };

// Initialize Analytics (only in browser environment)
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Configure Google Auth Provider scopes (no calendar — removed to avoid Google verification requirement)
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.profile');
googleProvider.addScope('https://www.googleapis.com/auth/classroom.courses.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/classroom.student-submissions.students.readonly');

export const signInWithGoogle = async (enableSync: boolean = true) => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;
    
    // Store user data in Firestore only if available
    const user = result.user;
    if (db && token) {
      try {
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          name: user.displayName,
          firstName: user.displayName?.split(' ')[0] || '',
          lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
          avatar: user.photoURL,
          googleAccessToken: enableSync ? token : null,
          authProvider: 'google',
          hasGoogleAccess: enableSync, // Key flag to enable sync features
          hasGoogleCalendar: false, // Calendar sync disabled — removed scopes
          updatedAt: new Date(),
        }, { merge: true });
        console.log('User data saved to Firestore');

        // Supabase sync is handled centrally in AuthContext after auth bootstrap.
      } catch (firestoreError) {
        console.warn('Failed to save user data to Firestore:', firestoreError);
        // Continue without Firestore - user is still authenticated
      }
    } else {
      console.warn('Firestore not available - user data not saved');
    }
    
    return { user, token: enableSync ? token : null };
  } catch (error: any) {
    console.error('Error signing in with Google:', error);
    // Fallback to redirect for mobile devices or if popup is blocked
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
      return signInWithRedirect(auth, googleProvider);
    }
    throw error;
  }
};

// Alternative redirect sign-in for fallback
export const signInWithGoogleRedirect = () => {
  return signInWithRedirect(auth, googleProvider);
};

export const handleAuthRedirect = async () => {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      
      // Store user data in Firestore only if available
      const user = result.user;
      if (db && token) {
        try {
          await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            name: user.displayName,
            firstName: user.displayName?.split(' ')[0] || '',
            lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
            avatar: user.photoURL,
            googleAccessToken: token,
            authProvider: 'google',
            hasGoogleAccess: true, // Key flag to enable sync features
            hasGoogleCalendar: false, // Calendar sync disabled — removed scopes
            updatedAt: new Date(),
          }, { merge: true });
          console.log('User data saved to Firestore via redirect');
        } catch (firestoreError) {
          console.warn('Failed to save user data to Firestore via redirect:', firestoreError);
        }
      } else {
        console.warn('Firestore not available - user data not saved via redirect');
      }
      
      return { user, token };
    }
  } catch (error) {
    console.error('Auth redirect error:', error);
    throw error;
  }
};

export const signOutUser = () => {
  return signOut(auth);
};

export const getUserData = async (uid: string) => {
  if (!db) {
    console.warn('Firestore not available - cannot get user data');
    return null;
  }
  
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    return userDoc.exists() ? userDoc.data() : null;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

export const updateUserData = async (uid: string, data: any) => {
  if (!db) {
    console.warn('Firestore not available - cannot update user data');
    return;
  }
  
  try {
    await updateDoc(doc(db, 'users', uid), {
      ...data,
      updatedAt: new Date(),
    });
    console.log('User data updated successfully');
  } catch (error) {
    console.error('Error updating user data:', error);
    throw error;
  }
};

// Email/Password Authentication
export const signUpWithEmail = async (email: string, password: string, displayName: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;

    // Update the user's display name
    await updateProfile(user, {
      displayName: displayName
    });

    // Store user data in Firestore (without Google access token)
    if (db) {
      try {
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          name: displayName,
          firstName: displayName?.split(' ')[0] || '',
          lastName: displayName?.split(' ').slice(1).join(' ') || '',
          avatar: null,
          authProvider: 'email',
          hasGoogleAccess: false, // Key flag to disable sync features
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log('Email user data saved to Firestore');

        // Supabase sync is handled centrally in AuthContext after auth bootstrap.
      } catch (firestoreError) {
        console.warn('Failed to save user data to Firestore:', firestoreError);
      }
    }

    return { user };
  } catch (error) {
    console.error('Error creating account with email:', error);
    throw error;
  }
};

export const signInWithEmail = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result.user;
    
    // Update last sign in time
    if (db) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          lastSignIn: new Date(),
        });
      } catch (firestoreError) {
        console.warn('Failed to update sign in time:', firestoreError);
      }

      // Supabase sync is handled centrally in AuthContext after auth bootstrap.
    }

    return { user };
  } catch (error) {
    console.error('Error signing in with email:', error);
    throw error;
  }
};

/**
 * Refresh Google OAuth token using server-side endpoint
 * @param userId - The user's Firebase UID
 * @returns Object containing new access token and expiry time
 */
export const refreshGoogleToken = async (userId: string): Promise<{ accessToken: string; expiresAt: Date } | null> => {
  try {
    // Get refresh token from localStorage as fallback
    const localRefreshToken = localStorage.getItem('google_calendar_refresh_token');

    // Call server-side refresh endpoint (has access to client secret)
    const response = await fetch('/api/auth/refresh-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify({
        refreshToken: localRefreshToken, // Send localStorage token as fallback
      }),
    });

    if (!response.ok) {
      // Silently return null - caller will handle appropriately
      return null;
    }

    const tokenData = await response.json();
    const newAccessToken = tokenData.accessToken;
    const expiresAt = new Date(tokenData.expiresAt);

    // Update access token in localStorage
    localStorage.setItem('google_calendar_access_token', newAccessToken);

    // Update tokens in Firestore
    if (db) {
      try {
        await updateDoc(doc(db, 'users', userId), {
          googleAccessToken: newAccessToken,
          tokenExpiresAt: expiresAt,
          updatedAt: new Date(),
        });
        console.log(' Updated tokens in Firestore');
      } catch (firestoreError) {
        console.warn('Failed to update tokens in Firestore:', firestoreError);
      }
    }

    return { accessToken: newAccessToken, expiresAt };
  } catch (error) {
    console.error(' Error refreshing Google token:', error);
    return null;
  }
};

/**
 * Validate and refresh Google token if needed
 * @param userId - The user's Firebase UID
 * @returns Valid access token or null
 */
export const getValidGoogleToken = async (userId: string): Promise<string | null> => {
  try {
    const userData = await getUserData(userId);
    
    if (!userData || !userData.googleAccessToken) {
      console.warn('No Google access token found for user');
      return null;
    }

    // Check if token is expired or about to expire (5 minutes buffer)
    const tokenExpiresAt = userData.tokenExpiresAt ? new Date(userData.tokenExpiresAt) : null;
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (!tokenExpiresAt || tokenExpiresAt <= fiveMinutesFromNow) {
      console.log(' Token expired or expiring soon, refreshing...');
      const refreshResult = await refreshGoogleToken(userId);
      
      if (refreshResult) {
        return refreshResult.accessToken;
      }
      
      console.error('Failed to refresh token');
      return null;
    }

    console.log(' Token is still valid');
    return userData.googleAccessToken;
  } catch (error) {
    console.error('Error validating Google token:', error);
    return null;
  }
};

/**
 * Check if user has valid Google OAuth tokens
 * @param userId - The user's Firebase UID
 * @returns Boolean indicating if tokens are available and valid
 */
export const hasValidGoogleAuth = async (userId: string): Promise<boolean> => {
  const token = await getValidGoogleToken(userId);
  return token !== null;
};

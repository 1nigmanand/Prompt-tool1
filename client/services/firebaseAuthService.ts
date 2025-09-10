import { 
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { User } from '../types';

let currentUser: User | null = null;

/**
 * Convert Firebase User to our User type
 */
const convertFirebaseUser = (firebaseUser: FirebaseUser): User => {
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || undefined,
    photoURL: firebaseUser.photoURL || undefined
  };
};

/**
 * Initialize auth state listener
 */
export const initializeAuthListener = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      currentUser = convertFirebaseUser(firebaseUser);
      console.log('🔐 User signed in:', currentUser);
    } else {
      currentUser = null;
      console.log('🔓 User signed out');
    }
    callback(currentUser);
  });
};

/**
 * Sign in with Google
 */
export const signInWithGoogle = async (): Promise<User> => {
  try {
    console.log('🚀 Initiating Google sign-in...');
    
    const result = await signInWithPopup(auth, googleProvider);
    const user = convertFirebaseUser(result.user);
    
    console.log('✅ Google sign-in successful:', {
      email: user.email,
      name: user.displayName
    });
    
    return user;
  } catch (error: any) {
    console.error('❌ Google sign-in failed:', error);
    
    // Handle specific Firebase auth errors
    switch (error.code) {
      case 'auth/popup-closed-by-user':
        throw new Error('Sign-in was cancelled. Please try again.');
      case 'auth/popup-blocked':
        throw new Error('Pop-up was blocked by browser. Please allow pop-ups and try again.');
      case 'auth/cancelled-popup-request':
        throw new Error('Sign-in was cancelled. Please try again.');
      default:
        throw new Error(error.message || 'Failed to sign in with Google');
    }
  }
};

/**
 * Sign out current user
 */
export const signOut = async (): Promise<void> => {
  try {
    console.log('🔄 Signing out...');
    await firebaseSignOut(auth);
    console.log('✅ Sign out successful');
  } catch (error: any) {
    console.error('❌ Sign out failed:', error);
    throw new Error(error.message || 'Failed to sign out');
  }
};

/**
 * Get current user
 */
export const getCurrentUser = (): User | null => {
  return currentUser;
};

/**
 * Get Firebase ID token for API authentication
 */
export const getIdToken = async (): Promise<string | null> => {
  try {
    if (!auth.currentUser) {
      console.warn('⚠️ No authenticated user for token');
      return null;
    }
    
    const token = await auth.currentUser.getIdToken();
    return token;
  } catch (error) {
    console.error('❌ Failed to get ID token:', error);
    return null;
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return currentUser !== null;
};

// Legacy functions for backward compatibility (deprecated)
export const login = async (email: string, password: string): Promise<User> => {
  throw new Error('Use signInWithGoogle() instead of login()');
};

export const signup = async (email: string, password: string): Promise<User> => {
  throw new Error('Use signInWithGoogle() instead of signup()');
};

export const logout = async (): Promise<void> => {
  return signOut();
};

// Firebase configuration and initialization
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCr-mPuR2BnqwbrU4Dpp6LF5OvSj3KxbnI",
  authDomain: "prompt-proj1.firebaseapp.com",
  projectId: "prompt-proj1",
  storageBucket: "prompt-proj1.firebasestorage.app",
  messagingSenderId: "692160650594",
  appId: "1:692160650594:web:5cc6aaa88b6c9357ff203b",
  measurementId: "G-N5J8TRYGX5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Initialize Analytics (optional)
export const analytics = getAnalytics(app);

export default app;

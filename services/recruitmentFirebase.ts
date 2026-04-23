import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Configuration for the "First Website" (me3oan) containing join_requests
const recruitmentConfig = {
  apiKey: "AIzaSyD0rA6PhldFuAHA4ayKxk8hyz9I7Cq2ugo",
  authDomain: "me3oan.firebaseapp.com",
  projectId: "me3oan",
  storageBucket: "me3oan.firebasestorage.app",
  messagingSenderId: "892304737200",
  appId: "1:892304737200:web:e84b8ee4f941a46ebacc75"
};

// Initialize a secondary Firebase App instance named 'recruitmentApp'
// Check if already initialized to prevent errors during hot reload
const recruitmentApp = !getApps().some(app => app.name === "recruitmentApp")
  ? initializeApp(recruitmentConfig, "recruitmentApp")
  : getApp("recruitmentApp");

export const recruitmentDb = getFirestore(recruitmentApp);
export const recruitmentAuth = getAuth(recruitmentApp);

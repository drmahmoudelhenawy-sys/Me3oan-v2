// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD5D0hMQS1MNpXeFVH8LyNVaRvfnIGLT0g",
  authDomain: "me3oan-task.firebaseapp.com",
  projectId: "me3oan-task",
  storageBucket: "me3oan-task.firebasestorage.app",
  messagingSenderId: "758849340072",
  appId: "1:758849340072:web:91358375dc030515c5389d",
  measurementId: "G-W5SBD9ZV22"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

isAnalyticsSupported()
  .then((supported) => {
    if (supported) getAnalytics(app);
  })
  .catch((error) => {
    console.warn("Firebase Analytics disabled in this browser:", error);
  });

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

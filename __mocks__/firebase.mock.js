import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Same config and exports as your original file

const firebaseConfig = {
  apiKey: "AIzaSyDyLL5lej7NYTIi9udmCwe_l7HsVb7e-AQ",
  authDomain: "constitution-of-homies.firebaseapp.com",
  projectId: "constitution-of-homies",
  storageBucket: "constitution-of-homies.firebasestorage.app",
  messagingSenderId: "534709453915",
  appId: "1:534709453915:web:855e13de6ef93393f16b7e",
  measurementId: "G-9SCYLHCB0L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
export { auth, db, app, analytics };
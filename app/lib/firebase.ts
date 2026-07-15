// Firebase client (browser SDK). The app talks to Firestore/Auth directly — no
// server. Config is the existing care-royale2-4dgwu0 project (public by design;
// security is enforced by Firestore rules + Auth).
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getFunctions, type Functions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyCQuvAI5TBtkyW_SIK2PKpengsmrtMIFdY",
  authDomain: "care-royale2-4dgwu0.firebaseapp.com",
  projectId: "care-royale2-4dgwu0",
  storageBucket: "care-royale2-4dgwu0.firebasestorage.app",
  messagingSenderId: "932380140979",
  appId: "1:932380140979:web:434d19d2399173b6dc57c6",
};

let _app: FirebaseApp | null = null;
export function app(): FirebaseApp {
  if (!_app) _app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return _app;
}
export function auth(): Auth {
  return getAuth(app());
}
export function db(): Firestore {
  return getFirestore(app());
}
// Cloud Functions (payments). Inert until the cloud-functions/ are deployed.
export function functions(): Functions {
  return getFunctions(app());
}

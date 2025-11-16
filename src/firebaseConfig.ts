// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDKpvustqwUpjwhnfUar3VSFrFXi69wFHo",
  authDomain: "praktikumloginrnexpo.firebaseapp.com",
  projectId: "praktikumloginrnexpo",
  storageBucket: "praktikumloginrnexpo.firebasestorage.app",
  messagingSenderId: "95719848180",
  appId: "1:95719848180:web:67497fe58a91c1791cc6a1",
  measurementId: "G-NJBZ4HD29F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
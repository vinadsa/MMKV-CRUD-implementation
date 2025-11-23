// src/services/firebaseService.ts
import {
  createUserWithEmailAndPassword,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  FieldValue,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { clearCredentials, saveCredentials } from '../storage/mmkvCredentials';
import { clearUser, saveUser, StoredUser } from '../storage/mmkvUser';

const USERS_COLLECTION = 'users';
const THREADS_COLLECTION = 'threads';
const MESSAGES_SUBCOLLECTION = 'messages';

const deriveDisplayName = (email?: string | null, fallback?: string | null) => {
  if (fallback && fallback.trim().length > 0) return fallback.trim();
  if (!email) return 'Pengguna';
  const [name] = email.split('@');
  return name || 'Pengguna';
};

const mapProfileToStoredUser = (profile: UserProfile): StoredUser => ({
  uid: profile.uid,
  email: profile.email,
  displayName: profile.displayName,
});

// ============ AUTHENTICATION & USER PROFILES ============

type FirestoreTime = Timestamp | FieldValue | null;

export interface UserProfile {
  uid: string;
  email: string | null;
  emailLower: string | null;
  displayName: string;
  lastSeen?: FirestoreTime;
  createdAt?: FirestoreTime;
  updatedAt?: FirestoreTime;
}

export const ensureUserProfile = async (params: {
  uid: string;
  email: string | null;
  displayName?: string | null;
}) => {
  const userRef = doc(db, USERS_COLLECTION, params.uid);
  const snapshot = await getDoc(userRef);
  const displayName = deriveDisplayName(params.email, params.displayName);
  const payload: Partial<UserProfile> = {
    uid: params.uid,
    email: params.email,
    emailLower: params.email ? params.email.toLowerCase() : null,
    displayName,
    updatedAt: serverTimestamp(),
  };

  if (snapshot.exists()) {
    const data = snapshot.data() as UserProfile;
    if (!data.displayName && displayName) {
      await updateDoc(userRef, { displayName });
      return { ...data, displayName } as UserProfile;
    }
    return data;
  }

  const newProfile: UserProfile = {
    ...payload,
    lastSeen: serverTimestamp(),
    createdAt: serverTimestamp(),
  } as UserProfile;

  await setDoc(userRef, newProfile);
  return newProfile;
};

const persistSuccessfulAuth = (user: StoredUser, email: string, password: string) => {
  saveUser(user);
  saveCredentials({ email, password });
};

export const registerUser = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser: FirebaseUser = userCredential.user;
    const profile = await ensureUserProfile({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
    });
    const storedUser = mapProfileToStoredUser(profile);
    persistSuccessfulAuth(storedUser, email, password);
    console.log('✅ User berhasil register:', firebaseUser.email);
    return { success: true, user: storedUser };
  } catch (error: any) {
    console.error('❌ Error register:', error.message);
    return { success: false, error: error.message };
  }
};

export const loginUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser: FirebaseUser = userCredential.user;
    const profile = await ensureUserProfile({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
    });
    const storedUser = mapProfileToStoredUser(profile);
    persistSuccessfulAuth(storedUser, email, password);
    console.log('✅ User berhasil login:', firebaseUser.email);
    return { success: true, user: storedUser };
  } catch (error: any) {
    console.error('❌ Error login:', error.message);
    return { success: false, error: error.message };
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
    clearUser();
    clearCredentials();
    console.log('✅ User berhasil logout');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error logout:', error.message);
    return { success: false, error: error.message };
  }
};

export const getCurrentUser = () => auth.currentUser;

export const getUserProfileById = async (uid: string) => {
  const userRef = doc(db, USERS_COLLECTION, uid);
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) return null;
  return snapshot.data() as UserProfile;
};

export const getUserProfileByEmail = async (email: string) => {
  const normalized = email.trim().toLowerCase();
  const q = query(
    collection(db, USERS_COLLECTION),
    where('emailLower', '==', normalized),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return docSnap.data() as UserProfile;
};

// ============ CHAT THREADS & MESSAGES ============

export interface ThreadDoc {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastSenderId?: string;
  createdAt?: FirestoreTime;
  updatedAt?: FirestoreTime;
}

export interface MessageDoc {
  id: string;
  text: string;
  senderId: string;
  createdAt?: FirestoreTime;
  readBy: string[];
}

const buildThreadId = (a: string, b: string) => [a, b].sort().join('_');

export const ensureDirectThread = async (userAId: string, userBId: string) => {
  const threadId = buildThreadId(userAId, userBId);
  const threadRef = doc(db, THREADS_COLLECTION, threadId);
  const now = serverTimestamp();

  await setDoc(
    threadRef,
    {
      participants: [userAId, userBId],
      createdAt: now,
      updatedAt: now,
    },
    { merge: true } // creates if missing, keeps data if exists
  );

  const snapshot = await getDoc(threadRef); // now succeeds because user is in participants
  return { id: snapshot.id, ...(snapshot.data() as Omit<ThreadDoc, 'id'>) } as ThreadDoc;
};

export const getThreadById = async (threadId: string) => {
  const threadRef = doc(db, THREADS_COLLECTION, threadId);
  const snapshot = await getDoc(threadRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...(snapshot.data() as Omit<ThreadDoc, 'id'>) } as ThreadDoc;
};

export const startDirectThreadByEmail = async (
  currentUser: StoredUser,
  targetEmail: string
) => {
  const normalized = targetEmail.trim().toLowerCase();
  if (!normalized) {
    throw new Error('Email lawan bicara wajib diisi');
  }

  if (currentUser.email && currentUser.email.toLowerCase() === normalized) {
    throw new Error('Tidak bisa mengirim pesan ke diri sendiri');
  }

  const otherUser = await getUserProfileByEmail(normalized);
  if (!otherUser) {
    throw new Error('User dengan email tersebut tidak ditemukan');
  }

  const thread = await ensureDirectThread(currentUser.uid, otherUser.uid);
  return { thread, otherUser };
};

export const subscribeToThreads = (
  userId: string,
  callback: (threads: ThreadDoc[]) => void
) => {
  const q = query(
    collection(db, THREADS_COLLECTION),
    where('participants', 'array-contains', userId),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: ThreadDoc[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ThreadDoc, 'id'>),
      }));
      callback(items);
    },
    (error) => console.error('❌ Error realtime threads:', error)
  );
};

export const subscribeToMessages = (
  threadId: string,
  callback: (messages: MessageDoc[]) => void
) => {
  const messagesRef = collection(db, THREADS_COLLECTION, threadId, MESSAGES_SUBCOLLECTION);
  const q = query(messagesRef, orderBy('createdAt', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: MessageDoc[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<MessageDoc, 'id'>),
      }));
      callback(items);
    },
    (error) => console.error('❌ Error realtime messages:', error)
  );
};

export const sendMessage = async (threadId: string, senderId: string, text: string) => {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Pesan tidak boleh kosong');
  }

  const threadRef = doc(db, THREADS_COLLECTION, threadId);
  const messagesRef = collection(threadRef, MESSAGES_SUBCOLLECTION);
  const now = serverTimestamp();

  await addDoc(messagesRef, {
    text: trimmed,
    senderId,
    createdAt: now,
    readBy: [senderId],
  });

  await updateDoc(threadRef, {
    lastMessage: trimmed,
    lastSenderId: senderId,
    updatedAt: now,
  });
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, setDoc, doc, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { ScoreEntry } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyBSH4iz0WCBlg_taepqREN3laTjDGdqIns",
  authDomain: "zennum-8111f.firebaseapp.com",
  projectId: "zennum-8111f",
  storageBucket: "zennum-8111f.firebasestorage.app",
  messagingSenderId: "327285639000",
  appId: "1:327285639000:web:fe28b8c1b449e6da26072d",
  measurementId: "G-E7BJ7X0XEM"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export const uploadScore = async (score: ScoreEntry) => {
  try {
    const docId = `${score.userId}_${score.difficultyId}`;
    await setDoc(doc(db, "rankings", docId), {
      ...score,
      timestamp: Date.now()
    });
    return docId;
  } catch (e) {
    console.error("Firebase upload error:", e);
    return null;
  }
};

export const uploadResultImage = async (blob: Blob, scoreId: string): Promise<string | null> => {
  try {
    const storageRef = ref(storage, `results/${scoreId}_${Date.now()}.png`);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  } catch (e) {
    console.error("Firebase storage upload error:", e);
    return null;
  }
};

export const getGlobalRankForScore = async (difficultyId: string, time: number): Promise<number | null> => {
  try {
    const q = query(
      collection(db, "rankings"),
      where("difficultyId", "==", difficultyId),
      where("time", "<", time)
    );
    const snapshot = await getDocs(q);
    return snapshot.size + 1;
  } catch (e: any) {
    try {
      const fallbackQ = query(collection(db, "rankings"), where("difficultyId", "==", difficultyId));
      const snapshot = await getDocs(fallbackQ);
      const betterScores = snapshot.docs.filter(d => d.data().time < time);
      return betterScores.length + 1;
    } catch (err) {
      return null;
    }
  }
};

export const getGlobalRankings = async (difficultyId: string): Promise<ScoreEntry[]> => {
  try {
    const q = query(
      collection(db, "rankings"),
      where("difficultyId", "==", difficultyId),
      orderBy("time", "asc"),
      limit(1000)
    );
    const querySnapshot = await getDocs(q);
    const scores: ScoreEntry[] = [];
    querySnapshot.forEach((doc) => {
      scores.push({ ...doc.data() } as ScoreEntry);
    });
    return scores;
  } catch (e: any) {
    try {
      const fallbackQ = query(collection(db, "rankings"), where("difficultyId", "==", difficultyId));
      const snapshot = await getDocs(fallbackQ);
      return snapshot.docs
        .map(d => d.data() as ScoreEntry)
        .sort((a, b) => a.time - b.time)
        .slice(0, 1000);
    } catch (err) {
      return [];
    }
  }
};

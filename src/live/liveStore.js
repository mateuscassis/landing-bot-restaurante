import { initializeApp } from "firebase/app";
import { getDatabase, onValue, ref, runTransaction } from "firebase/database";
import { firebaseConfig } from "./firebaseConfig";

// Shared live state (tournament + current match). Uses Firebase Realtime Database when
// configured, so every phone sees the same screen. Without it, falls back to localStorage,
// which still syncs across tabs of the same browser (handy for testing on localhost).

const FIREBASE_DATABASE_URL = (import.meta.env.VITE_FIREBASE_DATABASE_URL || firebaseConfig.databaseURL || "").trim();
const LIVE_PATH = "fut-terca/live";
const LOCAL_KEY = "fut-terca-live";

function createFirebaseStore() {
  const app = initializeApp({
    databaseURL: FIREBASE_DATABASE_URL,
    apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey || "").trim() || undefined,
    projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId || "").trim() || undefined,
  });
  const db = getDatabase(app);
  const liveRef = ref(db, LIVE_PATH);
  let serverOffset = 0;

  onValue(ref(db, ".info/serverTimeOffset"), (snapshot) => {
    serverOffset = Number(snapshot.val()) || 0;
  });

  return {
    mode: "firebase",
    now: () => Date.now() + serverOffset,
    subscribe(callback) {
      return onValue(liveRef, (snapshot) => callback(snapshot.val()));
    },
    async update(updater) {
      let changed = false;
      await runTransaction(liveRef, (current) => {
        const next = updater(current);
        changed = next !== undefined;
        return next;
      });
      return changed;
    },
  };
}

function createLocalStore() {
  const listeners = new Set();

  function read() {
    try {
      const raw = window.localStorage.getItem(LOCAL_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function notify() {
    const value = read();
    listeners.forEach((listener) => listener(value));
  }

  window.addEventListener("storage", (event) => {
    if (event.key === LOCAL_KEY) {
      notify();
    }
  });

  return {
    mode: "local",
    now: () => Date.now(),
    subscribe(callback) {
      listeners.add(callback);
      callback(read());
      return () => listeners.delete(callback);
    },
    async update(updater) {
      const next = updater(read());
      if (next === undefined) {
        return false;
      }
      try {
        window.localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      } catch {
        // Ignore quota/private mode errors; state still updates in this tab.
      }
      notify();
      return true;
    },
  };
}

export const liveStore = FIREBASE_DATABASE_URL ? createFirebaseStore() : createLocalStore();

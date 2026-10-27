// Firebase web config for the live scoreboard. These values are public by design (every browser
// receives them); access is controlled by the Realtime Database rules described in FIREBASE_SETUP.md.
// Leave databaseURL empty to run the scoreboard in local mode (this browser only).
// VITE_FIREBASE_* environment variables, when set, take precedence.
export const firebaseConfig = {
  databaseURL: "",
  apiKey: "",
  projectId: "",
};

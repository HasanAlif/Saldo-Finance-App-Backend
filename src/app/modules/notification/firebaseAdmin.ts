import admin from "firebase-admin";

let firebaseReady = false;
let firebaseInitError: string | null = null;

const initializeFirebase = () => {
  if (admin.apps.length > 0) {
    firebaseReady = true;
    firebaseInitError = null;
    return admin;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    firebaseReady = false;
    firebaseInitError =
      "Firebase credentials not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.";
    console.warn(firebaseInitError);
    return admin;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    firebaseReady = true;
    firebaseInitError = null;
    console.log("Firebase Admin SDK initialized successfully");
  } catch (error: any) {
    firebaseReady = false;
    firebaseInitError = error.message;
    console.error("Firebase initialization error:", error.message);
  }

  return admin;
};

export const isFirebaseReady = () => firebaseReady && admin.apps.length > 0;

export const getFirebaseInitError = () => firebaseInitError;

export default initializeFirebase();

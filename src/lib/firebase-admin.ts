import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getFirestore, Firestore, FieldValue } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

export interface FinalizedMessagePayload {
  sessionId: string;
  eventId: string;
  sequenceNumber?: number;
  speakerId?: string;
  speakerName?: string;
  originalText: string;
  sourceLanguage: string;
  targetLanguage: string;
  translatedText: string;
  timestamp?: number;
}

let adminApp: App | null = null;
let firestoreDb: Firestore | null = null;
let initializationAttempted = false;
let isConfiguredAndReachable = false;

/**
 * Safely initializes Firebase Admin SDK on the Node.js server.
 * Ensures credentials are never exposed and never printed to logs.
 */
export function getAdminFirestore(): Firestore | null {
  if (initializationAttempted) {
    return firestoreDb;
  }
  initializationAttempted = true;

  try {
    const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
    let projectId = "reflecting-journey-d8gvj";
    let databaseId = "(default)";
    if (fs.existsSync(configPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (parsed.projectId) projectId = parsed.projectId;
        if (parsed.firestoreDatabaseId) databaseId = parsed.firestoreDatabaseId;
      } catch (e) {}
    }

    if (getApps().length > 0) {
      adminApp = getApps()[0];
      firestoreDb = (databaseId && databaseId !== "(default)") ? getFirestore(adminApp, databaseId) : getFirestore(adminApp);
      isConfiguredAndReachable = true;
      return firestoreDb;
    }

    const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (saPath && fs.existsSync(saPath)) {
      adminApp = initializeApp({
        credential: cert(saPath),
        projectId
      });
      firestoreDb = (databaseId && databaseId !== "(default)") ? getFirestore(adminApp, databaseId) : getFirestore(adminApp);
      isConfiguredAndReachable = true;
      console.log("[FIRESTORE] Firebase Admin initialized using Service Account path.");
    } else if (saJson) {
      const parsedSa = JSON.parse(saJson);
      adminApp = initializeApp({
        credential: cert(parsedSa),
        projectId
      });
      firestoreDb = (databaseId && databaseId !== "(default)") ? getFirestore(adminApp, databaseId) : getFirestore(adminApp);
      isConfiguredAndReachable = true;
      console.log("[FIRESTORE] Firebase Admin initialized using FIREBASE_SERVICE_ACCOUNT_JSON.");
    } else {
      console.log("[FIRESTORE] Credential Notice: Server environment credentials (FIREBASE_SERVICE_ACCOUNT_KEY / GOOGLE_APPLICATION_CREDENTIALS / FIREBASE_SERVICE_ACCOUNT_JSON) not set.");
      console.log("[FIRESTORE] Server-side Firestore persistence is operating in NOT_VERIFIED mode (Credential Boundary).");
      firestoreDb = null;
      isConfiguredAndReachable = false;
      return null;
    }
  } catch (error: any) {
    console.warn("[FIRESTORE] Firebase Admin initialization notice:", error.message || error);
    firestoreDb = null;
    isConfiguredAndReachable = false;
  }

  return firestoreDb;
}

/**
 * Server-authoritative function to persist a finalized conversation message to Firestore.
 * Uses deterministic document ID: sessions/{sessionId}/messages/{eventId}
 * Guarantees 1 finalized event = 1 Firestore document (no duplicate addDoc entries).
 */
export async function persistFinalizedConversationMessage(payload: FinalizedMessagePayload): Promise<boolean> {
  const {
    sessionId,
    eventId,
    sequenceNumber,
    speakerId,
    speakerName,
    originalText,
    sourceLanguage,
    targetLanguage,
    translatedText,
    timestamp
  } = payload;

  if (!sessionId || !eventId || !originalText) {
    console.warn("[FIRESTORE] Invalid message payload for server persistence:", { sessionId, eventId });
    return false;
  }

  const db = getAdminFirestore();
  if (!db) {
    console.log(`[FIRESTORE] persist_skipped (No Server Credentials Active): session='${sessionId}' eventId='${eventId}'`);
    return false;
  }

  const startTime = Date.now();
  console.log(`[FIRESTORE] persist_start: session='${sessionId}' eventId='${eventId}' seq=${sequenceNumber || 'N/A'}`);

  try {
    const docPath = `sessions/${sessionId}/messages/${eventId}`;
    const docRef = db.doc(docPath);

    const docData = {
      eventId,
      sessionId,
      sequenceNumber: typeof sequenceNumber === "number" ? sequenceNumber : null,
      speakerId: speakerId || "speaker-01",
      speakerName: speakerName || "Speaker",
      originalText,
      sourceLanguage: sourceLanguage || "en",
      targetLanguage: targetLanguage || "hi",
      translatedText: translatedText || originalText,
      timestamp: timestamp ? new Date(timestamp) : FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    };

    // Deterministic write using set with merge to guarantee idempotency
    await docRef.set(docData, { merge: true });

    const executionTimeMs = Date.now() - startTime;
    console.log(`[FIRESTORE] persist_success: session='${sessionId}' eventId='${eventId}' path='${docPath}' (${executionTimeMs}ms)`);
    return true;
  } catch (error: any) {
    const executionTimeMs = Date.now() - startTime;
    console.error(`[FIRESTORE] persist_failure: session='${sessionId}' eventId='${eventId}' error='${error.message || error}' (${executionTimeMs}ms)`);
    return false;
  }
}

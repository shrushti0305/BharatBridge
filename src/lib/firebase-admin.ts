import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";

let adminApp: App | null = null;

/**
 * Safely initializes or returns the Firebase Admin App instance.
 */
export function getAdminApp(): App | null {
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
  let projectId = process.env.FIREBASE_PROJECT_ID || "reflecting-journey-d8gvj";
  if (fs.existsSync(configPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (parsed.projectId) projectId = parsed.projectId;
    } catch (e) {}
  }

  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  try {
    if (saPath && fs.existsSync(saPath)) {
      adminApp = initializeApp({
        credential: cert(saPath),
        projectId
      });
      console.log("[FIREBASE_ADMIN] Initialized using Service Account path.");
    } else if (saJson) {
      adminApp = initializeApp({
        credential: cert(JSON.parse(saJson)),
        projectId
      });
      console.log("[FIREBASE_ADMIN] Initialized using FIREBASE_SERVICE_ACCOUNT_JSON.");
    } else {
      adminApp = initializeApp({ projectId });
      console.log(`[FIREBASE_ADMIN] Initialized with projectId '${projectId}' for token verification.`);
    }
  } catch (err: any) {
    console.warn("[FIREBASE_ADMIN] Initialization warning:", err.message || err);
    if (getApps().length > 0) {
      adminApp = getApps()[0];
    }
  }

  return adminApp;
}

/**
 * Safely initializes and returns Firebase Admin Auth instance for ID token verification.
 */
export function getAdminAuth(): Auth | null {
  try {
    const app = getAdminApp();
    return app ? getAuth(app) : null;
  } catch (err: any) {
    console.warn("[FIREBASE_ADMIN] Failed to get Auth instance:", err.message || err);
    return null;
  }
}


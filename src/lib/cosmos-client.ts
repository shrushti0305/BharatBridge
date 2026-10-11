import { CosmosClient, Database, Container } from "@azure/cosmos";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

function getEndpoint() {
  return process.env.COSMOS_DB_ENDPOINT || "";
}
function getKey() {
  return process.env.COSMOS_DB_KEY || "";
}
function getDatabaseName() {
  return process.env.COSMOS_DB_DATABASE_NAME || "bharatbridge";
}

let client: CosmosClient | null = null;
let dbInstance: Database | null = null;
const containerCache: Map<string, Container> = new Map();

export const cosmosHealthState = {
  configured: Boolean(process.env.COSMOS_DB_ENDPOINT && process.env.COSMOS_DB_KEY),
  reachable: false,
  lastWriteOk: false,
  lastError: null as string | null
};

/**
 * Initializes and returns the shared Cosmos DB client instance with retries & timeouts.
 */
export function getCosmosClient(): CosmosClient | null {
  if (client) return client;
  const endpoint = getEndpoint();
  const key = getKey();
  if (!endpoint || !key) {
    cosmosHealthState.configured = false;
    console.warn("[CosmosDB] COSMOS_DB_ENDPOINT or COSMOS_DB_KEY is missing from environment.");
    return null;
  }
  cosmosHealthState.configured = true;
  client = new CosmosClient({
    endpoint,
    key,
    connectionPolicy: {
      requestTimeout: 10000,
      retryOptions: {
        maxRetryAttemptCount: 3,
        fixedRetryIntervalInMilliseconds: 1000,
        maxWaitTimeInSeconds: 10
      }
    }
  });
  return client;
}

/**
 * Ensures the target Cosmos database exists and returns a reference to it.
 */
export async function getDatabase(): Promise<Database | null> {
  if (dbInstance) return dbInstance;
  const cosmosClient = getCosmosClient();
  if (!cosmosClient) return null;

  try {
    const { database } = await cosmosClient.databases.createIfNotExists({
      id: getDatabaseName(),
    });
    dbInstance = database;
    cosmosHealthState.reachable = true;
    cosmosHealthState.lastError = null;
    return dbInstance;
  } catch (err: any) {
    cosmosHealthState.reachable = false;
    cosmosHealthState.lastError = err?.message || String(err);
    console.error("[CosmosDB] Database creation error:", err);
    return null;
  }
}

/**
 * Ensures the specified container exists with its partition key and returns a reference.
 * - 'sessions' container: partition key '/id'
 * - 'messages' container: partition key '/sessionId', optional defaultTtl
 */
export async function getContainer(containerName: "sessions" | "messages" | string): Promise<Container | null> {
  if (containerCache.has(containerName)) {
    return containerCache.get(containerName)!;
  }

  const db = await getDatabase();
  if (!db) return null;

  let partitionKeyPath = "/id";
  if (containerName === "messages") {
    partitionKeyPath = "/sessionId";
  } else if (containerName === "sessions") {
    partitionKeyPath = "/id";
  } else if (containerName === "metrics") {
    partitionKeyPath = "/day";
  }

  const messageTtlSeconds = process.env.COSMOS_MESSAGE_TTL_SECONDS ? Number(process.env.COSMOS_MESSAGE_TTL_SECONDS) : undefined;
  const metricsTtlDays = process.env.METRICS_TTL_DAYS ? Number(process.env.METRICS_TTL_DAYS) : 90;

  const containerDef: any = {
    id: containerName,
    partitionKey: { paths: [partitionKeyPath] }
  };

  if (containerName === "messages" && messageTtlSeconds !== undefined && !isNaN(messageTtlSeconds)) {
    containerDef.defaultTtl = messageTtlSeconds;
  } else if (containerName === "metrics") {
    containerDef.defaultTtl = metricsTtlDays * 86400;
  }

  try {
    const { container } = await db.containers.createIfNotExists(containerDef);
    containerCache.set(containerName, container);
    cosmosHealthState.reachable = true;
    cosmosHealthState.lastError = null;
    return container;
  } catch (err: any) {
    cosmosHealthState.reachable = false;
    cosmosHealthState.lastError = err?.message || String(err);
    console.error(`[CosmosDB] Container '${containerName}' creation error:`, err);
    return null;
  }
}

/**
 * Helper to initialize database & containers on server startup or test verification.
 */
export async function initCosmosDB(): Promise<{
  success: boolean;
  databaseId?: string;
  containers?: string[];
  error?: string;
}> {
  const endpoint = getEndpoint();
  const key = getKey();
  if (!endpoint || !key) {
    cosmosHealthState.configured = false;
    cosmosHealthState.reachable = false;
    console.log("[Persistence] Cosmos DB credentials missing. Persistence is OFF.");
    return { success: false, error: "Cosmos DB credentials missing." };
  }

  try {
    const db = await getDatabase();
    if (!db) {
      cosmosHealthState.reachable = false;
      return { success: false, error: "Cosmos DB database initialization failed." };
    }
    const sessionsContainer = await getContainer("sessions");
    const messagesContainer = await getContainer("messages");

    if (!sessionsContainer || !messagesContainer) {
      cosmosHealthState.reachable = false;
      return { success: false, error: "Failed to initialize Cosmos DB containers." };
    }

    cosmosHealthState.configured = true;
    cosmosHealthState.reachable = true;
    cosmosHealthState.lastError = null;
    console.log(`[CosmosDB] Successfully connected to database '${db.id}' and containers ['sessions', 'messages']. Persistence is ACTIVE.`);

    return {
      success: true,
      databaseId: db.id,
      containers: ["sessions", "messages"],
    };
  } catch (err: any) {
    cosmosHealthState.reachable = false;
    cosmosHealthState.lastError = err?.message || String(err);
    console.error("[CosmosDB] Initialization error:", err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Write path: Upsert one document per finalized thought in Cosmos DB.
 * Merges translations for the same eventId (accumulating language translations).
 */
export async function upsertFinalizedThoughtDocument(params: {
  eventId: string;
  sessionId: string;
  speakerId: string;
  speakerName: string;
  sequenceNumber?: number;
  originalText: string;
  sourceLang: string;
  targetLang?: string;
  translatedText?: string;
  provider?: string;
  degraded?: boolean;
  translations?: Record<string, { text: string; provider: string; degraded: boolean }>;
  timestamp?: number;
}): Promise<{ success: boolean; ru?: number; error?: string }> {
  try {
    const container = await getContainer("messages");
    if (!container) return { success: false, error: "Messages container unavailable" };

    const { eventId, sessionId, speakerId, speakerName, sequenceNumber, originalText, sourceLang, targetLang, translatedText, provider, degraded } = params;
    const now = params.timestamp || Date.now();

    // Read existing doc if present to merge translations
    let existingDoc: any = null;
    try {
      const itemRes = await container.item(eventId, sessionId).read();
      existingDoc = itemRes.resource;
    } catch (readErr: any) {
      // 404 Not Found is expected for new documents
    }

    const translationsMap = existingDoc?.translations || {};
    let isOverallDegraded = existingDoc?.degraded || Boolean(degraded);

    if (params.translations) {
      for (const [lang, val] of Object.entries(params.translations)) {
        translationsMap[lang] = {
          text: val.text,
          provider: val.provider || "unknown",
          degraded: Boolean(val.degraded)
        };
        if (val.degraded) isOverallDegraded = true;
      }
    } else if (targetLang && translatedText !== undefined) {
      translationsMap[targetLang] = {
        text: translatedText,
        provider: provider || "unknown",
        degraded: Boolean(degraded)
      };
      if (degraded) isOverallDegraded = true;
    }

    const docToUpsert = {
      id: eventId,
      sessionId,
      speakerId: existingDoc?.speakerId || speakerId,
      speakerName: existingDoc?.speakerName || speakerName,
      sequenceNumber: existingDoc?.sequenceNumber || sequenceNumber || 1,
      originalText: existingDoc?.originalText || originalText,
      sourceLang: existingDoc?.sourceLang || sourceLang,
      translations: translationsMap,
      degraded: Boolean(isOverallDegraded),
      timestamp: existingDoc?.timestamp || now
    };

    const upsertRes = await container.items.upsert(docToUpsert);
    cosmosHealthState.lastWriteOk = true;
    cosmosHealthState.lastError = null;
    cosmosHealthState.reachable = true;

    return {
      success: true,
      ru: upsertRes.requestCharge
    };
  } catch (err: any) {
    cosmosHealthState.lastWriteOk = false;
    cosmosHealthState.lastError = err?.message || String(err);
    console.error("[CosmosDB][WRITE_ERROR]", err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Patch operation: Adds or updates a language translation in the stored message document.
 */
export async function patchTranslationDocument(params: {
  eventId: string;
  sessionId: string;
  lang: string;
  translation: { text: string; provider: string; degraded: boolean };
}): Promise<{ success: boolean; ru?: number; error?: string }> {
  try {
    const container = await getContainer("messages");
    if (!container) return { success: false, error: "Messages container unavailable" };

    const { eventId, sessionId, lang, translation } = params;

    try {
      const patchRes = await container.item(eventId, sessionId).patch([
        {
          op: "add",
          path: `/translations/${lang}`,
          value: {
            text: translation.text,
            provider: translation.provider || "unknown",
            degraded: Boolean(translation.degraded)
          }
        }
      ]);
      cosmosHealthState.lastWriteOk = true;
      cosmosHealthState.lastError = null;
      cosmosHealthState.reachable = true;
      return { success: true, ru: patchRes.requestCharge };
    } catch (patchErr: any) {
      // Fallback to read-modify-write upsert
      return upsertFinalizedThoughtDocument({
        eventId,
        sessionId,
        speakerId: "",
        speakerName: "",
        originalText: "",
        sourceLang: "",
        translations: { [lang]: translation }
      });
    }
  } catch (err: any) {
    cosmosHealthState.lastWriteOk = false;
    cosmosHealthState.lastError = err?.message || String(err);
    console.error("[CosmosDB][PATCH_ERROR]", err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Upsert session metadata document in Cosmos DB on session creation.
 * Hashes hostToken using SHA-256 for secure verification.
 */
export async function upsertSessionDocument(params: {
  sessionId: string;
  topic?: string;
  isDuoMode?: boolean;
  createdAt?: number;
  hostToken?: string;
  hostTokenHash?: string;
}): Promise<{ success: boolean; ru?: number; error?: string }> {
  try {
    const container = await getContainer("sessions");
    if (!container) return { success: false, error: "Sessions container unavailable" };

    const now = params.createdAt || Date.now();
    const tokenHash = params.hostTokenHash || (params.hostToken ? crypto.createHash("sha256").update(params.hostToken).digest("hex") : undefined);

    const docToUpsert = {
      id: params.sessionId,
      topic: params.topic || "",
      isDuoMode: Boolean(params.isDuoMode),
      createdAt: now,
      hostTokenHash: tokenHash
    };

    const res = await container.items.upsert(docToUpsert);
    cosmosHealthState.lastWriteOk = true;
    cosmosHealthState.lastError = null;
    cosmosHealthState.reachable = true;
    return { success: true, ru: res.requestCharge };
  } catch (err: any) {
    cosmosHealthState.lastWriteOk = false;
    cosmosHealthState.lastError = err?.message || String(err);
    console.error("[CosmosDB][SESSION_UPSERT_ERROR]", err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Hydrates session metadata & latest 100 messages from Cosmos DB when a session is not in memory.
 */
export async function loadSessionFromCosmos(sessionId: string): Promise<{
  sessionDoc: any | null;
  messages: any[];
  ru?: number;
  error?: string;
}> {
  try {
    const sessionsContainer = await getContainer("sessions");
    const messagesContainer = await getContainer("messages");
    if (!sessionsContainer || !messagesContainer) {
      return { sessionDoc: null, messages: [], error: "Cosmos containers unavailable" };
    }

    let sessionDoc: any = null;
    let totalRu = 0;
    try {
      const sessRes = await sessionsContainer.item(sessionId, sessionId).read();
      sessionDoc = sessRes.resource || null;
      if (sessRes.requestCharge) totalRu += sessRes.requestCharge;
    } catch (sErr: any) {
      // Not found is expected if session record wasn't persisted
    }

    const querySpec = {
      query: "SELECT * FROM c WHERE c.sessionId = @sessionId ORDER BY c.timestamp DESC OFFSET 0 LIMIT 100",
      parameters: [{ name: "@sessionId", value: sessionId }]
    };

    const { resources, requestCharge } = await messagesContainer.items.query(querySpec, { partitionKey: sessionId }).fetchAll();
    if (requestCharge) totalRu += requestCharge;

    cosmosHealthState.reachable = true;
    cosmosHealthState.lastError = null;

    const sortedMessages = (resources || []).reverse();

    return {
      sessionDoc,
      messages: sortedMessages,
      ru: totalRu
    };
  } catch (err: any) {
    cosmosHealthState.reachable = false;
    cosmosHealthState.lastError = err?.message || String(err);
    console.error("[CosmosDB][LOAD_SESSION_ERROR]", err);
    return { sessionDoc: null, messages: [], error: err?.message || String(err) };
  }
}


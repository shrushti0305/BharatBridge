import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "http";
import crypto from "crypto";
import { TtsAudioCache, createRateLimiter } from "../server";

describe("FIX 4: TTS Stampede Prevention, Bounded LRU Cache & Rate Limiting Proof", () => {
  let cache: TtsAudioCache;

  beforeEach(() => {
    cache = new TtsAudioCache({ maxEntries: 5, maxBytes: 1024 * 1024, ttlMs: 1000 });
  });

  test("50 concurrent requests: in-flight de-duplication invokes synthesizer exactly ONCE", async () => {
    let callCount = 0;
    const testKey = cache.getCacheKey("नमस्ते भारत", "hi", "hi-IN-SwaraNeural");

    async function mockSynthesize() {
      callCount++;
      // Simulate 50ms processing latency
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        audio: Buffer.from("MOCK_AUDIO_DATA_FOR_SPEECH").toString("base64"),
        format: "audio/mp3",
        provider: "mock-azure-tts",
        byteSize: 26,
        truncated: false
      };
    }

    // Launch 50 concurrent synthesis calls for the same sentence
    const concurrentPromises = Array.from({ length: 50 }, () =>
      cache.getOrSynthesize(testKey, mockSynthesize)
    );

    const results = await Promise.all(concurrentPromises);

    assert.equal(results.length, 50, "All 50 promises must resolve");
    assert.equal(callCount, 1, "Underlying synthesizer must be called exactly ONCE across all 50 concurrent requests");

    const expectedAudio = Buffer.from("MOCK_AUDIO_DATA_FOR_SPEECH").toString("base64");
    for (const r of results) {
      assert.equal(r.audio, expectedAudio, "All 50 callers must receive the identical synthesized audio");
      assert.equal(r.provider, "mock-azure-tts");
    }

    // 51st sequential call must hit cache immediately (callCount still 1)
    const subsequent = await cache.getOrSynthesize(testKey, mockSynthesize);
    assert.equal(callCount, 1, "Cached entry must not invoke synthesizer again");
    assert.equal(subsequent.audio, expectedAudio);
  });

  test("Failures are NOT cached: subsequent requests retry synthesis", async () => {
    let callCount = 0;
    const testKey = cache.getCacheKey("एरर टेस्ट", "hi");

    async function failingSynthesize(): Promise<any> {
      callCount++;
      throw new Error("Azure TTS 503 Service Unavailable");
    }

    // First attempt fails
    await assert.rejects(
      async () => cache.getOrSynthesize(testKey, failingSynthesize),
      /Azure TTS 503 Service Unavailable/
    );
    assert.equal(callCount, 1);

    // Cache should not hold failed result
    assert.equal(cache.get(testKey), null, "Failed synthesis must not be stored in cache");

    // Next attempt retries synthesizer
    let secondAttemptInvoked = false;
    const result = await cache.getOrSynthesize(testKey, async () => {
      secondAttemptInvoked = true;
      return {
        audio: "RECOVERED_AUDIO",
        format: "audio/mp3",
        provider: "google-tts-fallback"
      };
    });

    assert.ok(secondAttemptInvoked, "Subsequent attempt must retry synthesis instead of returning cached failure");
    assert.equal(result.audio, "RECOVERED_AUDIO");
  });

  test("LRU eviction drops oldest entry when maxEntries is reached", () => {
    const smallCache = new TtsAudioCache({ maxEntries: 2, ttlMs: 10000 });

    smallCache.set("key1", { audio: "audio_1", provider: "p" });
    smallCache.set("key2", { audio: "audio_2", provider: "p" });

    assert.ok(smallCache.get("key1"));
    assert.ok(smallCache.get("key2"));

    // Access key1 so key2 becomes the least recently used
    smallCache.get("key1");

    // Add key3, which should evict key2
    smallCache.set("key3", { audio: "audio_3", provider: "p" });

    assert.ok(smallCache.get("key1"), "key1 should remain (accessed recently)");
    assert.equal(smallCache.get("key2"), null, "key2 should be evicted (LRU)");
    assert.ok(smallCache.get("key3"), "key3 should be present");
  });

  test("HTTP integration: 50 concurrent HTTP POST /api/azure/tts requests invoke synthesis once", async () => {
    const app = express();
    app.use(express.json());

    let synthesisInvocations = 0;
    const httpTtsCache = new TtsAudioCache();
    const rateLimiter = createRateLimiter(100, 100, 60000);

    const validSessionId = "session_test_50";
    const validSessionToken = "valid_token_xyz_123";

    app.post("/api/azure/tts", rateLimiter, async (req, res) => {
      const { text, languageCode, sessionId, token } = req.body;
      if (!sessionId || sessionId !== validSessionId) {
        return res.status(400).json({ error: "Invalid sessionId" });
      }
      if (token !== validSessionToken) {
        return res.status(403).json({ error: "Forbidden: sessionToken required" });
      }

      const key = httpTtsCache.getCacheKey(text, languageCode);
      try {
        const result = await httpTtsCache.getOrSynthesize(key, async () => {
          synthesisInvocations++;
          await new Promise((r) => setTimeout(r, 40));
          return {
            audio: Buffer.from("SYNTHESIZED_SPEECH_DATA").toString("base64"),
            format: "audio/mp3",
            provider: "azure-tts",
            truncated: false
          };
        });
        return res.status(200).json({ ...result, eventId: req.body.eventId || "evt-123" });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    try {
      const requests = Array.from({ length: 50 }, (_, i) =>
        fetch(`http://127.0.0.1:${port}/api/azure/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: "स्वागत है भारतब्रिज में",
            languageCode: "hi-IN",
            sessionId: validSessionId,
            token: validSessionToken,
            eventId: `evt-${i}`
          })
        })
      );

      const responses = await Promise.all(requests);
      assert.equal(responses.length, 50);

      for (let i = 0; i < responses.length; i++) {
        const resp = responses[i];
        assert.equal(resp.status, 200, `Request ${i} should return 200 OK`);
        const json = await resp.json();
        assert.equal(json.provider, "azure-tts");
        assert.equal(json.audio, Buffer.from("SYNTHESIZED_SPEECH_DATA").toString("base64"));
        assert.equal(json.eventId, `evt-${i}`);
      }

      assert.equal(synthesisInvocations, 1, "Underlying TTS engine must be invoked exactly ONCE for 50 concurrent requests");
    } finally {
      server.close();
    }
  });

  test("Rate limiting: triggers 429 when IP or session limit is exceeded", async () => {
    const app = express();
    app.use(express.json());

    // Strict rate limiter: max 5 requests per IP
    const strictLimiter = createRateLimiter(5, 5, 10000);
    app.post("/api/azure/tts", strictLimiter, (req, res) => {
      res.json({ ok: true });
    });

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    try {
      // Send 5 successful requests
      for (let i = 0; i < 5; i++) {
        const res = await fetch(`http://127.0.0.1:${port}/api/azure/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: "sess-1" })
        });
        assert.equal(res.status, 200);
      }

      // 6th request should be rate-limited with 429
      const rateLimitedRes = await fetch(`http://127.0.0.1:${port}/api/azure/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "sess-1" })
      });
      assert.equal(rateLimitedRes.status, 429);
      const data = await rateLimitedRes.json();
      assert.ok(data.error.includes("Too many requests"));
    } finally {
      server.close();
    }
  });
});

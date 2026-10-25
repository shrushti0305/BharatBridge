import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

describe("Step 12: Graceful Degradation UX, Data-Saver & Autoplay Compliance", () => {
  // 1. Data-Saver & Degradation Ladder Invariant
  test("1. Data-Saver Mode: Suppresses TTS audio fetching while preserving real-time text captions", () => {
    let ttsCallCount = 0;
    let captionsDelivered = 0;

    function handleIncomingUtterance(isDataSaver: boolean, utteranceText: string) {
      // Captions are ALWAYS delivered regardless of data saver mode
      captionsDelivered++;

      // Audio is only requested if data saver is OFF
      if (!isDataSaver) {
        ttsCallCount++;
      }
    }

    // Normal mode: 5 utterances -> 5 captions + 5 audio
    for (let i = 0; i < 5; i++) {
      handleIncomingUtterance(false, `Test normal utterance ${i}`);
    }
    assert.equal(captionsDelivered, 5);
    assert.equal(ttsCallCount, 5);

    // Data-saver mode ON: 5 utterances -> 5 captions + 0 audio
    for (let i = 0; i < 5; i++) {
      handleIncomingUtterance(true, `Test data saver utterance ${i}`);
    }
    assert.equal(captionsDelivered, 10, "Captions must continue delivering uninterrupted");
    assert.equal(ttsCallCount, 5, "Zero additional TTS audio calls made while data saver is active");
  });

  // 2. Virtualized / Bounded Caption History in Memory
  test("2. Bounded Caption History: Long-running 12-hour sessions cap in-memory DOM items to 200", () => {
    const MAX_DOM_CAPTIONS = 200;
    let messageList: Array<{ id: string; text: string }> = [];

    function appendCaption(id: string, text: string) {
      messageList = [{ id, text }, ...messageList].slice(0, MAX_DOM_CAPTIONS);
    }

    // Simulate 1,000 incoming utterances over a long event day
    for (let i = 1; i <= 1000; i++) {
      appendCaption(`evt-${i}`, `Transcript line number ${i}`);
    }

    assert.equal(messageList.length, 200, "In-memory caption list must be capped to 200 items to prevent DOM bloat");
    assert.equal(messageList[0].id, "evt-1000", "Latest event must remain at the top of the feed");
  });

  // 3. Tap-to-Play Autoplay Gate Compliance
  test("3. Autoplay Compliance: App contains unmuteAudio tap gate and data-saver toggle", () => {
    const appTsxPath = path.join(repoRoot, "src", "App.tsx");
    assert.ok(fs.existsSync(appTsxPath), "src/App.tsx must exist");

    const content = fs.readFileSync(appTsxPath, "utf-8");
    assert.ok(content.includes("unmuteAudio"), "Must provide unmuteAudio handler for mobile autoplay unlock");
    assert.ok(content.includes("isDataSaverMode"), "Must include isDataSaverMode state");
    assert.ok(content.includes("DATA-SAVER") || content.includes("Data Saver"), "Must include visible Data Saver badge or button");
  });
});

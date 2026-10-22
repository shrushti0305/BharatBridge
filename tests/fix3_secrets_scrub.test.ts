import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

import { fileURLToPath } from "node:url";

describe("FIX 3: Secrets Scrub & Repo Hygiene Verification", () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

  test("verifies that .env is ignored by git", () => {
    try {
      const output = execSync("git check-ignore .env", { cwd: repoRoot, encoding: "utf8" }).trim();
      assert.equal(output, ".env", ".env should be reported as ignored by git");
    } catch (err: any) {
      assert.fail(`git check-ignore .env failed with: ${err.message}`);
    }
  });

  test("verifies that .env.example contains only safe placeholders", () => {
    const envExamplePath = path.join(repoRoot, ".env.example");
    assert.ok(fs.existsSync(envExamplePath), ".env.example must exist");
    const content = fs.readFileSync(envExamplePath, "utf8");

    // Must not contain unscrubbed dummy passwords or real-looking tokens
    assert.ok(!content.includes("change-me-long-random"), ".env.example should not contain change-me-long-random");

    // Secret pattern checks
    const highEntropySkKey = /sk_[A-Za-z0-9]{25,}/;
    const realAzureAccountKey = /AccountKey=[A-Za-z0-9+/]{40,}={1,2}/;
    const privateKeyBlock = /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/;
    const googleApiKey = /AIza[0-9A-Za-z-_]{35}/;

    assert.ok(!highEntropySkKey.test(content), ".env.example must not contain secret sk_ keys");
    assert.ok(!realAzureAccountKey.test(content), ".env.example must not contain real Azure AccountKey");
    assert.ok(!privateKeyBlock.test(content), ".env.example must not contain private key blocks");
    assert.ok(!googleApiKey.test(content), ".env.example must not contain live Google API keys");

    // Verify all credential variables use safe placeholder patterns (e.g. YOUR_*)
    const lines = content.split("\n");
    let credentialCount = 0;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) {
        const [_, key, val] = match;
        const cleanVal = val.replace(/^["']|["']$/g, "").trim();
        if (/(KEY|TOKEN|SALT|SECRET|PASSWORD)$/.test(key)) {
          credentialCount++;
          assert.ok(
            cleanVal.startsWith("YOUR_"),
            `Credential variable ${key} in .env.example must use a YOUR_* placeholder, found: ${cleanVal}`
          );
        }
      }
    }
    assert.ok(credentialCount >= 3, `Expected at least 3 credential placeholder variables in .env.example, found ${credentialCount}`);
  });

  test("scans all git-tracked files for potential secret leaks", () => {
    const trackedFiles = execSync("git ls-files", { cwd: repoRoot, encoding: "utf8" })
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);

    assert.ok(trackedFiles.length > 0, "Repo must contain tracked files");

    const issues: { file: string; line: number; type: string }[] = [];

    // Patterns for dangerous private secrets
    const highEntropySkKey = /sk_[A-Za-z0-9]{25,}/;
    const realAzureAccountKey = /AccountKey=[A-Za-z0-9+/]{40,}={1,2}/;
    const privateKeyBlock = /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/;

    for (const relPath of trackedFiles) {
      const fullPath = path.join(repoRoot, relPath);
      if (!fs.existsSync(fullPath)) continue;
      
      // Skip binary files and test files
      if (relPath.endsWith(".png") || relPath.endsWith(".ico") || relPath.endsWith(".pdf") || relPath.startsWith("tests/")) {
        continue;
      }

      let content = "";
      try {
        content = fs.readFileSync(fullPath, "utf8");
      } catch {
        continue;
      }

      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (highEntropySkKey.test(line) && !line.includes("your_smallest_key_here") && !line.includes("your-")) {
          issues.push({ file: relPath, line: i + 1, type: "Potential Secret Key (sk_...)" });
        }
        if (realAzureAccountKey.test(line) && !line.includes("YOUR_ACCOUNT_KEY")) {
          issues.push({ file: relPath, line: i + 1, type: "Real Azure Storage Account Key" });
        }
        if (privateKeyBlock.test(line)) {
          issues.push({ file: relPath, line: i + 1, type: "Private Key PEM block" });
        }
      }
    }

    assert.deepEqual(issues, [], `Found potential secret leaks in tracked files: ${JSON.stringify(issues)}`);
  });
});

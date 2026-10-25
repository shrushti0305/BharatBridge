import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

describe("SEC-02 & CLI-01: Client Bundle & LocalStorage Admin Token Scrub", () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

  test("verifies src/App.tsx does not reference VITE_ADMIN_TOKEN (SEC-02)", () => {
    const appTsxPath = path.join(repoRoot, "src", "App.tsx");
    assert.ok(fs.existsSync(appTsxPath), "src/App.tsx must exist");
    const content = fs.readFileSync(appTsxPath, "utf8");
    assert.ok(
      !content.includes("VITE_ADMIN_TOKEN"),
      "src/App.tsx must not contain any reference to VITE_ADMIN_TOKEN"
    );
  });

  test("verifies src/vite-env.d.ts does not declare VITE_ADMIN_TOKEN (SEC-02)", () => {
    const dtsPath = path.join(repoRoot, "src", "vite-env.d.ts");
    assert.ok(fs.existsSync(dtsPath), "src/vite-env.d.ts must exist");
    const content = fs.readFileSync(dtsPath, "utf8");
    assert.ok(
      !content.includes("VITE_ADMIN_TOKEN"),
      "src/vite-env.d.ts must not declare VITE_ADMIN_TOKEN"
    );
  });

  test("verifies client does not read bharat_bridge_admin_token from localStorage (CLI-01)", () => {
    const appTsxPath = path.join(repoRoot, "src", "App.tsx");
    const content = fs.readFileSync(appTsxPath, "utf8");
    assert.ok(
      !content.includes("bharat_bridge_admin_token"),
      "src/App.tsx must not read or write bharat_bridge_admin_token in localStorage"
    );
  });

  test("verifies no file under src/ references VITE_ADMIN_TOKEN or bharat_bridge_admin_token", () => {
    const srcDir = path.join(repoRoot, "src");
    const walk = (dir: string): string[] => {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat && stat.isDirectory()) {
          results = results.concat(walk(full));
        } else if (file.endsWith(".ts") || file.endsWith(".tsx") || file.endsWith(".js") || file.endsWith(".html")) {
          results.push(full);
        }
      });
      return results;
    };

    const files = walk(srcDir);
    assert.ok(files.length > 0, "Source files must exist in src/");
    for (const f of files) {
      const code = fs.readFileSync(f, "utf8");
      assert.ok(!code.includes("VITE_ADMIN_TOKEN"), `${f} contains VITE_ADMIN_TOKEN`);
      assert.ok(!code.includes("bharat_bridge_admin_token"), `${f} contains bharat_bridge_admin_token`);
    }
  });
});

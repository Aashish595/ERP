import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve("src");

describe("full backend architecture", () => {
  it("keeps explicit model files for every original persistence domain", () => {
    const files = readdirSync(path.join(root, "models")).filter((name) => name.endsWith(".model.ts"));
    expect(files.length).toBeGreaterThanOrEqual(24);
    const definitions = files.flatMap((name) => readFileSync(path.join(root, "models", name), "utf8").match(/table:\s*"[^"]+"/g) ?? []);
    expect(definitions.length).toBe(52);
  });

  it("includes repository, service, controller, validator, and route layers", () => {
    expect(readdirSync(path.join(root, "repositories")).filter((name) => name.endsWith(".repository.ts")).length).toBeGreaterThanOrEqual(20);
    expect(readdirSync(path.join(root, "services")).filter((name) => name.endsWith(".service.ts")).length).toBeGreaterThanOrEqual(20);
    expect(readdirSync(path.join(root, "controllers", "domain")).filter((name) => name.endsWith(".controller.ts")).length).toBeGreaterThanOrEqual(20);
    expect(readdirSync(path.join(root, "validators")).filter((name) => name.endsWith(".validation.ts")).length).toBeGreaterThanOrEqual(20);
    expect(readdirSync(path.join(root, "routes", "domain")).filter((name) => name.endsWith(".routes.ts")).length).toBeGreaterThanOrEqual(20);
  });

  it("keeps top-level route files thin", () => {
    const directory = path.join(root, "routes");
    for (const filename of readdirSync(directory).filter((name) => name.endsWith(".ts"))) {
      const lines = readFileSync(path.join(directory, filename), "utf8").trim().split(/\r?\n/).length;
      expect(lines, filename).toBeLessThanOrEqual(3);
    }
  });

  it("tracks every original FastAPI endpoint contract", () => {
    const manifest = JSON.parse(readFileSync(path.resolve("route-contracts.json"), "utf8")) as { total: number; contracts: unknown[] };
    expect(manifest.total).toBe(255);
    expect(manifest.contracts).toHaveLength(255);
  });
});

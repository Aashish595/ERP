import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Contract = { method: string; path: string };
type RouteLayer = { route?: { path: string | string[]; methods: Record<string, boolean> } };

function normalizePath(value: string) {
  const normalized = value.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, "{}").replace(/\{[^}]+\}/g, "{}").replace(/\/$/, "");
  return normalized || "/";
}

describe("FastAPI route compatibility", () => {
  it("registers every original method and public path in Express", async () => {
    process.env.DATABASE_URL ||= "postgresql://test:test@localhost/test";
    process.env.JWT_SECRET ||= "test-secret-that-is-at-least-32-characters";
    process.env.AI_SERVICE_TOKEN ||= "test-service-token-at-least-24-chars";
    const { applicationRouters } = await import("./app.js");
    const actual = new Set<string>();

    for (const { path: mountPath, router } of applicationRouters) {
      for (const layer of router.stack as RouteLayer[]) {
        if (!layer.route) continue;
        const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
        for (const method of Object.keys(layer.route.methods)) {
          for (const routePath of paths) actual.add(`${method.toUpperCase()} ${normalizePath(`${mountPath}${routePath}`)}`);
        }
      }
    }

    const manifest = JSON.parse(readFileSync(path.resolve("route-contracts.json"), "utf8")) as { total: number; contracts: Contract[] };
    const expected = new Set(manifest.contracts.map(({ method, path: routePath }) => `${method} ${normalizePath(routePath)}`));
    const missing = [...expected].filter((contract) => !actual.has(contract));
    expect(missing, `Missing Express routes:\n${missing.join("\n")}`).toEqual([]);
  });
});

import { describe, expect, it, vi } from "vitest";
import core from "../../src/core";
import type { CoreEnv } from "../../src/env";

const ALLOWED_ORIGIN = "https://studio-go.example";

function envWithState(response: Response): CoreEnv {
  const stub = { fetch: vi.fn(async () => response) };
  return {
    ALLOWED_ORIGIN,
    PATH_STATE: {
      idFromName: vi.fn(() => ({ toString: () => "session-id" })),
      get: vi.fn(() => stub)
    }
  } as unknown as CoreEnv;
}

async function fetchCore(request: Request, env: CoreEnv): Promise<Response> {
  if (typeof core.fetch !== "function") throw new Error("CORE_FETCH_UNAVAILABLE");
  return core.fetch(request, env, {} as ExecutionContext);
}

describe("session polling CORS", () => {
  it("adds exact-origin CORS headers to successful GET responses", async () => {
    const response = await fetchCore(
      new Request("https://path.example/sessions/session-id", {
        headers: { origin: ALLOWED_ORIGIN }
      }),
      envWithState(Response.json({ status: "open" }))
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(ALLOWED_ORIGIN);
    expect(response.headers.get("vary")).toBe("Origin");
  });

  it("preserves state errors while adding exact-origin CORS headers", async () => {
    const response = await fetchCore(
      new Request("https://path.example/sessions/missing", {
        headers: { origin: ALLOWED_ORIGIN }
      }),
      envWithState(Response.json({ error: "NOT_FOUND" }, { status: 404 }))
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("access-control-allow-origin")).toBe(ALLOWED_ORIGIN);
    expect(response.headers.get("vary")).toBe("Origin");
  });

  it("denies polling from an unapproved origin", async () => {
    const response = await fetchCore(
      new Request("https://path.example/sessions/session-id", {
        headers: { origin: "https://unapproved.example" }
      }),
      envWithState(Response.json({ status: "open" }))
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    await expect(response.json()).resolves.toEqual({ error: "ORIGIN_DENIED" });
  });
});

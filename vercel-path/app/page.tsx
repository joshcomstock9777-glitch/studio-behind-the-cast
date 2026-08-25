"use client";

import { useState } from "react";

type Proof = { sessionId?: string; correlationId?: string; status?: string; calls?: number; transcript?: unknown[]; error?: string };

export default function Page() {
  const [state, setState] = useState("Ready to test");
  const [proof, setProof] = useState<Proof | null>(null);

  async function runProof() {
    setState("Starting Path session…");
    setProof(null);
    try {
      const created = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: "allie", message: "Josh Vercel Path proof" })
      });
      const seed = await created.json() as Proof;
      if (!created.ok || !seed.sessionId) throw new Error(seed.error || `POST_${created.status}`);
      setState(`Polling ${seed.sessionId}…`);
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const response = await fetch(`/api/sessions/${seed.sessionId}`);
        const current = await response.json() as Proof;
        if (!response.ok) throw new Error(current.error || `GET_${response.status}`);
        setProof(current);
        if (current.status === "final" || current.status === "error") {
          setState(current.status === "final" ? "PASS — terminal response returned" : "FAIL — Path returned error");
          return;
        }
      }
      throw new Error("POLL_TIMEOUT");
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      setState(`FAIL — ${message}`);
    }
  }

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 760, margin: "40px auto", padding: 24 }}>
      <h1>Moonshadow Path proof</h1>
      <p>Private deterministic transport test. No AI model calls.</p>
      <button onClick={runProof} style={{ padding: "12px 18px", fontSize: 16 }}>Run Allie → Amber → Allie proof</button>
      <h2>{state}</h2>
      {proof && <pre style={{ whiteSpace: "pre-wrap", background: "#111", color: "#eee", padding: 16 }}>{JSON.stringify(proof, null, 2)}</pre>}
    </main>
  );
}

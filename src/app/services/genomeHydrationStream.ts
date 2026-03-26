/**
 * Progressive Context Hydration — SSE streaming client.
 *
 * Connects to the /transform-stream or /run-translation-stream endpoints
 * and dispatches events as the LLM iteratively fetches and processes genome files.
 */

import type { FilesystemPlan } from "../store/useGenomeStore";

export interface HydrationPhase {
  phase: string;
  message: string;
}

export interface FileFetched {
  path: string;
  size: number;
  round: number;
  error?: string;
}

export interface LLMReasoning {
  message: string;
  round: number;
  files_requested?: string[];
}

export interface HydrationComplete {
  rounds: number;
  files_fetched: number;
  total_context_chars: number;
  total_input_tokens: number;
  total_output_tokens: number;
}

export interface HydrationResult {
  reasoning: string[];
  explanation: string;
  filesystem_plan: FilesystemPlan | null;
  diff: string;
  preview: string;
}

export interface HydrationHandlers {
  onPhase?: (data: HydrationPhase) => void;
  onFileFetched?: (data: FileFetched) => void;
  onReasoning?: (data: LLMReasoning) => void;
  onHydrationComplete?: (data: HydrationComplete) => void;
  onResult?: (data: HydrationResult) => void;
  onError?: (data: { message: string; raw_response?: string }) => void;
}

function parseSSE(chunk: string): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];
  const blocks = chunk.split("\n\n").filter(Boolean);
  for (const block of blocks) {
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7);
      else if (line.startsWith("data: ")) data = line.slice(6);
    }
    if (data) events.push({ event, data });
  }
  return events;
}

function dispatch(event: string, raw: string, handlers: HydrationHandlers) {
  try {
    const data = JSON.parse(raw);
    switch (event) {
      case "phase":
        handlers.onPhase?.(data);
        break;
      case "file_fetched":
        handlers.onFileFetched?.(data);
        break;
      case "llm_reasoning":
        handlers.onReasoning?.(data);
        break;
      case "hydration_complete":
        handlers.onHydrationComplete?.(data);
        break;
      case "result":
        handlers.onResult?.(data);
        break;
      case "error":
        handlers.onError?.(data);
        break;
    }
  } catch {
    // ignore parse errors
  }
}

async function streamFromEndpoint(
  url: string,
  body: Record<string, unknown>,
  handlers: HydrationHandlers,
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    try {
      const err = JSON.parse(text);
      handlers.onError?.({ message: err.error || err.detail || "Stream request failed" });
    } catch {
      handlers.onError?.({ message: `HTTP ${res.status}: ${text.slice(0, 200)}` });
    }
    return;
  }

  // Check if it's a JSON error response (not SSE)
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await res.json();
    if (data.status === "error") {
      handlers.onError?.({ message: data.error || "Unknown error" });
    }
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    handlers.onError?.({ message: "No response body" });
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE blocks (separated by \n\n)
    while (buffer.includes("\n\n")) {
      const idx = buffer.indexOf("\n\n");
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const events = parseSSE(block + "\n\n");
      for (const e of events) {
        dispatch(e.event, e.data, handlers);
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim()) {
    const events = parseSSE(buffer + "\n\n");
    for (const e of events) {
      dispatch(e.event, e.data, handlers);
    }
  }
}

export function streamGenomeTransform(
  path: string,
  content: string,
  prompt: string,
  handlers: HydrationHandlers,
): Promise<void> {
  return streamFromEndpoint("/api/genome/transform-stream", { path, content, prompt }, handlers);
}

export function streamGenomeTranslation(
  translationId: string,
  path: string,
  content: string,
  handlers: HydrationHandlers,
): Promise<void> {
  return streamFromEndpoint(
    "/api/genome/run-translation-stream",
    { translation_id: translationId, path, content },
    handlers,
  );
}

export interface StreamHandlers {
  onRunStarted?: (data: { run_id: string }) => void;
  onReasoning?: (msg: string) => void;
  onUseCase?: (data: { name: string; description: string; confidence: number }) => void;
  onSkillStarted?: (data: { skill: string }) => void;
  onToolCalled?: (data: { tool: string; skill: string }) => void;
  onToolResult?: (data: { tool: string; skill: string; summary: string; status: string }) => void;
  onSkillCompleted?: (data: { skill: string }) => void;
  onFinalResult?: (data: { result: string; confidence: number }) => void;
  onError?: (err: unknown) => void;
}

export function streamAgent(
  tenantId: string,
  prompt: string,
  handlers: StreamHandlers,
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`/api/admin/${tenantId}/agent/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events (separated by double newline)
        const parts = buffer.split('\n\n');
        // Keep the last part as it may be incomplete
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (!part.trim()) continue;

          let eventType = '';
          let dataStr = '';

          for (const line of part.split('\n')) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              dataStr += line.slice(6);
            }
          }

          if (!eventType || !dataStr) continue;

          let data: unknown;
          try {
            data = JSON.parse(dataStr);
          } catch {
            continue;
          }

          switch (eventType) {
            case 'run_started':
              handlers.onRunStarted?.(data as { run_id: string });
              break;
            case 'reasoning':
              handlers.onReasoning?.((data as { message: string }).message);
              break;
            case 'use_case_selected':
              handlers.onUseCase?.(data as { name: string; description: string; confidence: number });
              break;
            case 'skill_started':
              handlers.onSkillStarted?.(data as { skill: string });
              break;
            case 'tool_called':
              handlers.onToolCalled?.(data as { tool: string; skill: string });
              break;
            case 'tool_result':
              handlers.onToolResult?.(data as { tool: string; skill: string; summary: string; status: string });
              break;
            case 'skill_completed':
              handlers.onSkillCompleted?.(data as { skill: string });
              break;
            case 'final_result':
              handlers.onFinalResult?.(data as { result: string; confidence: number });
              break;
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      handlers.onError?.(err);
    }
  })();

  return () => controller.abort();
}

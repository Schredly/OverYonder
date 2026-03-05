import { useState, useEffect, useRef } from "react";
import { TopBar } from "../components/agentui/TopBar";
import { ChatMessage } from "../components/agentui/ChatMessage";
import { InputPanel } from "../components/agentui/InputPanel";
import { AgentReasoning, type ReasoningStep } from "../components/agentui/AgentReasoning";
import { SelectedUseCase } from "../components/agentui/SelectedUseCase";
import { SkillExecutionTimeline, type SkillExecution } from "../components/agentui/SkillExecutionTimeline";
import { ToolsUsed, type ToolCall } from "../components/agentui/ToolsUsed";
import { AIRecommendation, type SuggestedAction } from "../components/agentui/AIRecommendation";
import { AgentActions, type ActionType } from "../components/agentui/AgentActions";
import { streamAgent } from "../services/agentStream";

interface Message {
  id: string;
  type: "user" | "agent-structured";
  content: string;
  timestamp: string;
  result?: string;
}

export default function AgentUIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [narrowViewport, setNarrowViewport] = useState(false);

  // Response data for the right panel
  const [reasoningSteps, setReasoningSteps] = useState<ReasoningStep[]>([]);
  const [selectedUseCase, setSelectedUseCase] = useState<{ name: string; description: string; confidence: number } | null>(null);
  const [skillExecutions, setSkillExecutions] = useState<SkillExecution[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [recommendation, setRecommendation] = useState<{ resolution: string; confidence: number; actions: SuggestedAction[] } | null>(null);
  const [executionTime, setExecutionTime] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  const cancelRef = useRef<(() => void) | null>(null);
  const reasoningCountRef = useRef(0);
  const skillCountRef = useRef(0);
  const toolCountRef = useRef(0);

  useEffect(() => {
    const check = () => setNarrowViewport(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleSendMessage = (content: string) => {
    // Cancel any in-flight stream
    cancelRef.current?.();

    const userMsg: Message = {
      id: Date.now().toString(),
      type: "user",
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Clear previous response
    setReasoningSteps([]);
    setSelectedUseCase(null);
    setSkillExecutions([]);
    setToolCalls([]);
    setRecommendation(null);
    setExecutionTime(null);
    setRunId(null);
    reasoningCountRef.current = 0;
    skillCountRef.current = 0;
    toolCountRef.current = 0;

    const t0 = performance.now();
    const iconForIndex = (i: number) => i === 0 ? "search" : i === 1 ? "target" : i === 2 ? "check" : "zap";
    const skillIconForIndex = (i: number) => i === 0 ? "search" : i === 1 ? "book" : i === 2 ? "file" : "check";

    const cancel = streamAgent("acme", content, {
      onRunStarted: (data) => {
        setRunId(data.run_id);
      },

      onReasoning: (msg) => {
        const idx = reasoningCountRef.current++;
        setReasoningSteps((prev) => [
          ...prev,
          { id: `r${idx}`, label: msg, description: "", status: "completed", icon: iconForIndex(idx) },
        ]);
      },

      onUseCase: (data) => {
        setSelectedUseCase({
          name: data.name,
          description: data.description,
          confidence: Math.round(data.confidence * 100),
        });
      },

      onSkillStarted: (data) => {
        const idx = skillCountRef.current++;
        setSkillExecutions((prev) => [
          ...prev,
          {
            id: `sk${idx}`,
            name: data.skill,
            description: "",
            status: "running",
            duration: "",
            icon: skillIconForIndex(idx),
          },
        ]);
      },

      onToolCalled: (data) => {
        const idx = toolCountRef.current++;
        const prefix = data.tool.split(".")[0];
        const targetSystem = prefix === "servicenow" ? "ServiceNow" : prefix === "google-drive" ? "Google Drive" : prefix;
        setToolCalls((prev) => [
          ...prev,
          {
            id: `tc${idx}`,
            toolName: data.tool,
            targetSystem,
            status: "running",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            responseTime: "",
            statusCode: 0,
          },
        ]);
      },

      onToolResult: (data) => {
        setToolCalls((prev) => {
          // Find the last matching tool that is still running (handles duplicate tool names)
          const idx = prev.findLastIndex((tc) => tc.toolName === data.tool && tc.status === "running");
          if (idx === -1) return prev;
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            status: data.status === "error" ? "error" as const : "success" as const,
            statusCode: data.status === "error" ? 500 : 200,
            summary: data.summary,
          };
          return updated;
        });
      },

      onSkillCompleted: (data) => {
        setSkillExecutions((prev) =>
          prev.map((sk) =>
            sk.name === data.skill ? { ...sk, status: "completed" as const } : sk
          ),
        );
      },

      onFinalResult: (data) => {
        const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
        setExecutionTime(`${elapsed}s`);
        setRecommendation({
          resolution: data.result,
          confidence: Math.round(data.confidence * 100),
          actions: [],
        });

        const agentMsg: Message = {
          id: (Date.now() + 1).toString(),
          type: "agent-structured",
          content: "",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          result: data.result,
        };
        setMessages((prev) => [...prev, agentMsg]);
        setIsLoading(false);
      },

      onError: (err) => {
        const msg = err instanceof Error ? err.message : "Request failed";
        setReasoningSteps((prev) => [
          ...prev,
          { id: "err", label: "Error", description: msg, status: "failed" as any, icon: "search" },
        ]);
        setIsLoading(false);
      },
    });

    cancelRef.current = cancel;
  };

  const handleAgentAction = (type: ActionType) => {
    console.log("Agent action:", type);
  };

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a]">
      {/* Top Header */}
      <TopBar
        agentName="Enterprise AI Agent"
        tenant="Production - ACME Corp"
        status={isLoading ? "processing" : "connected"}
      />

      {/* Main Content Area - Two Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat Conversation Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
          {/* Scrollable chat area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.length === 0 && !isLoading && (
                <div className="flex items-center justify-center h-full min-h-[300px]">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#161616] border border-[#262626] flex items-center justify-center">
                      <svg className="w-8 h-8 text-[#a1a1aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </div>
                    <h3 className="text-[#fafafa] text-lg font-medium mb-1">Ask the Enterprise Agent</h3>
                    <p className="text-[#71717a] text-sm">Type a question about your systems, incidents, or documentation</p>
                  </div>
                </div>
              )}

              {messages.map((message) => {
                if (message.type === "user") {
                  return (
                    <ChatMessage
                      key={message.id}
                      type="user"
                      content={message.content}
                      timestamp={message.timestamp}
                    />
                  );
                }
                if (message.type === "agent-structured" && message.result) {
                  return (
                    <div key={message.id}>
                      <AIRecommendation
                        resolution={message.result}
                        confidence={94}
                        suggestedActions={[]}
                        additionalContext=""
                      />
                      <div className="mt-4">
                        <AgentActions onAction={handleAgentAction} runId={runId} />
                      </div>
                    </div>
                  );
                }
                return null;
              })}

              {isLoading && (
                <div className="flex items-center gap-3 text-[#a1a1aa] py-4">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="text-sm">Agent is thinking...</span>
                </div>
              )}
            </div>
          </div>

          {/* Fixed Input Panel at Bottom */}
          <InputPanel
            onSend={handleSendMessage}
            disabled={isLoading}
          />
        </div>

        {/* Right: Agent Execution Trace Panel (hidden at narrow viewports / high zoom) */}
        <div className={`w-96 border-l border-[#262626] bg-[#0a0a0a] flex flex-col ${narrowViewport ? "hidden" : ""}`}>
          {/* Panel Header */}
          <div className="px-4 py-3 border-b border-[#262626]">
            <h2 className="text-[#fafafa] text-sm font-medium flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? "bg-indigo-500 animate-pulse" : "bg-emerald-500"}`} />
              Execution Trace
            </h2>
            <p className="text-xs text-[#71717a] mt-1">
              Live agent reasoning and tool execution
            </p>
          </div>

          {/* Scrollable execution trace */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar">
            {reasoningSteps.length > 0 && (
              <div>
                <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-[0.08em] px-1">
                  Reasoning Steps
                </span>
                <div className="mt-2">
                  <AgentReasoning steps={reasoningSteps} />
                </div>
              </div>
            )}

            {selectedUseCase && (
              <div>
                <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-[0.08em] px-1">
                  Selected Use Case
                </span>
                <div className="mt-2">
                  <SelectedUseCase
                    name={selectedUseCase.name}
                    description={selectedUseCase.description}
                    confidence={selectedUseCase.confidence}
                    category="Enterprise Operations"
                  />
                </div>
              </div>
            )}

            {skillExecutions.length > 0 && (
              <div>
                <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-[0.08em] px-1">
                  Skills Executed
                </span>
                <div className="mt-2">
                  <SkillExecutionTimeline skills={skillExecutions} />
                </div>
              </div>
            )}

            {toolCalls.length > 0 && (
              <div>
                <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-[0.08em] px-1">
                  Tools & APIs
                </span>
                <div className="mt-2">
                  <ToolsUsed tools={toolCalls} />
                </div>
              </div>
            )}

            {!reasoningSteps.length && !isLoading && (
              <div className="flex items-center justify-center h-full text-center py-12">
                <div>
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#161616] border border-[#262626] flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#71717a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-[#71717a] text-sm">No execution trace yet</p>
                  <p className="text-[#71717a] text-xs mt-1">Ask a question to see the agent work</p>
                </div>
              </div>
            )}
          </div>

          {/* Trace Panel Footer */}
          {executionTime && (
            <div className="px-4 py-2.5 border-t border-[#262626]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#71717a]">Total execution time</span>
                <span className="text-emerald-400">{executionTime}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #262626;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #333;
        }
      `}</style>
    </div>
  );
}

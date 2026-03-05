import { ExternalLink, Play, BookOpen, RefreshCw, Zap, Loader2, CheckCircle2, Star, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

export type ActionType = string;

export interface AgentAction {
  id: string;
  type: ActionType;
  label: string;
  description?: string;
  enabled?: boolean;
  integration_id?: string;
  operation?: string;
  score?: number;
}

interface ExecutionResult {
  status: string;
  message?: string;
  number?: string;
  error?: string;
}

interface AgentActionsProps {
  actions?: AgentAction[];
  onAction?: (type: ActionType) => void;
  title?: string;
  runId?: string | null;
}

const API_BASE = "http://localhost:8000/api/admin/acme/actions";

function getActionIcon(integration: string) {
  switch (integration) {
    case "servicenow":
      return <ExternalLink className="w-4 h-4" />;
    case "jira":
    case "github":
      return <Play className="w-4 h-4" />;
    case "google-drive":
      return <BookOpen className="w-4 h-4" />;
    case "slack":
      return <RefreshCw className="w-4 h-4" />;
    default:
      return <Zap className="w-4 h-4" />;
  }
}

function getIndicatorColor(integration: string) {
  switch (integration) {
    case "servicenow":
      return "bg-emerald-500";
    case "jira":
    case "github":
      return "bg-indigo-500";
    case "google-drive":
      return "bg-violet-500";
    case "slack":
      return "bg-orange-500";
    default:
      return "bg-amber-500";
  }
}

function ActionButton({
  action,
  isRecommended,
  executingId,
  completedIds,
  resultMap,
  onClick,
}: {
  action: AgentAction;
  isRecommended?: boolean;
  executingId: string | null;
  completedIds: Set<string>;
  resultMap: Map<string, ExecutionResult>;
  onClick: (action: AgentAction) => void;
}) {
  const integration = action.integration_id || action.type;
  const disabled = action.enabled === false;
  const isExecuting = executingId === action.id;
  const isCompleted = completedIds.has(action.id);
  const result = resultMap.get(action.id);
  const isError = result?.status === "error" || result?.status === "not_implemented";
  const indicatorColor = getIndicatorColor(integration);

  function resultMessage(): string {
    if (!result) return "Completed";
    if (result.number) return `Created ${result.number}`;
    if (result.status === "not_implemented") return result.message || "Not connected";
    if (result.error) return `Error: ${result.error}`;
    if (result.status === "ok") return "Completed successfully";
    return "Completed";
  }

  return (
    <button
      onClick={() => onClick(action)}
      disabled={disabled || isExecuting}
      className={`group relative flex items-center gap-3 px-4 py-3 rounded-[10px] border transition-colors duration-150 ${
        isError
          ? "bg-[#161616] border-red-500/40"
          : isCompleted
          ? "bg-[#161616] border-emerald-500/40"
          : "bg-[#161616] border-[#262626] hover:bg-[#1c1c1c] hover:border-[#333]"
      } ${
        disabled || isExecuting
          ? "opacity-50 cursor-not-allowed"
          : ""
      }`}
    >
      {/* Indicator dot */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div className={`w-2 h-2 rounded-full ${
          isError ? "bg-red-500" : isCompleted ? "bg-emerald-500" : indicatorColor
        }`} />
        <div className="text-[#a1a1aa]">
          {isExecuting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isError ? (
            <AlertCircle className="w-4 h-4 text-red-400" />
          ) : isCompleted ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            getActionIcon(integration)
          )}
        </div>
      </div>

      {/* Text content */}
      <div className="flex-1 text-left">
        <div className="text-sm text-[#fafafa] flex items-center gap-1.5">
          {action.label}
          {isRecommended && !isCompleted && !isError && (
            <Star className="w-3 h-3 text-[#a1a1aa]" />
          )}
        </div>
        <div className="text-xs text-[#71717a] mt-0.5">
          {isExecuting
            ? "Executing..."
            : isCompleted || isError
            ? resultMessage()
            : action.description}
        </div>
      </div>
    </button>
  );
}

export function AgentActions({
  actions: propActions,
  onAction,
  title = "Agent Actions",
  runId,
}: AgentActionsProps) {
  const [recommendedActions, setRecommendedActions] = useState<AgentAction[]>([]);
  const [availableActions, setAvailableActions] = useState<AgentAction[]>([]);
  const [fallbackActions, setFallbackActions] = useState<AgentAction[]>([]);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [resultMap, setResultMap] = useState<Map<string, ExecutionResult>>(new Map());

  useEffect(() => {
    if (propActions) return;

    if (runId) {
      fetch(`${API_BASE}/recommendations/${runId}`)
        .then((r) => r.json())
        .then((data: { recommended: any[]; available: any[] }) => {
          setRecommendedActions(
            data.recommended.map((a) => ({
              id: a.id,
              type: a.integration_id || "internal",
              label: a.name,
              description: a.description,
              enabled: true,
              integration_id: a.integration_id,
              operation: a.operation,
              score: a.score,
            }))
          );
          setAvailableActions(
            data.available.map((a) => ({
              id: a.id,
              type: a.integration_id || "internal",
              label: a.name,
              description: a.description,
              enabled: true,
              integration_id: a.integration_id,
              operation: a.operation,
            }))
          );
          setFallbackActions([]);
        })
        .catch(() => {
          fetchAllActions();
        });
    } else {
      fetchAllActions();
    }
  }, [propActions, runId]);

  const fetchAllActions = () => {
    fetch(API_BASE)
      .then((r) => r.json())
      .then((data: any[]) => {
        setFallbackActions(
          data
            .filter((a) => a.status === "active")
            .map((a) => ({
              id: a.id,
              type: a.integration_id || "internal",
              label: a.name,
              description: a.description,
              enabled: true,
              integration_id: a.integration_id,
              operation: a.operation,
            }))
        );
        setRecommendedActions([]);
        setAvailableActions([]);
      })
      .catch(console.error);
  };

  const allActions = propActions ?? (
    recommendedActions.length > 0 || availableActions.length > 0
      ? [...recommendedActions, ...availableActions]
      : fallbackActions
  );

  const handleClick = async (action: AgentAction) => {
    if (onAction) onAction(action.type);
    setExecutingId(action.id);
    try {
      const res = await fetch(`${API_BASE}/${action.id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: runId || "", input: {} }),
      });
      const data = await res.json();
      setResultMap((prev) => new Map(prev).set(action.id, data));
    } catch (err) {
      setResultMap((prev) => new Map(prev).set(action.id, {
        status: "error",
        error: err instanceof Error ? err.message : "Network error",
      }));
    }
    setExecutingId(null);
    setCompletedIds((prev) => new Set(prev).add(action.id));
  };

  const hasRecommendations = recommendedActions.length > 0;

  return (
    <div className="bg-[#0a0a0a] border border-[#262626] rounded-[10px] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#262626]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[#fafafa] text-sm font-medium">{title}</h3>
            <p className="text-xs text-[#71717a] mt-0.5">
              {hasRecommendations
                ? "Context-aware actions based on agent analysis"
                : "Automated workflows and integrations"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#262626]">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-[#71717a]">Ready</span>
          </div>
        </div>
      </div>

      {/* Actions Grid */}
      <div className="p-4 space-y-4">
        {/* Recommended Section */}
        {hasRecommendations && (
          <div>
            <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-[0.08em]">
              Recommended Actions
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {recommendedActions.map((action) => (
                <ActionButton
                  key={action.id}
                  action={action}
                  isRecommended
                  executingId={executingId}
                  completedIds={completedIds}
                  resultMap={resultMap}
                  onClick={handleClick}
                />
              ))}
            </div>
          </div>
        )}

        {/* Other Actions */}
        {hasRecommendations && availableActions.length > 0 && (
          <div>
            <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-[0.08em]">
              Other Actions
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {availableActions.map((action) => (
                <ActionButton
                  key={action.id}
                  action={action}
                  executingId={executingId}
                  completedIds={completedIds}
                  resultMap={resultMap}
                  onClick={handleClick}
                />
              ))}
            </div>
          </div>
        )}

        {/* Fallback */}
        {!hasRecommendations && fallbackActions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {fallbackActions.map((action) => (
              <ActionButton
                key={action.id}
                action={action}
                executingId={executingId}
                completedIds={completedIds}
                resultMap={resultMap}
                onClick={handleClick}
              />
            ))}
          </div>
        )}

        {propActions && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {propActions.map((action) => (
              <ActionButton
                key={action.id}
                action={action}
                executingId={executingId}
                completedIds={completedIds}
                resultMap={resultMap}
                onClick={handleClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-[#262626]">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#71717a]">
            {hasRecommendations
              ? `${recommendedActions.length} recommended, ${availableActions.length} other`
              : `${allActions.length} action${allActions.length !== 1 ? "s" : ""} available`}
          </span>
          <span className="text-[#71717a]">
            {hasRecommendations ? "Context-aware" : "Automation enabled"}
          </span>
        </div>
      </div>
    </div>
  );
}

import { Lightbulb, TrendingUp, ArrowRight, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";

export interface SuggestedAction {
  id: string;
  action: string;
  priority?: "high" | "medium" | "low";
}

interface AIRecommendationProps {
  resolution: string;
  confidence: number;
  suggestedActions: SuggestedAction[];
  additionalContext?: string;
}

export function AIRecommendation({
  resolution,
  confidence,
  suggestedActions,
  additionalContext,
}: AIRecommendationProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = `${resolution}\n\nRecommended Actions:\n${suggestedActions
      .map((a, i) => `${i + 1}. ${a.action}`)
      .join("\n")}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getConfidenceLevel = (score: number) => {
    if (score >= 90) return { label: "Very High", color: "text-emerald-400" };
    if (score >= 75) return { label: "High", color: "text-indigo-400" };
    if (score >= 60) return { label: "Medium", color: "text-amber-400" };
    return { label: "Low", color: "text-orange-400" };
  };

  const getPriorityStyles = (priority?: string) => {
    switch (priority) {
      case "high":
        return "text-red-400 border-[#262626]";
      case "medium":
        return "text-amber-400 border-[#262626]";
      case "low":
        return "text-indigo-400 border-[#262626]";
      default:
        return "text-[#a1a1aa] border-[#262626]";
    }
  };

  const confidenceLevel = getConfidenceLevel(confidence);

  return (
    <div className="bg-[#0a0a0a] border border-[#262626] rounded-[10px] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#262626]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#161616] border border-[#262626]">
              <Lightbulb className="w-5 h-5 text-[#a1a1aa]" />
            </div>
            <div>
              <h3 className="text-[#fafafa] text-sm font-medium flex items-center gap-2">
                AI Recommendation
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              </h3>
              <p className="text-xs text-[#71717a] mt-0.5">
                Synthesized resolution based on analysis
              </p>
            </div>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#161616] hover:bg-[#1c1c1c] border border-[#262626] hover:border-[#333] text-[#a1a1aa] hover:text-[#fafafa] transition-colors text-sm"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-500">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Resolution Content */}
      <div className="px-5 py-5">
        <div className="mb-5">
          <div className="text-[#fafafa] text-sm leading-relaxed whitespace-pre-line">
            {resolution}
          </div>
          {additionalContext && (
            <div className="mt-3 p-3 bg-[#161616] border border-[#262626] rounded-lg">
              <p className="text-sm text-[#a1a1aa]">{additionalContext}</p>
            </div>
          )}
        </div>

        {/* Confidence Score */}
        <div className="mb-5 p-4 bg-[#161616] border border-[#262626] rounded-[10px]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#a1a1aa]" />
              <span className="text-sm text-[#a1a1aa]">Confidence Score</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm ${confidenceLevel.color}`}>
                {confidenceLevel.label}
              </span>
              <span className="text-[#fafafa] font-medium">{confidence}%</span>
            </div>
          </div>
          <div className="w-full bg-[#262626] rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-[#6366f1] rounded-full transition-all duration-1000"
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>

        {/* Suggested Actions */}
        {suggestedActions.length > 0 && (
          <div>
            <h4 className="text-[11px] font-medium text-[#71717a] uppercase tracking-[0.08em] mb-3 flex items-center gap-2">
              <ArrowRight className="w-3.5 h-3.5" />
              Recommended Actions
            </h4>
            <div className="space-y-2">
              {suggestedActions.map((action, index) => (
                <div
                  key={action.id}
                  className="flex items-start gap-3 p-3 bg-[#161616] hover:bg-[#1c1c1c] border border-[#262626] hover:border-[#333] rounded-lg transition-colors"
                >
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-[#262626] text-[#a1a1aa] text-xs flex-shrink-0 mt-0.5">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#fafafa]">
                      {action.action}
                    </p>
                  </div>
                  {action.priority && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${getPriorityStyles(
                        action.priority
                      )}`}
                    >
                      {action.priority}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-[#262626]">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#71717a]">
            Generated from {suggestedActions.length} recommended action
            {suggestedActions.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[#71717a]">Resolution complete</span>
          </div>
        </div>
      </div>
    </div>
  );
}

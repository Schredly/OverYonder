import { Target, TrendingUp } from "lucide-react";

interface SelectedUseCaseProps {
  name: string;
  description: string;
  confidence: number;
  category?: string;
}

export function SelectedUseCase({
  name,
  description,
  confidence,
  category,
}: SelectedUseCaseProps) {
  const getConfidenceColor = (score: number) => {
    if (score >= 90) return "text-emerald-400";
    if (score >= 75) return "text-indigo-400";
    if (score >= 60) return "text-amber-400";
    return "text-orange-400";
  };

  const confidenceColor = getConfidenceColor(confidence);

  return (
    <div className="bg-[#0a0a0a] border border-[#262626] rounded-[10px] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#262626]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#161616] border border-[#262626]">
              <Target className="w-4 h-4 text-[#a1a1aa]" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-[0.08em]">
                Selected Use Case
              </span>
              {category && (
                <span className="text-xs text-[#71717a] block">
                  {category}
                </span>
              )}
            </div>
          </div>

          {/* Confidence Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#262626] ${confidenceColor}`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="text-sm">{confidence}%</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        <h2 className="text-[#fafafa] text-sm font-medium mb-2">
          {name}
        </h2>
        <p className="text-sm text-[#a1a1aa] leading-relaxed">{description}</p>
      </div>

      {/* Footer with confidence bar */}
      <div className="px-4 py-3 border-t border-[#262626]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-[0.08em]">Match Confidence</span>
          <span className={`text-xs ${confidenceColor}`}>
            {confidence >= 90 && "Excellent"}
            {confidence >= 75 && confidence < 90 && "High"}
            {confidence >= 60 && confidence < 75 && "Good"}
            {confidence < 60 && "Moderate"}
          </span>
        </div>
        <div className="w-full bg-[#262626] rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-[#6366f1] rounded-full transition-all duration-1000"
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>
    </div>
  );
}

import { User, Bot } from "lucide-react";

interface ChatMessageProps {
  type: "user" | "agent";
  content: string;
  timestamp?: string;
}

export function ChatMessage({ type, content, timestamp }: ChatMessageProps) {
  if (type === "user") {
    return (
      <div className="flex justify-end mb-4">
        <div className="flex items-start gap-3 max-w-2xl">
          <div className="flex-1">
            {timestamp && (
              <div className="text-xs text-[#71717a] mb-1 text-right">
                {timestamp}
              </div>
            )}
            <div className="bg-[#fafafa] text-[#0a0a0a] px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm">
              {content}
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#161616] border border-[#262626] flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-[#a1a1aa]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-4">
      <div className="flex items-start gap-3 max-w-2xl">
        <div className="w-8 h-8 rounded-full bg-[#161616] border border-[#262626] flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-[#a1a1aa]" />
        </div>
        <div className="flex-1">
          {timestamp && (
            <div className="text-xs text-[#71717a] mb-1">{timestamp}</div>
          )}
          <div className="bg-[#161616] text-[#fafafa] px-4 py-2.5 rounded-2xl rounded-tl-sm border border-[#262626] text-sm">
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}

import { Send, Paperclip, Wrench } from "lucide-react";
import { useState } from "react";

interface InputPanelProps {
  onSend: (message: string) => void;
  onAttachContext?: () => void;
  onRunTool?: () => void;
  disabled?: boolean;
}

export function InputPanel({
  onSend,
  onAttachContext,
  onRunTool,
  disabled = false,
}: InputPanelProps) {
  const [message, setMessage] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message);
      setMessage("");
    }
  };

  return (
    <div className="border-t border-[#262626] bg-[#0a0a0a] px-4 py-4">
      {/* Context indicator */}
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="text-[#71717a]">Enterprise AI Agent</span>
        <div className="flex items-center gap-2 text-[#71717a]">
          <kbd className="px-1.5 py-0.5 bg-[#161616] border border-[#262626] rounded text-xs">
            Shift + Enter
          </kbd>
          <span>for new line</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Input field */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Ask the agent anything about your systems..."
          disabled={disabled}
          rows={1}
          className={`w-full bg-[#161616] border rounded-[10px] px-4 py-3.5 text-[#fafafa] placeholder-[#71717a] focus:outline-none resize-none disabled:opacity-50 transition-colors duration-150 ${
            isFocused
              ? "border-[#333]"
              : "border-[#262626]"
          }`}
          style={{
            minHeight: "52px",
            maxHeight: "200px",
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "52px";
            target.style.height = target.scrollHeight + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />

        {/* Action buttons */}
        <div className="flex items-center justify-between gap-2">
          {/* Secondary actions */}
          <div className="flex gap-2">
            {onAttachContext && (
              <button
                type="button"
                onClick={onAttachContext}
                disabled={disabled}
                className="px-3.5 py-2 rounded-lg bg-[#161616] hover:bg-[#1c1c1c] text-[#a1a1aa] hover:text-[#fafafa] border border-[#262626] hover:border-[#333] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Attach Context"
              >
                <Paperclip className="w-4 h-4" />
                <span className="text-sm hidden sm:inline">Attach Context</span>
              </button>
            )}

            {onRunTool && (
              <button
                type="button"
                onClick={onRunTool}
                disabled={disabled}
                className="px-3.5 py-2 rounded-lg bg-[#161616] hover:bg-[#1c1c1c] text-[#a1a1aa] hover:text-[#fafafa] border border-[#262626] hover:border-[#333] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Run Tool"
              >
                <Wrench className="w-4 h-4" />
                <span className="text-sm hidden sm:inline">Run Tool</span>
              </button>
            )}
          </div>

          {/* Primary action */}
          <button
            type="submit"
            disabled={disabled || !message.trim()}
            className="px-5 py-2 rounded-lg bg-[#fafafa] hover:bg-[#e4e4e7] text-[#0a0a0a] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <Send className="w-4 h-4" />
            <span>Ask Agent</span>
          </button>
        </div>
      </form>

      {/* Status bar */}
      <div className="mt-3 pt-3 border-t border-[#262626] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[#71717a]">Agent online</span>
          </div>
          <span className="text-[#262626]">&middot;</span>
          <span className="text-[#71717a]">Response time: ~2s</span>
        </div>
        <div className="text-[#71717a]">
          Powered by Enterprise AI
        </div>
      </div>
    </div>
  );
}

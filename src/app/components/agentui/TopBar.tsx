import { Activity, Settings, HelpCircle, Maximize2 } from "lucide-react";

interface TopBarProps {
  agentName: string;
  tenant: string;
  status: "connected" | "disconnected" | "processing";
}

export function TopBar({ agentName, tenant, status }: TopBarProps) {
  const statusColors = {
    connected: "bg-emerald-500",
    disconnected: "bg-red-500",
    processing: "bg-indigo-500",
  };

  const statusLabels = {
    connected: "Connected",
    disconnected: "Disconnected",
    processing: "Processing",
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[#262626] bg-[#0a0a0a]">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#161616] border border-[#262626] flex items-center justify-center">
            <Activity className="w-4 h-4 text-[#fafafa]" />
          </div>
          <div>
            <h1 className="text-[#fafafa] text-sm font-medium">{agentName}</h1>
            <p className="text-xs text-[#71717a]">{tenant}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#262626]">
          <div className={`w-1.5 h-1.5 rounded-full ${statusColors[status]}`} />
          <span className="text-xs text-[#a1a1aa]">{statusLabels[status]}</span>
        </div>

        <button className="p-2 rounded-lg hover:bg-[#161616] text-[#71717a] hover:text-[#fafafa] transition-colors">
          <HelpCircle className="w-4 h-4" />
        </button>
        <button className="p-2 rounded-lg hover:bg-[#161616] text-[#71717a] hover:text-[#fafafa] transition-colors">
          <Settings className="w-4 h-4" />
        </button>
        <button className="p-2 rounded-lg hover:bg-[#161616] text-[#71717a] hover:text-[#fafafa] transition-colors">
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

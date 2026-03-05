import {
  FileText,
  Ticket,
  MessageSquare,
  Book,
  Play,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";

const availableActions = [
  {
    id: "create-ticket",
    icon: Ticket,
    title: "Create Ticket",
    description: "Open a ServiceNow incident based on the analysis",
    category: "Incident Management",
  },
  {
    id: "open-knowledge",
    icon: Book,
    title: "Open Knowledge Article",
    description: "View relevant documentation and troubleshooting guides",
    category: "Knowledge Base",
  },
  {
    id: "generate-pdf",
    icon: FileText,
    title: "Generate PDF Report",
    description: "Create a detailed PDF report of the analysis",
    category: "Documentation",
  },
  {
    id: "send-slack",
    icon: MessageSquare,
    title: "Send Slack Notification",
    description: "Notify the team about this incident via Slack",
    category: "Communication",
  },
  {
    id: "run-automation",
    icon: Play,
    title: "Run Automation Workflow",
    description: "Execute automated remediation steps",
    category: "Automation",
  },
];

export default function AgentUIActionsPage() {
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [completedActions, setCompletedActions] = useState<string[]>([]);

  const handleActionClick = (actionId: string) => {
    setExecutingAction(actionId);
    setTimeout(() => {
      setExecutingAction(null);
      setCompletedActions([...completedActions, actionId]);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-blue-400" />
            <h1 className="text-xl font-semibold text-white">
              Agent UI Preview
            </h1>
          </div>
          <p className="text-sm text-gray-400">
            This is how contextual actions appear to users in the Agent UI based
            on visibility rules.
          </p>
        </div>

        {/* Mock Agent Response */}
        <div className="bg-[#13131a] border border-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white text-sm font-medium">AI</span>
            </div>
            <div className="flex-1">
              <div className="text-sm text-gray-300 leading-relaxed mb-3">
                I've analyzed the email and identified a potential service
                disruption affecting the customer portal. The root cause appears
                to be a database connection timeout issue occurring since 14:30
                UTC.
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  High Priority
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  Email Incident Diagnosis
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                  Confidence: 0.89
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Agent Actions Card */}
        <div className="bg-[#13131a] border border-gray-800 rounded-lg overflow-hidden">
          {/* Card Header */}
          <div className="px-6 py-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white mb-1">
                  Suggested Actions
                </h2>
                <p className="text-xs text-gray-400">
                  Select an action to execute based on the agent analysis
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {completedActions.length} of {availableActions.length}{" "}
                  completed
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons Grid */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableActions.map((action) => {
                const Icon = action.icon;
                const isExecuting = executingAction === action.id;
                const isCompleted = completedActions.includes(action.id);

                return (
                  <button
                    key={action.id}
                    onClick={() => handleActionClick(action.id)}
                    disabled={isExecuting || isCompleted}
                    className={`group relative flex items-start gap-4 p-4 rounded-lg border transition-all text-left ${
                      isCompleted
                        ? "bg-green-500/5 border-green-500/20 cursor-default"
                        : isExecuting
                        ? "bg-blue-500/10 border-blue-500/30 cursor-wait"
                        : "bg-[#1a1a24] border-gray-700 hover:border-gray-600 hover:bg-[#1f1f2a]"
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                        isCompleted
                          ? "bg-green-500/10 text-green-400"
                          : isExecuting
                          ? "bg-blue-500/10 text-blue-400 animate-pulse"
                          : "bg-gray-800 text-gray-400 group-hover:bg-gray-700 group-hover:text-gray-300"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3
                          className={`text-sm font-medium ${
                            isCompleted
                              ? "text-green-400"
                              : isExecuting
                              ? "text-blue-400"
                              : "text-white"
                          }`}
                        >
                          {action.title}
                        </h3>
                        <span className="text-xs text-gray-500 font-mono whitespace-nowrap">
                          {action.category}
                        </span>
                      </div>
                      <p
                        className={`text-xs ${
                          isCompleted || isExecuting
                            ? "text-gray-500"
                            : "text-gray-400"
                        }`}
                      >
                        {isCompleted
                          ? "Action completed successfully"
                          : isExecuting
                          ? "Executing action..."
                          : action.description}
                      </p>
                    </div>

                    {/* Executing Indicator */}
                    {isExecuting && (
                      <div className="absolute inset-0 rounded-lg overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent animate-shimmer" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card Footer */}
          <div className="px-6 py-4 bg-[#0f0f14] border-t border-gray-800">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span>Actions filtered by context rules</span>
              </div>
              <button className="text-gray-400 hover:text-gray-300 transition-colors">
                View all actions →
              </button>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mt-6 bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-medium mt-0.5">
              i
            </div>
            <div>
              <h4 className="text-sm font-medium text-blue-400 mb-1">
                About Agent Actions
              </h4>
              <p className="text-xs text-blue-300/80 leading-relaxed">
                Actions are dynamically shown based on visibility rules you
                configure in the Admin Portal. In this example, the actions are
                displayed because the use case is "Email Incident Diagnosis" and
                the confidence score exceeds the 0.75 threshold.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

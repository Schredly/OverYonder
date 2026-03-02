import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { mockRuns } from '../data/mockData';
import { format } from 'date-fns';

export function RunsPage() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    mockRuns[0]?.id || null
  );
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());

  const selectedRun = mockRuns.find((r) => r.id === selectedRunId);

  const toggleSkill = (skillName: string) => {
    const newExpanded = new Set(expandedSkills);
    if (newExpanded.has(skillName)) {
      newExpanded.delete(skillName);
    } else {
      newExpanded.add(skillName);
    }
    setExpandedSkills(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'running':
        return 'bg-blue-500 animate-pulse';
      case 'failed':
        return 'bg-red-500';
      case 'pending':
        return 'bg-gray-300';
      default:
        return 'bg-gray-300';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'running':
        return 'Running';
      case 'failed':
        return 'Failed';
      case 'pending':
        return 'Pending';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="flex h-full">
      {/* Left Column - Runs List */}
      <div className="w-80 border-r border-border bg-white overflow-auto">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg">Runs</h2>
          <p className="text-sm text-muted-foreground">
            {mockRuns.length} total runs
          </p>
        </div>
        <div className="divide-y divide-border">
          {mockRuns.map((run) => (
            <button
              key={run.id}
              onClick={() => setSelectedRunId(run.id)}
              className={`
                w-full p-4 text-left hover:bg-gray-50 transition-colors
                ${selectedRunId === run.id ? 'bg-blue-50' : ''}
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-mono">{run.id}</span>
                <span
                  className={`
                    w-2 h-2 rounded-full
                    ${getStatusColor(run.status)}
                  `}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                {format(new Date(run.createdAt), 'MMM d, h:mm a')}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right Column - Run Detail */}
      <div className="flex-1 overflow-auto">
        {selectedRun ? (
          <div className="p-8 max-w-4xl">
            {/* Run Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-mono">{selectedRun.id}</h1>
                <span
                  className={`
                    px-2 py-0.5 rounded text-xs
                    ${
                      selectedRun.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : selectedRun.status === 'running'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-red-100 text-red-800'
                    }
                  `}
                >
                  {getStatusText(selectedRun.status)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {format(new Date(selectedRun.createdAt), 'MMMM d, yyyy at h:mm:ss a')}
              </p>
            </div>

            {/* Skills Timeline */}
            <div className="mb-8">
              <h2 className="text-lg mb-4">Skills Timeline</h2>
              <div className="space-y-3">
                {selectedRun.skills.map((skill, index) => (
                  <div
                    key={index}
                    className="border border-border rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => toggleSkill(skill.name)}
                      className="w-full p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors"
                    >
                      <div
                        className={`
                          w-2 h-2 rounded-full mt-1.5 shrink-0
                          ${getStatusColor(skill.status)}
                        `}
                      />
                      <div className="flex-1 text-left">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">{skill.name}</span>
                          {expandedSkills.has(skill.name) ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{skill.summary}</p>
                      </div>
                    </button>

                    {expandedSkills.has(skill.name) && skill.reasoning.length > 0 && (
                      <div className="px-4 pb-4 pl-9 bg-gray-50">
                        <div className="text-xs text-muted-foreground mb-2">
                          Reasoning:
                        </div>
                        <ul className="space-y-1">
                          {skill.reasoning.map((reason, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex">
                              <span className="mr-2">•</span>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Result Panel */}
            {selectedRun.status === 'completed' && (
              <div className="border border-border rounded-lg p-6 bg-white">
                <h2 className="text-lg mb-4">Result</h2>

                {/* Summary */}
                <div className="mb-6">
                  <div className="text-sm text-muted-foreground mb-2">Summary</div>
                  <p className="text-sm leading-relaxed">{selectedRun.result.summary}</p>
                </div>

                {/* Recommended Steps */}
                {selectedRun.result.recommendedSteps.length > 0 && (
                  <div className="mb-6">
                    <div className="text-sm text-muted-foreground mb-2">
                      Recommended Steps
                    </div>
                    <ul className="space-y-2">
                      {selectedRun.result.recommendedSteps.map((step, index) => (
                        <li key={index} className="text-sm flex">
                          <span className="mr-2 text-muted-foreground">
                            {index + 1}.
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Sources */}
                {selectedRun.result.sources.length > 0 && (
                  <div className="mb-6">
                    <div className="text-sm text-muted-foreground mb-2">Sources</div>
                    <div className="space-y-2">
                      {selectedRun.result.sources.map((source, index) => (
                        <a
                          key={index}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                        >
                          <span>{source.title}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Confidence Score */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="text-sm text-muted-foreground">
                    Confidence Score
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{
                          width: `${selectedRun.result.confidence * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm">
                      {Math.round(selectedRun.result.confidence * 100)}%
                    </span>
                  </div>
                </div>

                {/* Run ID */}
                <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
                  <div className="text-sm text-muted-foreground">Run ID</div>
                  <div className="text-sm font-mono">{selectedRun.id}</div>
                </div>
              </div>
            )}

            {selectedRun.status === 'running' && (
              <div className="border border-border rounded-lg p-6 bg-blue-50">
                <p className="text-sm text-blue-900">
                  This run is currently in progress. Results will appear when complete.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Select a run to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

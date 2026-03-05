import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ChevronLeft, Plus, X } from "lucide-react";
import { Link } from "react-router";

const conditionTypes = [
  { id: "use_case", name: "Use Case", placeholder: "Select use case..." },
  {
    id: "confidence",
    name: "Confidence Score",
    placeholder: "e.g., > 0.75",
  },
  {
    id: "skill",
    name: "Skill Triggered",
    placeholder: "Select skill...",
  },
  {
    id: "keyword",
    name: "Keyword Match",
    placeholder: "Enter keywords...",
  },
  { id: "tag", name: "Agent Tag", placeholder: "Enter tag..." },
];

const useCases = [
  "Email Incident Diagnosis",
  "Customer Support Query",
  "Technical Documentation",
  "Report Generation",
  "Automation Workflow",
];

const skills = [
  "Email Analysis",
  "Log Parser",
  "Knowledge Search",
  "Document Generator",
  "API Connector",
];

interface Condition {
  id: string;
  type: string;
  operator: string;
  value: string;
}

export default function ActionVisibilityRulesPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [actionName, setActionName] = useState("Create Incident");
  const [conditions, setConditions] = useState<Condition[]>([
    {
      id: "1",
      type: "use_case",
      operator: "equals",
      value: "Email Incident Diagnosis",
    },
    {
      id: "2",
      type: "confidence",
      operator: "greater_than",
      value: "0.75",
    },
  ]);

  const addCondition = () => {
    setConditions([
      ...conditions,
      {
        id: Date.now().toString(),
        type: "use_case",
        operator: "equals",
        value: "",
      },
    ]);
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id));
  };

  const updateCondition = (
    id: string,
    field: keyof Condition,
    value: string
  ) => {
    setConditions(
      conditions.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const getOperatorsForType = (type: string) => {
    if (type === "confidence") {
      return [
        { value: "greater_than", label: "Greater than (>)" },
        { value: "less_than", label: "Less than (<)" },
        { value: "equals", label: "Equals (=)" },
      ];
    }
    if (type === "keyword") {
      return [
        { value: "contains", label: "Contains" },
        { value: "not_contains", label: "Does not contain" },
      ];
    }
    return [
      { value: "equals", label: "Equals" },
      { value: "not_equals", label: "Does not equal" },
    ];
  };

  const getValueInputForType = (condition: Condition) => {
    const conditionType = conditionTypes.find((t) => t.id === condition.type);

    if (condition.type === "use_case") {
      return (
        <select
          value={condition.value}
          onChange={(e) =>
            updateCondition(condition.id, "value", e.target.value)
          }
          className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
        >
          <option value="">Select use case...</option>
          {useCases.map((uc) => (
            <option key={uc} value={uc}>
              {uc}
            </option>
          ))}
        </select>
      );
    }

    if (condition.type === "skill") {
      return (
        <select
          value={condition.value}
          onChange={(e) =>
            updateCondition(condition.id, "value", e.target.value)
          }
          className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
        >
          <option value="">Select skill...</option>
          {skills.map((skill) => (
            <option key={skill} value={skill}>
              {skill}
            </option>
          ))}
        </select>
      );
    }

    if (condition.type === "confidence") {
      return (
        <input
          type="number"
          step="0.01"
          min="0"
          max="1"
          value={condition.value}
          onChange={(e) =>
            updateCondition(condition.id, "value", e.target.value)
          }
          className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
          placeholder="0.75"
        />
      );
    }

    return (
      <input
        type="text"
        value={condition.value}
        onChange={(e) => updateCondition(condition.id, "value", e.target.value)}
        className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
        placeholder={conditionType?.placeholder}
      />
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/actions");
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/actions"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Actions
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">
            Action Visibility Rules
          </h1>
          <p className="text-sm text-gray-600">
            Configure when "{actionName}" should appear in the Agent UI based on
            context.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
            {/* Action Selection */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Action
              </label>
              <select
                value={actionName}
                onChange={(e) => setActionName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white text-sm"
              >
                <option value="Create Incident">Create Incident</option>
                <option value="Create Jira Issue">Create Jira Issue</option>
                <option value="Create Salesforce Case">
                  Create Salesforce Case
                </option>
                <option value="Generate PDF Report">Generate PDF Report</option>
                <option value="Send Slack Notification">
                  Send Slack Notification
                </option>
              </select>
            </div>

            {/* Conditions */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Visibility Conditions
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Action will appear when all conditions are met
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addCondition}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Condition
                </button>
              </div>

              {conditions.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500 border border-gray-200 rounded-lg">
                  No conditions configured. Action will always be visible.
                </div>
              ) : (
                <div className="space-y-3">
                  {conditions.map((condition, index) => (
                    <div
                      key={condition.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 mt-1">
                          {index + 1}
                        </div>
                        <div className="flex-1 grid grid-cols-3 gap-3">
                          {/* Condition Type */}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5">
                              CONDITION TYPE
                            </label>
                            <select
                              value={condition.type}
                              onChange={(e) =>
                                updateCondition(
                                  condition.id,
                                  "type",
                                  e.target.value
                                )
                              }
                              className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
                            >
                              {conditionTypes.map((type) => (
                                <option key={type.id} value={type.id}>
                                  {type.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Operator */}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5">
                              OPERATOR
                            </label>
                            <select
                              value={condition.operator}
                              onChange={(e) =>
                                updateCondition(
                                  condition.id,
                                  "operator",
                                  e.target.value
                                )
                              }
                              className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
                            >
                              {getOperatorsForType(condition.type).map((op) => (
                                <option key={op.value} value={op.value}>
                                  {op.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Value */}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5">
                              VALUE
                            </label>
                            {getValueInputForType(condition)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCondition(condition.id)}
                          className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 transition-colors mt-6"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Example Preview */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium mt-0.5">
                i
              </div>
              <div>
                <h4 className="text-sm font-medium text-blue-900 mb-1">
                  Current Rule
                </h4>
                <p className="text-xs text-blue-700">
                  Show "{actionName}" when:{" "}
                  {conditions.length === 0 ? (
                    <span className="font-medium">Always visible</span>
                  ) : (
                    conditions.map((c, i) => (
                      <span key={c.id}>
                        {i > 0 && " AND "}
                        <span className="font-medium">
                          {conditionTypes.find((t) => t.id === c.type)?.name}{" "}
                          {
                            getOperatorsForType(c.type).find(
                              (o) => o.value === c.operator
                            )?.label
                          }{" "}
                          {c.value || "(empty)"}
                        </span>
                      </span>
                    ))
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Link
              to="/actions"
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-[#030213] text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Save Rules
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

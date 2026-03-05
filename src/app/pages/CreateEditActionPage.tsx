import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { ChevronLeft, Plus, X } from "lucide-react";
import { Link } from "react-router";

const API_BASE = "http://localhost:8000/api/admin/acme/actions";

const integrations = [
  { id: "servicenow", name: "ServiceNow" },
  { id: "jira", name: "Jira" },
  { id: "salesforce", name: "Salesforce" },
  { id: "slack", name: "Slack" },
  { id: "google-drive", name: "Google Drive" },
  { id: "github", name: "Github" },
  { id: "internal", name: "Internal" },
];

const operationsByIntegration: Record<string, string[]> = {
  servicenow: [
    "incident.create",
    "incident.update",
    "incident.close",
    "change.create",
    "problem.create",
  ],
  jira: [
    "issue.create",
    "issue.update",
    "issue.assign",
    "issue.transition",
    "comment.add",
  ],
  salesforce: [
    "case.create",
    "case.update",
    "case.close",
    "lead.create",
    "opportunity.create",
  ],
  slack: [
    "message.post",
    "channel.create",
    "user.invite",
    "file.upload",
  ],
  "google-drive": [
    "document.create",
    "spreadsheet.create",
    "folder.create",
    "file.share",
  ],
  github: [
    "issue.create",
    "pull_request.create",
    "repository.create",
    "comment.add",
  ],
  internal: ["pdf.generate", "email.send", "report.generate", "workflow.trigger"],
};

const sourceOptions = [
  "Static",
  "User Prompt",
  "Agent Result",
  "Agent Metadata",
  "User Input",
];

interface Parameter {
  id: string;
  name: string;
  source: string;
  value: string;
}

export default function CreateEditActionPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    integration: "",
    operation: "",
  });

  const [parameters, setParameters] = useState<Parameter[]>([]);

  useEffect(() => {
    if (!isEdit) return;
    fetch(`${API_BASE}/${id}`)
      .then((r) => r.json())
      .then((action) => {
        setFormData({
          name: action.name || "",
          description: action.description || "",
          integration: action.integration_id || "",
          operation: action.operation || "",
        });
        setParameters(
          (action.parameters || []).map((p: any, i: number) => ({
            id: String(i),
            name: p.name || "",
            source: p.source || "Static",
            value: p.value || "",
          }))
        );
      })
      .catch(console.error);
  }, [id, isEdit]);

  const availableOperations = formData.integration
    ? operationsByIntegration[formData.integration] || []
    : [];

  const addParameter = () => {
    setParameters([
      ...parameters,
      {
        id: Date.now().toString(),
        name: "",
        source: "Static",
        value: "",
      },
    ]);
  };

  const removeParameter = (id: string) => {
    setParameters(parameters.filter((p) => p.id !== id));
  };

  const updateParameter = (
    id: string,
    field: keyof Parameter,
    value: string
  ) => {
    setParameters(
      parameters.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      description: formData.description,
      integration_id: formData.integration,
      operation: formData.operation,
      parameters: parameters.map((p) => ({
        name: p.name,
        source: p.source.toLowerCase().replace(/ /g, "_"),
        value: p.value || null,
      })),
    };
    const url = isEdit ? `${API_BASE}/${id}` : API_BASE;
    const method = isEdit ? "PUT" : "POST";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
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
            {isEdit ? "Edit Action" : "Create Action"}
          </h1>
          <p className="text-sm text-gray-600">
            Configure an action that the agent can execute after analyzing user
            requests.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
            <div className="space-y-5">
              {/* Action Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Action Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white text-sm"
                  placeholder="e.g., Create Incident"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white text-sm resize-none"
                  rows={3}
                  placeholder="Describe what this action does..."
                  required
                />
              </div>

              {/* Integration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Integration
                </label>
                <select
                  value={formData.integration}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      integration: e.target.value,
                      operation: "",
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white text-sm"
                  required
                >
                  <option value="">Select integration...</option>
                  {integrations.map((int) => (
                    <option key={int.id} value={int.id}>
                      {int.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Operation - shows when integration is selected */}
              {formData.integration && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Operation
                  </label>
                  <select
                    value={formData.operation}
                    onChange={(e) =>
                      setFormData({ ...formData, operation: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white text-sm font-mono"
                    required
                  >
                    <option value="">Select operation...</option>
                    {availableOperations.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Parameter Mapping */}
          {formData.operation && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Parameter Mapping
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Map operation parameters to data sources
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addParameter}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Parameter
                </button>
              </div>

              {parameters.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  No parameters configured. Click "Add Parameter" to get
                  started.
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Parameter
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Source
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Value
                        </th>
                        <th className="px-4 py-2.5 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {parameters.map((param) => (
                        <tr key={param.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={param.name}
                              onChange={(e) =>
                                updateParameter(param.id, "name", e.target.value)
                              }
                              className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
                              placeholder="parameter_name"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={param.source}
                              onChange={(e) =>
                                updateParameter(
                                  param.id,
                                  "source",
                                  e.target.value
                                )
                              }
                              className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
                            >
                              {sourceOptions.map((source) => (
                                <option key={source} value={source}>
                                  {source}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={param.value}
                              onChange={(e) =>
                                updateParameter(
                                  param.id,
                                  "value",
                                  e.target.value
                                )
                              }
                              className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
                              placeholder={
                                param.source === "Static"
                                  ? "Enter static value..."
                                  : "Leave empty for dynamic"
                              }
                            />
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => removeParameter(param.id)}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

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
              {isEdit ? "Save Changes" : "Create Action"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

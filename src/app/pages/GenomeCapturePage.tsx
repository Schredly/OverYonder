import { useState } from "react";
import { useNavigate } from "react-router";
import { mockGenomes } from "../data/mockGenomes";
import {
  X,
  Check,
  Server,
  Cloud,
  Ticket,
  Headset,
  Briefcase,
  Package,
  Workflow as WorkflowIcon,
  Grid3x3,
  Share2,
  ArrowRight,
  Dna,
} from "lucide-react";

const steps = [
  { id: 1, name: "Source Platform" },
  { id: 2, name: "Application Type" },
  { id: 3, name: "Configure" },
  { id: 4, name: "Preview" },
  { id: 5, name: "Confirm" },
];

const platforms = [
  { id: "servicenow", name: "ServiceNow", icon: Server },
  { id: "salesforce", name: "Salesforce", icon: Cloud },
  { id: "jira", name: "Jira", icon: Ticket },
  { id: "zendesk", name: "Zendesk", icon: Headset },
  { id: "workday", name: "Workday", icon: Briefcase },
];

const applicationTypes = [
  {
    id: "catalog_item",
    name: "Catalog Item",
    description: "Service catalog items with forms and variables",
  },
  {
    id: "workflow",
    name: "Workflow",
    description: "Business process workflows and automations",
  },
  {
    id: "table_application",
    name: "Table Application",
    description: "Custom table-based applications with CRUD operations",
  },
  {
    id: "custom_app",
    name: "Custom App",
    description: "Fully custom scoped or legacy application",
  },
];

// Use the first genome's document as a mock preview
const mockPreview = mockGenomes[0].genome_document;

export default function GenomeCapturePage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  // Step 2
  const [selectedAppType, setSelectedAppType] = useState<string | null>(null);
  // Step 3
  const [config, setConfig] = useState({
    instanceUrl: "",
    apiCredentials: "",
    applicationName: "",
    applicationCategory: "",
  });

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  const canContinue = (step: number) => {
    switch (step) {
      case 1:
        return !!selectedPlatform;
      case 2:
        return !!selectedAppType;
      case 3:
        return !!(config.instanceUrl && config.apiCredentials && config.applicationName);
      default:
        return true;
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">
            Capture Genome
          </h1>
          <button
            onClick={() => navigate("/genomes")}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                      currentStep > step.id
                        ? "bg-green-500 border-green-500 text-white"
                        : currentStep === step.id
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-300 text-gray-400"
                    }`}
                  >
                    {currentStep > step.id ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <span className="text-sm">{step.id}</span>
                    )}
                  </div>
                  <span
                    className={`ml-2 text-sm ${
                      currentStep >= step.id
                        ? "text-gray-900 font-medium"
                        : "text-gray-400"
                    }`}
                  >
                    {step.name}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-4 ${
                      currentStep > step.id ? "bg-green-500" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          {/* Step 1: Select Source Platform */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Select the source platform to extract the application genome
                from.
              </p>
              <div className="grid grid-cols-1 gap-3">
                {platforms.map((platform) => {
                  const Icon = platform.icon;
                  const selected = selectedPlatform === platform.id;
                  return (
                    <button
                      key={platform.id}
                      onClick={() => setSelectedPlatform(platform.id)}
                      className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-colors text-left ${
                        selected
                          ? "border-gray-900 bg-gray-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          selected
                            ? "bg-gray-900 text-white"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {platform.name}
                      </span>
                      {selected && (
                        <Check className="w-5 h-5 text-gray-900 ml-auto" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => navigate("/genomes")}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setCurrentStep(2)}
                  disabled={!canContinue(1)}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Select Application Type */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                What type of application are you extracting?
              </p>
              <div className="grid grid-cols-1 gap-3">
                {applicationTypes.map((appType) => {
                  const selected = selectedAppType === appType.id;
                  return (
                    <button
                      key={appType.id}
                      onClick={() => setSelectedAppType(appType.id)}
                      className={`flex items-center justify-between p-4 rounded-lg border-2 transition-colors text-left ${
                        selected
                          ? "border-gray-900 bg-gray-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {appType.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {appType.description}
                        </p>
                      </div>
                      {selected && (
                        <Check className="w-5 h-5 text-gray-900 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  disabled={!canContinue(2)}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Configure Extraction */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <p className="text-sm text-gray-600">
                Provide connection details and application metadata.
              </p>

              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Instance URL
                </label>
                <input
                  type="text"
                  name="instanceUrl"
                  value={config.instanceUrl}
                  onChange={handleConfigChange}
                  placeholder="https://your-instance.service-now.com"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  API Credentials
                </label>
                <input
                  type="password"
                  name="apiCredentials"
                  value={config.apiCredentials}
                  onChange={handleConfigChange}
                  placeholder="API key or token"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Application Name
                </label>
                <input
                  type="text"
                  name="applicationName"
                  value={config.applicationName}
                  onChange={handleConfigChange}
                  placeholder="e.g., Hardware Request"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Application Category
                </label>
                <select
                  name="applicationCategory"
                  value={config.applicationCategory}
                  onChange={handleConfigChange}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
                >
                  <option value="">Select category...</option>
                  <option value="it_service_management">IT Service Management</option>
                  <option value="identity_access">Identity & Access Management</option>
                  <option value="hr_operations">HR Operations</option>
                  <option value="finance">Finance & Procurement</option>
                  <option value="customer_service">Customer Service</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(4)}
                  disabled={!canContinue(3)}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Genome Preview */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Preview of the detected application genome structure.
              </p>

              <div className="grid grid-cols-2 gap-4">
                {/* Objects */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-200">
                    <Package className="w-4 h-4 text-slate-600" />
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Objects ({mockPreview.objects.length})
                    </h3>
                  </div>
                  <div className="space-y-1.5">
                    {mockPreview.objects.map((obj, idx) => (
                      <div
                        key={idx}
                        className="text-xs p-2 bg-slate-50 rounded font-mono text-slate-700"
                      >
                        {obj}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Workflows */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-200">
                    <WorkflowIcon className="w-4 h-4 text-purple-600" />
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Workflows ({mockPreview.workflows.length})
                    </h3>
                  </div>
                  <div className="space-y-1.5">
                    {mockPreview.workflows.map((wf, idx) => (
                      <div
                        key={idx}
                        className="text-xs p-2 bg-purple-50 rounded font-mono text-purple-900"
                      >
                        {wf}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fields */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-200">
                    <Grid3x3 className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fields ({mockPreview.fields.length})
                    </h3>
                  </div>
                  <div className="space-y-1.5">
                    {mockPreview.fields.map((field, idx) => (
                      <div
                        key={idx}
                        className="text-xs p-2 bg-blue-50 rounded font-mono text-blue-900"
                      >
                        {field}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Relationships */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-200">
                    <Share2 className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Relationships ({mockPreview.relationships.length})
                    </h3>
                  </div>
                  <div className="space-y-1.5">
                    {mockPreview.relationships.map((rel, idx) => {
                      const parts = rel.split(" → ");
                      return (
                        <div
                          key={idx}
                          className="p-2 bg-emerald-50 rounded"
                        >
                          <div className="flex items-center gap-1 text-xs text-emerald-900">
                            <span className="font-mono">{parts[0]}</span>
                            <ArrowRight className="w-3 h-3 text-emerald-600" />
                            <span className="font-mono">{parts[1]}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(5)}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Confirm Capture */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-green-900 mb-2">
                  Ready to Capture
                </h3>
                <p className="text-sm text-green-700">
                  The genome for{" "}
                  <strong>{config.applicationName || "this application"}</strong>{" "}
                  will be extracted from{" "}
                  <strong>
                    {platforms.find((p) => p.id === selectedPlatform)?.name ||
                      "the selected platform"}
                  </strong>
                  .
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Platform</span>
                  <span className="font-medium text-gray-900">
                    {platforms.find((p) => p.id === selectedPlatform)?.name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Application Type</span>
                  <span className="font-medium text-gray-900">
                    {applicationTypes.find((t) => t.id === selectedAppType)?.name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Instance</span>
                  <span className="font-mono text-xs text-gray-700">
                    {config.instanceUrl || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Application</span>
                  <span className="font-medium text-gray-900">
                    {config.applicationName || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Detected Objects</span>
                  <span className="font-medium text-gray-900">
                    {mockPreview.objects.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Detected Workflows</span>
                  <span className="font-medium text-gray-900">
                    {mockPreview.workflows.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Detected Fields</span>
                  <span className="font-medium text-gray-900">
                    {mockPreview.fields.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Detected Relationships</span>
                  <span className="font-medium text-gray-900">
                    {mockPreview.relationships.length}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setCurrentStep(4)}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => navigate("/genomes")}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <Dna className="w-4 h-4" />
                  Capture Genome
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import {
  Video,
  Upload,
  GitBranch,
  Play,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Dna,
  FileText,
  Save,
  Pencil,
  RefreshCw,
  FolderTree,
  X,
  Plus,
  Trash2,
} from "lucide-react";

const TENANT = "acme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Integration {
  id: string;
  integration_type: string;
  name: string;
  enabled: boolean;
  config: Record<string, string>;
}

interface GenomeFile {
  path: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VideoGenomePage() {
  // Video upload
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [userNotes, setUserNotes] = useState("");
  const [refinementPrompt, setRefinementPrompt] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extraction
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [genomeResult, setGenomeResult] = useState<any>(null);
  const [genomeFiles, setGenomeFiles] = useState<GenomeFile[]>([]);
  const [selectedFileIdx, setSelectedFileIdx] = useState<number>(0);
  const [extractionCount, setExtractionCount] = useState(0);

  // GitHub commit
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(false);
  const [selectedGithub, setSelectedGithub] = useState<Integration | null>(null);
  const [applicationName, setApplicationName] = useState("");
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<any>(null);
  const [showGithub, setShowGithub] = useState(false);

  // Auto-upload when file is selected
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setVideoId(null);
    setUploadError(null);
    setGenomeResult(null);
    setGenomeFiles([]);
    setCommitResult(null);
    setShowGithub(false);

    // Auto-upload immediately
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/video-genome/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setUploadError(`Upload failed (${res.status}): ${text.slice(0, 200)}`);
        setUploading(false);
        return;
      }
      const data = await res.json();
      if (data.status === "ok") {
        setVideoId(data.video_id);
      } else {
        setUploadError(data.detail || data.error || "Upload failed");
      }
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? `Upload failed: ${err.message}`
          : "Upload failed — is the backend server running?"
      );
    }
    setUploading(false);
  };

  // Build genome files from extraction result
  const buildGenomeFiles = (genome: any, appName: string): GenomeFile[] => {
    const vendor = genome.vendor || "unknown";
    const appSlug = (appName || genome.application_name || "app").toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const base = `genomes/tenants/acme/vendors/${vendor}/${appSlug}`;
    const files: GenomeFile[] = [];

    // genome.yaml — the full genome
    files.push({
      path: `${base}/genome.yaml`,
      content: yamlDump({
        application_name: genome.application_name || appName,
        vendor: genome.vendor,
        source_platform: genome.source_platform || "Video Capture",
        category: genome.category || "",
        confidence: genome.confidence,
        genome_document: genome.genome_document,
      }),
    });

    // summary.md
    if (genome.summary) {
      files.push({
        path: `${base}/summary.md`,
        content: `# ${genome.application_name || appName}\n\n${genome.summary}\n\n## Vendor\n${genome.vendor || "Unknown"}\n\n## Category\n${genome.category || "—"}\n`,
      });
    }

    // objects.json
    if (genome.genome_document?.objects?.length) {
      files.push({
        path: `${base}/structure/objects.json`,
        content: JSON.stringify(genome.genome_document.objects, null, 2),
      });
    }

    // fields.json
    if (genome.genome_document?.fields?.length) {
      files.push({
        path: `${base}/structure/fields.json`,
        content: JSON.stringify(genome.genome_document.fields, null, 2),
      });
    }

    // workflows.json
    if (genome.genome_document?.workflows?.length) {
      files.push({
        path: `${base}/structure/workflows.json`,
        content: JSON.stringify(genome.genome_document.workflows, null, 2),
      });
    }

    // relationships.json
    if (genome.genome_document?.relationships?.length) {
      files.push({
        path: `${base}/structure/relationships.json`,
        content: JSON.stringify(genome.genome_document.relationships, null, 2),
      });
    }

    return files;
  };

  // Simple YAML-like dump
  const yamlDump = (obj: any, indent = 0): string => {
    const pad = "  ".repeat(indent);
    let out = "";
    for (const [key, val] of Object.entries(obj)) {
      if (val === null || val === undefined) continue;
      if (typeof val === "object" && !Array.isArray(val)) {
        out += `${pad}${key}:\n${yamlDump(val, indent + 1)}`;
      } else if (Array.isArray(val)) {
        out += `${pad}${key}:\n`;
        for (const item of val) {
          if (typeof item === "object") {
            out += `${pad}  - ${JSON.stringify(item)}\n`;
          } else {
            out += `${pad}  - ${item}\n`;
          }
        }
      } else {
        out += `${pad}${key}: ${val}\n`;
      }
    }
    return out;
  };

  // ---------------------------------------------------------------------------
  // Extract genome
  // ---------------------------------------------------------------------------

  const runExtraction = async () => {
    if (!videoId) return;
    setExtracting(true);
    setExtractError(null);

    const notes = extractionCount > 0 && refinementPrompt
      ? `${userNotes}\n\nRefinement: ${refinementPrompt}`
      : userNotes;

    try {
      const res = await fetch("/api/video-genome/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: videoId, user_notes: notes }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Server error ${res.status}: ${text.slice(0, 300)}`);
      }
      const data = await res.json();
      if (data.status === "error") {
        setExtractError(data.error || "Extraction failed");
        if (data.raw_response) {
          setExtractError(`${data.error}\n\nLLM response: ${data.raw_response.slice(0, 500)}`);
        }
        setExtracting(false);
        return;
      }

      setGenomeResult(data.genome);
      const appName = applicationName || data.genome?.application_name || "app";
      if (!applicationName && data.genome?.application_name) {
        setApplicationName(data.genome.application_name);
      }
      const files = buildGenomeFiles(data.genome, appName);
      setGenomeFiles(files);
      setSelectedFileIdx(0);
      setExtractionCount((c) => c + 1);
      setCommitResult(null);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Extraction failed");
    }
    setExtracting(false);
  };

  // ---------------------------------------------------------------------------
  // GitHub + Commit
  // ---------------------------------------------------------------------------

  const loadIntegrations = async () => {
    setLoadingIntegrations(true);
    try {
      const res = await fetch(`/api/admin/${TENANT}/integrations/?filter_tenant=all`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setIntegrations(list.filter((i: Integration) => i.integration_type === "github"));
    } catch { setIntegrations([]); }
    setLoadingIntegrations(false);
  };

  useEffect(() => {
    if (showGithub && integrations.length === 0) loadIntegrations();
  }, [showGithub]);

  const handleCommit = async () => {
    if (!genomeResult || !selectedGithub) return;
    setCommitting(true);
    setCommitError(null);
    try {
      const res = await fetch("/api/video-genome/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_id: videoId,
          genome: genomeResult,
          application_name: applicationName || genomeResult.application_name || "app",
        }),
      });
      const data = await res.json();
      if (data.status === "error") {
        setCommitError(data.error || "Commit failed");
      } else {
        setCommitResult(data);
      }
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : "Commit failed");
    }
    setCommitting(false);
  };

  // Update file content when user edits
  const updateFileContent = (idx: number, content: string) => {
    setGenomeFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, content } : f)));
  };

  const removeFile = (idx: number) => {
    setGenomeFiles((prev) => prev.filter((_, i) => i !== idx));
    if (selectedFileIdx >= idx && selectedFileIdx > 0) setSelectedFileIdx(selectedFileIdx - 1);
  };

  const selectedFile = genomeFiles[selectedFileIdx] || null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
          <Video className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Video Genome</h1>
          <p className="text-sm text-gray-500">Upload a video walkthrough, extract the application genome, refine, and commit</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Video + Extract */}
        <div className="space-y-5">
          {/* Upload area */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Upload className="w-4 h-4 text-orange-500" />
              Video
            </h2>

            {!videoFile ? (
              <div onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition-colors">
                <Video className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-600 font-medium">Click to select a video</p>
                <p className="text-xs text-gray-400 mt-1">.mp4, .mov, .webm — up to 500 MB</p>
              </div>
            ) : (
              <div className="space-y-3">
                {videoUrl && (
                  <div className="rounded-xl overflow-hidden border border-gray-200 bg-black">
                    <video src={videoUrl} controls className="w-full max-h-[280px] object-contain" />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-700 truncate max-w-[200px]">{videoFile.name}</span>
                    <span className="text-[10px] text-gray-400">{(videoFile.size / (1024*1024)).toFixed(1)} MB</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {uploading && <Loader2 className="w-4 h-4 animate-spin text-orange-500" />}
                    {videoId && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    <button onClick={() => { setVideoFile(null); setVideoUrl(null); setVideoId(null); setGenomeResult(null); setGenomeFiles([]); setCommitResult(null); }}
                      className="text-xs text-gray-400 hover:text-gray-600">Change</button>
                  </div>
                </div>
                {uploadError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span className="whitespace-pre-wrap">{uploadError}</span>
                  </div>
                )}
              </div>
            )}
            <input ref={fileInputRef} type="file" accept=".mp4,.mov,.webm" className="hidden" onChange={handleFileSelect} />
          </div>

          {/* Notes + Extract */}
          {videoId && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Dna className="w-4 h-4 text-orange-500" />
                {extractionCount > 0 ? "Refine Extraction" : "Extract Genome"}
              </h2>

              {/* Application name */}
              <div className="mb-3">
                <label className="text-xs text-gray-600 mb-1 block">Application Name</label>
                <input type="text" value={applicationName} onChange={(e) => setApplicationName(e.target.value)}
                  placeholder="Auto-detected or enter manually"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-200 focus:border-orange-300 outline-none" />
              </div>

              {/* Notes / refinement prompt */}
              <div className="mb-4">
                <label className="text-xs text-gray-600 mb-1 block">
                  {extractionCount > 0 ? "Refinement instructions" : "Context notes (optional)"}
                </label>
                {extractionCount > 0 ? (
                  <textarea value={refinementPrompt} onChange={(e) => setRefinementPrompt(e.target.value)}
                    placeholder="e.g. Focus more on the approval workflows, add the notification rules I showed..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-200 focus:border-orange-300 outline-none resize-none"
                    rows={3} />
                ) : (
                  <textarea value={userNotes} onChange={(e) => setUserNotes(e.target.value)}
                    placeholder="e.g. This is a demo of ServiceNow ITSM showing incident management..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-200 focus:border-orange-300 outline-none resize-none"
                    rows={3} />
                )}
              </div>

              <button onClick={runExtraction} disabled={extracting}
                className="w-full py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {extracting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Extracting...</>
                ) : extractionCount > 0 ? (
                  <><RefreshCw className="w-4 h-4" /> Re-extract with Refinement</>
                ) : (
                  <><Play className="w-4 h-4" /> Extract Genome</>
                )}
              </button>

              {extractError && (
                <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span className="whitespace-pre-wrap">{extractError}</span>
                </div>
              )}

              {/* Extraction stats */}
              {genomeResult && !extracting && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-xs font-medium text-green-800">
                      {genomeResult.application_name || "App"} — {genomeResult.vendor || "Unknown"}
                    </span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-green-700">
                    <span>{genomeResult.genome_document?.objects?.length || 0} objects</span>
                    <span>{genomeResult.genome_document?.fields?.length || 0} fields</span>
                    <span>{genomeResult.genome_document?.workflows?.length || 0} workflows</span>
                    <span>{genomeResult.genome_document?.relationships?.length || 0} relationships</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GitHub + Commit */}
          {genomeFiles.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              {!showGithub ? (
                <button onClick={() => setShowGithub(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:border-orange-300 hover:text-orange-600 transition-colors">
                  <GitBranch className="w-4 h-4" />
                  Connect GitHub & Commit
                </button>
              ) : (
                <>
                  <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-orange-500" />
                    Commit to GitHub
                  </h2>

                  {/* Integration selector */}
                  {loadingIntegrations ? (
                    <div className="flex items-center gap-2 text-xs text-gray-400 py-4 justify-center">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
                    </div>
                  ) : integrations.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No GitHub integrations configured.</p>
                  ) : (
                    <div className="space-y-2 mb-4">
                      {integrations.map((intg) => {
                        const sel = selectedGithub?.id === intg.id;
                        return (
                          <button key={intg.id} onClick={() => setSelectedGithub(intg)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left text-sm transition-all ${
                              sel ? "border-orange-400 bg-orange-50" : "border-gray-200 hover:border-gray-300"
                            }`}>
                            <GitBranch className={`w-4 h-4 ${sel ? "text-orange-600" : "text-gray-400"}`} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 text-xs">{intg.name}</p>
                              <p className="text-[10px] text-gray-500 truncate">{intg.config?.default_repository || intg.config?.org || ""}</p>
                            </div>
                            {sel && <CheckCircle2 className="w-4 h-4 text-orange-500" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {commitResult ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-xs font-semibold text-green-800">Committed — {commitResult.file_count} files</span>
                      </div>
                      {commitResult.repo_url && (
                        <a href={commitResult.repo_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-green-700 hover:text-green-800 font-medium">
                          <GitBranch className="w-3 h-3" /> View in GitHub
                        </a>
                      )}
                    </div>
                  ) : (
                    <>
                      <button onClick={handleCommit} disabled={committing || !selectedGithub}
                        className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                        {committing ? <><Loader2 className="w-4 h-4 animate-spin" /> Committing...</> : <><Save className="w-4 h-4" /> Commit to GitHub</>}
                      </button>
                      {commitError && (
                        <p className="mt-2 text-xs text-red-600">{commitError}</p>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Right column: Genome files viewer/editor */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: "500px" }}>
          {genomeFiles.length > 0 ? (
            <>
              {/* File tabs */}
              <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 flex items-center gap-1 overflow-x-auto">
                <FolderTree className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mr-1" />
                {genomeFiles.map((f, i) => (
                  <button key={i} onClick={() => setSelectedFileIdx(i)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                      selectedFileIdx === i ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-white/60"
                    }`}>
                    <FileText className="w-3 h-3" />
                    {f.path.split("/").pop()}
                  </button>
                ))}
              </div>

              {/* File path + actions */}
              {selectedFile && (
                <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-gray-400 truncate">{selectedFile.path}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400">{selectedFile.content.length} chars</span>
                    <button onClick={() => removeFile(selectedFileIdx)} className="p-1 text-gray-300 hover:text-red-500" title="Remove file">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Editable content */}
              {selectedFile && (
                <textarea
                  value={selectedFile.content}
                  onChange={(e) => updateFileContent(selectedFileIdx, e.target.value)}
                  className="flex-1 px-4 py-3 font-mono text-xs text-gray-800 resize-none focus:outline-none leading-relaxed"
                  spellCheck={false}
                />
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
              <FolderTree className="w-10 h-10 text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-500">Genome Files</p>
              <p className="text-xs text-gray-400 mt-1 text-center">
                {videoId
                  ? 'Click "Extract Genome" to analyze the video and generate genome files.'
                  : "Upload a video to get started."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

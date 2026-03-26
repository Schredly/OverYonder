import { useState, useCallback } from "react";
import { streamGenomeTransform, streamGenomeTranslation } from "../services/genomeHydrationStream";
import type { HydrationPhase, FileFetched, LLMReasoning } from "../services/genomeHydrationStream";

const API = "/api/genome";

export interface DiffLine {
  type: "added" | "removed" | "context";
  content: string;
}

export interface FileEntry {
  path: string;
  content: string;
}

export interface FilesystemPlan {
  branch_name: string;
  base_path: string;
  folders: string[];
  files: FileEntry[];
}

export interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  showDiff?: boolean;
  filesystemPlan?: FilesystemPlan;
  diff?: string;
  preview?: string;
  reasoning?: string[];
}

export interface TranslationRecord {
  id: string;
  name: string;
  description: string;
  source_vendor: string;
  source_type: string;
  target_platform: string;
  instructions: string;
  status: string;
}

export function useGenomeStore() {
  const [selectedGenomePath, setSelectedGenomePath] = useState<string | null>(null);
  const [originalContent, setOriginalContent] = useState("");
  const [modifiedContent, setModifiedContent] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [loadingState, setLoadingState] = useState<"idle" | "loading" | "transforming" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<any[]>([]);
  const [filesystemPlan, setFilesystemPlan] = useState<FilesystemPlan | null>(null);
  const [savedBranch, setSavedBranch] = useState<string | null>(null);
  const [translations, setTranslations] = useState<TranslationRecord[]>([]);
  const [translationsLoading, setTranslationsLoading] = useState(false);
  const [targetFolder, setTargetFolder] = useState<string | null>(null);
  const [lastTranslationName, setLastTranslationName] = useState<string | null>(null);
  const [hydrationProgress, setHydrationProgress] = useState<{
    phase: string;
    message: string;
    filesFetched: string[];
    round: number;
  } | null>(null);

  const listGenomes = useCallback(async () => {
    setLoadingState("loading");
    try {
      const res = await fetch(`${API}/list`);
      const data = await res.json();
      setFileTree(data.files || []);
      setLoadingState("idle");
      return data;
    } catch {
      setLoadingState("error");
      setError("Failed to list genomes");
      return null;
    }
  }, []);

  const loadGenome = useCallback(async (path: string) => {
    setLoadingState("loading");
    setSelectedGenomePath(path);
    try {
      const res = await fetch(`${API}/load?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      setOriginalContent(data.content || "");
      setModifiedContent(data.content || "");
      setFilesystemPlan(null);
      setSavedBranch(null);
      setLoadingState("idle");
      return data;
    } catch {
      setLoadingState("error");
      setError("Failed to load genome");
      return null;
    }
  }, []);

  const chatWithGenome = useCallback(async (prompt: string) => {
    setLoadingState("transforming");
    try {
      // Build file tree string for context
      const treeStr = fileTree.length > 0
        ? JSON.stringify(fileTree.map((n: any) => n.name + (n.children ? '/' : '')).slice(0, 20))
        : "";

      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          content: modifiedContent || originalContent,
          file_tree: treeStr,
        }),
      });
      const data = await res.json();

      const msg: ChatMessage = {
        id: Date.now().toString(),
        type: "assistant",
        content: data.answer || data.error || "No response",
        timestamp: new Date(),
        reasoning: data.reasoning || [],
      };
      setChatHistory((prev) => [...prev, msg]);
      setLoadingState("idle");
      return data;
    } catch {
      setLoadingState("error");
      setError("Chat failed");
      return null;
    }
  }, [fileTree, modifiedContent, originalContent]);

  const transformGenome = useCallback(async (prompt: string, attachments?: string[]) => {
    setLoadingState("transforming");
    setSavedBranch(null);
    setHydrationProgress(null);

    let fullPrompt = prompt;
    if (attachments && attachments.length > 0) {
      fullPrompt += "\n\n--- ATTACHED FILES ---\n" + attachments.join("\n\n");
    }

    const fetchedFiles: string[] = [];

    try {
      await streamGenomeTransform(
        selectedGenomePath || "genomes",
        modifiedContent || originalContent || "",
        fullPrompt,
        {
          onPhase: (data) => {
            setHydrationProgress((prev) => ({
              phase: data.phase,
              message: data.message,
              filesFetched: prev?.filesFetched || [],
              round: prev?.round || 0,
            }));
          },
          onFileFetched: (data) => {
            fetchedFiles.push(data.path);
            setHydrationProgress((prev) => ({
              phase: prev?.phase || "retrieving",
              message: `Fetched: ${data.path}`,
              filesFetched: [...fetchedFiles],
              round: data.round,
            }));
          },
          onReasoning: (data) => {
            setHydrationProgress((prev) => ({
              phase: "reasoning",
              message: data.message,
              filesFetched: prev?.filesFetched || [],
              round: data.round,
            }));
          },
          onHydrationComplete: (data) => {
            setHydrationProgress((prev) => ({
              phase: "complete",
              message: `Done: ${data.rounds} round(s), ${data.files_fetched} file(s) fetched`,
              filesFetched: prev?.filesFetched || [],
              round: data.rounds,
            }));
          },
          onResult: (data) => {
            const newPlan = data.filesystem_plan as FilesystemPlan | undefined;
            setFilesystemPlan((prev) => {
              if (!newPlan || !newPlan.files || newPlan.files.length === 0) return prev;
              if (!prev) return newPlan;
              const existingPaths = new Set(prev.files.map((f) => f.path));
              return {
                ...prev,
                files: [...prev.files, ...newPlan.files.filter((f) => !existingPaths.has(f.path))],
                folders: [...new Set([...prev.folders, ...(newPlan.folders || [])])],
                branch_name: newPlan.branch_name || prev.branch_name,
              };
            });

            const fileCount = newPlan?.files?.length || 0;
            const explanation = data.explanation || "Transformation complete.";
            const summary = fileCount > 0
              ? `${explanation}\n\n${fileCount} file(s) ready to commit to branch: ${newPlan?.branch_name || ""}`
              : explanation;

            setChatHistory((prev) => [...prev, {
              id: Date.now().toString(), type: "assistant", content: summary, timestamp: new Date(),
              showDiff: true, filesystemPlan: newPlan, diff: data.diff || "", preview: data.preview || "",
              reasoning: data.reasoning || undefined,
            }]);
            setLoadingState("idle");
            setHydrationProgress(null);
          },
          onError: (data) => {
            let errText = `Transform failed: ${data.message}`;
            if (data.raw_response) errText += `\n\nLLM response:\n${data.raw_response.slice(0, 500)}`;
            setChatHistory((prev) => [...prev, {
              id: Date.now().toString(), type: "assistant", content: errText, timestamp: new Date(),
            }]);
            setLoadingState("idle");
            setHydrationProgress(null);
          },
        },
      );
    } catch {
      setLoadingState("error");
      setHydrationProgress(null);
      setError("Transform failed");
    }
  }, [selectedGenomePath, modifiedContent, originalContent]);

  const saveFilesystemPlan = useCallback(async () => {
    if (!filesystemPlan) return null;
    setLoadingState("saving");
    try {
      const res = await fetch(`${API}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filesystem_plan: filesystemPlan }),
      });
      const data = await res.json();

      if (data.status === "ok") {
        setSavedBranch(data.branch || filesystemPlan.branch_name);

        const saveMsg: ChatMessage = {
          id: Date.now().toString(),
          type: "assistant",
          content: `Saved ${data.file_count || 0} file(s) to branch: ${data.branch}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, saveMsg]);
      }

      setLoadingState("idle");
      return data;
    } catch {
      setLoadingState("error");
      setError("Save failed");
      return null;
    }
  }, [filesystemPlan]);

  const saveWithBranchName = useCallback(async (branchName: string) => {
    if (!filesystemPlan) return null;
    const updatedPlan = { ...filesystemPlan, branch_name: branchName };
    setFilesystemPlan(updatedPlan);
    setLoadingState("saving");
    try {
      const res = await fetch(`${API}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filesystem_plan: updatedPlan }),
      });
      const data = await res.json();
      if (data.status === "ok") {
        setSavedBranch(data.branch || branchName);
        const saveMsg: ChatMessage = {
          id: Date.now().toString(),
          type: "assistant",
          content: `Saved ${data.file_count || 0} file(s) to branch: ${data.branch}\nOutput: Genome Transformations/${branchName}/`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, saveMsg]);
      }
      setLoadingState("idle");
      return data;
    } catch {
      setLoadingState("error");
      setError("Save failed");
      return null;
    }
  }, [filesystemPlan]);

  const removeFileFromPlan = useCallback((index: number) => {
    setFilesystemPlan((prev) => {
      if (!prev) return prev;
      const newFiles = prev.files.filter((_, i) => i !== index);
      if (newFiles.length === 0) return null; // Clear plan if no files left
      return { ...prev, files: newFiles };
    });
  }, []);

  const clearPlan = useCallback(() => {
    setFilesystemPlan(null);
    setSavedBranch(null);
  }, []);

  const addUserMessage = useCallback((content: string) => {
    setChatHistory((prev) => [
      ...prev,
      { id: Date.now().toString(), type: "user", content, timestamp: new Date() },
    ]);
  }, []);

  const triggerAction = useCallback(async (action: string, payload: Record<string, any> = {}) => {
    try {
      const res = await fetch(`${API}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      return await res.json();
    } catch {
      return { status: "error", error: "Action failed" };
    }
  }, []);

  const fetchTranslations = useCallback(async (vendor?: string) => {
    setTranslationsLoading(true);
    try {
      const url = vendor
        ? `/api/admin/acme/translations/by-vendor/${encodeURIComponent(vendor)}`
        : `/api/admin/acme/translations`;
      const res = await fetch(url);
      const data = await res.json();
      setTranslations(data || []);
    } catch {
      setTranslations([]);
    }
    setTranslationsLoading(false);
  }, []);

  const runTranslation = useCallback(async (translationId: string, translationLabel?: string) => {
    setLoadingState("transforming");
    setSavedBranch(null);
    setError(null);
    setHydrationProgress(null);
    if (translationLabel) setLastTranslationName(translationLabel);

    const fetchedFiles: string[] = [];

    try {
      await streamGenomeTranslation(
        translationId,
        selectedGenomePath || "genomes",
        modifiedContent || originalContent || "",
        {
          onPhase: (data) => {
            setHydrationProgress((prev) => ({
              phase: data.phase,
              message: data.message,
              filesFetched: prev?.filesFetched || [],
              round: prev?.round || 0,
            }));
          },
          onFileFetched: (data) => {
            fetchedFiles.push(data.path);
            setHydrationProgress((prev) => ({
              phase: prev?.phase || "retrieving",
              message: `Fetched: ${data.path}`,
              filesFetched: [...fetchedFiles],
              round: data.round,
            }));
          },
          onReasoning: (data) => {
            setHydrationProgress((prev) => ({
              phase: "reasoning",
              message: data.message,
              filesFetched: prev?.filesFetched || [],
              round: data.round,
            }));
          },
          onHydrationComplete: (data) => {
            setHydrationProgress((prev) => ({
              phase: "complete",
              message: `Done: ${data.rounds} round(s), ${data.files_fetched} file(s) fetched`,
              filesFetched: prev?.filesFetched || [],
              round: data.rounds,
            }));
          },
          onResult: (data) => {
            const newPlan = data.filesystem_plan as FilesystemPlan | undefined;
            setFilesystemPlan((prev) => {
              if (!newPlan || !newPlan.files || newPlan.files.length === 0) return prev;
              if (!prev) return newPlan;
              const existingPaths = new Set(prev.files.map((f) => f.path));
              return {
                ...prev,
                files: [...prev.files, ...newPlan.files.filter((f) => !existingPaths.has(f.path))],
                folders: [...new Set([...prev.folders, ...(newPlan.folders || [])])],
                branch_name: newPlan.branch_name || prev.branch_name,
              };
            });

            const fileCount = newPlan?.files?.length || 0;
            const explanation = data.explanation || "Translation applied.";
            const summary = fileCount > 0
              ? `${explanation}\n\n${fileCount} file(s) ready to commit to branch: ${newPlan?.branch_name || ""}`
              : explanation;

            setChatHistory((prev) => [...prev, {
              id: Date.now().toString(), type: "assistant", content: summary, timestamp: new Date(),
              showDiff: true, filesystemPlan: newPlan, diff: data.diff || "", preview: data.preview || "",
              reasoning: data.reasoning || undefined,
            }]);
            setLoadingState("idle");
            setHydrationProgress(null);
          },
          onError: (data) => {
            let errText = `Translation failed: ${data.message}`;
            if (data.raw_response) errText += `\n\nLLM response:\n${data.raw_response.slice(0, 500)}`;
            setChatHistory((prev) => [...prev, {
              id: Date.now().toString(), type: "assistant", content: errText, timestamp: new Date(),
            }]);
            setLoadingState("idle");
            setHydrationProgress(null);
          },
        },
      );
    } catch (e) {
      setChatHistory((prev) => [...prev, {
        id: Date.now().toString(), type: "assistant",
        content: `Translation failed: ${e instanceof Error ? e.message : "Network error"}`,
        timestamp: new Date(),
      }]);
      setLoadingState("idle");
      setHydrationProgress(null);
      setError("Translation failed");
    }
  }, [selectedGenomePath, modifiedContent, originalContent]);

  const generateTranslationRecipe = useCallback(async (sourceVendor: string, targetPlatform: string) => {
    // Gather chat context — extract user messages as context
    const chatContext = chatHistory
      .filter((m) => m.type === "user")
      .map((m) => m.content)
      .join("\n");

    const outputFiles = filesystemPlan?.files?.map((f) => ({ path: f.path, content: f.content })) || [];

    try {
      const res = await fetch(`${API}/generate-translation-recipe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_content: originalContent || "",
          output_files: outputFiles,
          chat_context: chatContext,
          source_vendor: sourceVendor,
          target_platform: targetPlatform,
        }),
      });
      return await res.json();
    } catch {
      return { status: "error", error: "Failed to generate recipe" };
    }
  }, [chatHistory, filesystemPlan, originalContent]);

  const extractVideoGenome = useCallback(async (videoId: string, userNotes: string = "") => {
    setLoadingState("transforming");
    setSavedBranch(null);
    setError(null);
    try {
      const res = await fetch(`${API}/video-extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: videoId, user_notes: userNotes }),
      });
      const data = await res.json();

      if (data.status === "error") {
        let errText = `Video extraction failed: ${data.error || "Unknown error"}`;
        if (data.raw_response) errText += `\n\nLLM response:\n${data.raw_response.slice(0, 500)}`;
        setChatHistory(prev => [...prev, { id: Date.now().toString(), type: "assistant", content: errText, timestamp: new Date() }]);
        setLoadingState("idle");
        return data;
      }

      const newPlan = data.filesystem_plan as FilesystemPlan | undefined;
      setFilesystemPlan(prev => {
        if (!newPlan?.files?.length) return prev;
        if (!prev) return newPlan;
        const existingPaths = new Set(prev.files.map(f => f.path));
        return { ...prev, files: [...prev.files, ...newPlan.files.filter(f => !existingPaths.has(f.path))], folders: [...new Set([...prev.folders, ...(newPlan.folders || [])])], branch_name: newPlan.branch_name || prev.branch_name };
      });

      const fileCount = newPlan?.files?.length || 0;
      const msg = data.message || data.explanation || "Video genome extracted.";
      const summary = fileCount > 0 ? `${msg}\n\n${fileCount} file(s) ready to commit to branch: ${newPlan?.branch_name || ""}` : msg;

      setChatHistory(prev => [...prev, {
        id: Date.now().toString(), type: "assistant", content: summary, timestamp: new Date(),
        showDiff: true, filesystemPlan: newPlan, reasoning: data.reasoning || undefined,
      }]);
      setLoadingState("idle");
      return data;
    } catch (e) {
      setChatHistory(prev => [...prev, { id: Date.now().toString(), type: "assistant", content: `Video extraction failed: ${e instanceof Error ? e.message : "Network error"}`, timestamp: new Date() }]);
      setLoadingState("idle");
      return null;
    }
  }, []);

  const saveAsTranslation = useCallback(async (recipe: {
    name: string;
    description?: string;
    source_vendor?: string;
    source_type?: string;
    target_platform?: string;
    instructions: string;
    output_structure?: Record<string, any>;
  }) => {
    try {
      const res = await fetch(`${API}/save-translation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recipe),
      });
      const data = await res.json();
      // Refresh translations list after saving
      if (data.status === "ok") {
        fetchTranslations();
      }
      return data;
    } catch {
      return { status: "error", error: "Failed to save translation" };
    }
  }, [fetchTranslations]);

  return {
    selectedGenomePath,
    originalContent,
    modifiedContent,
    chatHistory,
    loadingState,
    error,
    fileTree,
    filesystemPlan,
    savedBranch,
    setSelectedGenomePath,
    listGenomes,
    loadGenome,
    chatWithGenome,
    transformGenome,
    saveFilesystemPlan,
    removeFileFromPlan,
    clearPlan,
    addUserMessage,
    triggerAction,
    translations,
    translationsLoading,
    fetchTranslations,
    runTranslation,
    extractVideoGenome,
    generateTranslationRecipe,
    saveAsTranslation,
    targetFolder,
    setTargetFolder,
    lastTranslationName,
    saveWithBranchName,
    hydrationProgress,
  };
}

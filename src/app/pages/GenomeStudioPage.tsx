import { useEffect, useState, useCallback, useRef } from "react";
import { GenomeExplorer } from "./genome-studio/GenomeExplorer";
import { ChatInterface } from "./genome-studio/ChatInterface";
import { GenomeWorkspace } from "./genome-studio/GenomeWorkspace";
import { IntegrationsSidebar } from "./genome-studio/IntegrationsSidebar";
import { SaveTranslationModal } from "./genome-studio/SaveTranslationModal";
import { CommitDialog } from "./genome-studio/CommitDialog";
import { useGenomeStore } from "../store/useGenomeStore";
import type { SavedTransformation } from "../store/useGenomeStore";

function findFileInTree(nodes: any[], targetPath: string): boolean {
  for (const node of nodes) {
    if (node.path === targetPath) return true;
    if (node.children && findFileInTree(node.children, targetPath)) return true;
  }
  return false;
}

export default function GenomeStudioPage() {
  const store = useGenomeStore();
  const [connectedRepo, setConnectedRepo] = useState<string | null>(null);
  const [repoLoading, setRepoLoading] = useState(false);
  const [workspaceExpanded, setWorkspaceExpanded] = useState(false);
  const [chatHeight, setChatHeight] = useState(60); // percentage
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientY - rect.top) / rect.height) * 100;
      setChatHeight(Math.max(15, Math.min(85, pct)));
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleConnectRepo = async (repoName: string) => {
    setRepoLoading(true);
    setConnectedRepo(repoName);
    store.setRepoAndLoadTransformations(repoName);
    await store.listGenomes();
    setRepoLoading(false);
  };

  const getActiveContext = () => {
    if (!store.selectedGenomePath) return "No file selected";
    const parts = store.selectedGenomePath.split("/");
    const vendorIdx = parts.indexOf("vendors");
    const vendor = vendorIdx >= 0 ? parts[vendorIdx + 1] : "unknown";
    const genome = parts[parts.length - 2];
    return `${vendor} / ${genome}`;
  };

  const getVendorFromPath = (path: string | null) => {
    if (!path) return "";
    const parts = path.split("/");
    const vendorIdx = parts.indexOf("vendors");
    return vendorIdx >= 0 ? parts[vendorIdx + 1] || "" : "";
  };

  const handleFileSelect = (path: string) => {
    store.setSelectedGenomePath(path);
    store.loadGenome(path);
  };

  const handleFolderTarget = (folderPath: string) => {
    store.setTargetFolder(folderPath);
    // Auto-load the genome.yaml in this folder so transforms target the correct content
    const genomePath = folderPath + "/genome.yaml";
    // Check if this folder likely contains a genome by looking in the file tree
    const hasGenome = findFileInTree(store.fileTree, genomePath);
    if (hasGenome) {
      store.setSelectedGenomePath(genomePath);
      store.loadGenome(genomePath);
    }
  };

  const handleFetchTranslations = () => {
    store.fetchTranslations();
  };

  const handleRunTranslation = async (translationId: string) => {
    const translation = store.translations.find((t) => t.id === translationId);
    const name = translation?.name || translationId;

    store.addUserMessage(`Run translation: ${name}`);

    return await store.runTranslation(translationId, name);
  };

  const handleSaveAsTranslation = () => {
    setShowSaveModal(true);
  };

  const handleSendMessage = async (content: string, attachments?: string[]) => {
    store.addUserMessage(content);

    // Check for video attachments — only extract genome when explicitly asked
    const videoAttachment = attachments?.find(a => a.startsWith("[video:"));
    if (videoAttachment) {
      const videoId = videoAttachment.match(/\[video:(vid_[a-f0-9]+)\]/)?.[1];
      if (videoId && /extract.*genome/i.test(content)) {
        await store.extractVideoGenome(videoId, content);
        return;
      }
    }

    const lower = content.toLowerCase();
    const isTransform = /\b(create|add|convert|store|save|move|extract|generate|build|write|make|transform|turn|put|commit)\b/.test(lower);
    const isQuestion = !isTransform && (
      /^(what|tell|describe|explain|read|show|list|analyze|how|why|is |are |do |does |can )/.test(lower)
      || lower.includes("?")
    );

    if (isQuestion && !attachments?.length) {
      await store.chatWithGenome(content);
    } else {
      await store.transformGenome(content, attachments);
    }
  };

  const handleSave = async () => {
    setShowCommitDialog(true);
  };

  // Build a suggested branch name from context
  const getSuggestedBranchName = () => {
    const folderSlug = store.targetFolder
      ? store.targetFolder.split('/').filter(Boolean).slice(-1)[0] || 'genome'
      : 'genome';
    const recipeSlug = store.lastTranslationName
      ? store.lastTranslationName
          .replace(/[^a-zA-Z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .toLowerCase()
          .slice(0, 30)
      : 'transform';
    return `${folderSlug}-${recipeSlug}-v1.0`;
  };

  const handleDownloadTransformation = (transformation: SavedTransformation) => {
    const files = transformation.files;
    if (!files.length) return;

    // Build a zip (same minimal format as CommitDialog)
    const encoder = new TextEncoder();
    const localParts: Uint8Array[] = [];
    const centralParts: Uint8Array[] = [];
    const offsets: number[] = [];
    let offset = 0;

    for (const file of files) {
      const nameBytes = encoder.encode(file.path);
      const dataBytes = encoder.encode(file.content);
      const local = new ArrayBuffer(30 + nameBytes.length + dataBytes.length);
      const lv = new DataView(local);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(8, 0, true);
      lv.setUint32(18, dataBytes.length, true);
      lv.setUint32(22, dataBytes.length, true);
      lv.setUint16(26, nameBytes.length, true);
      const localArr = new Uint8Array(local);
      localArr.set(nameBytes, 30);
      localArr.set(dataBytes, 30 + nameBytes.length);
      offsets.push(offset);
      localParts.push(localArr);
      offset += localArr.length;

      const central = new ArrayBuffer(46 + nameBytes.length);
      const cv = new DataView(central);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint32(20, dataBytes.length, true);
      cv.setUint32(24, dataBytes.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint32(42, offsets[offsets.length - 1], true);
      const centralArr = new Uint8Array(central);
      centralArr.set(nameBytes, 46);
      centralParts.push(centralArr);
    }

    const centralSize = centralParts.reduce((s, c) => s + c.length, 0);
    const eocd = new ArrayBuffer(22);
    const ev = new DataView(eocd);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);

    const blob = new Blob([...localParts, ...centralParts, new Uint8Array(eocd)], { type: 'application/zip' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${transformation.branchName}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleSelectTransformation = async (transformation: SavedTransformation) => {
    // Load the transformation's files back into the workspace
    store.restoreFilesystemPlan({
      branch_name: transformation.branchName,
      base_path: transformation.targetFolder || "",
      folders: [],
      files: transformation.files,
    });

    // Also load the underlying genome so transforms/translations target the correct content
    if (transformation.targetFolder) {
      const genomePath = transformation.targetFolder + "/genome.yaml";
      store.setTargetFolder(transformation.targetFolder);
      store.setSelectedGenomePath(genomePath);
      await store.loadGenome(genomePath);
    }
  };

  const handleViewTransformationFile = (_path: string, content: string) => {
    // Show the file content in the Source tab
    store.setSelectedGenomePath(null);
    store.loadContentDirect(content);
  };

  const handleRunTranslationOnBranch = async (branchName: string) => {
    // Find the transformation to get its target folder and load the correct genome
    const transformation = store.savedTransformations.find((t) => t.branchName === branchName);
    if (transformation?.targetFolder) {
      const genomePath = transformation.targetFolder + "/genome.yaml";
      store.setTargetFolder(transformation.targetFolder);
      store.setSelectedGenomePath(genomePath);
      await store.loadGenome(genomePath);
    }
    store.addUserMessage(`Run a new translation on branch: ${branchName}`);
  };

  const handleCommitConfirm = async (branchName: string) => {
    const result = await store.saveWithBranchName(branchName);
    if (result?.status === 'ok') {
      setShowCommitDialog(false);
    }
    return result;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {!workspaceExpanded && (
        <GenomeExplorer
          onFileSelect={handleFileSelect}
          selectedFile={store.selectedGenomePath}
          targetFolder={store.targetFolder}
          onFolderTarget={handleFolderTarget}
          fileTree={store.fileTree}
          repoName={connectedRepo}
          isLoading={repoLoading}
          savedTransformations={store.savedTransformations}
          onRunTranslationOnBranch={handleRunTranslationOnBranch}
          onDownloadTransformation={handleDownloadTransformation}
          onSelectTransformation={handleSelectTransformation}
          onViewTransformationFile={handleViewTransformationFile}
        />
      )}
      <div ref={containerRef} className="flex-1 flex flex-col min-w-0">
        <div style={{ height: `${chatHeight}%` }} className="min-h-0 flex-shrink-0">
          <ChatInterface
            activeContext={getActiveContext()}
            messages={store.chatHistory}
            onSend={handleSendMessage}
            isThinking={store.loadingState === "transforming"}
            expanded={workspaceExpanded}
            onToggleExpand={() => {
              setWorkspaceExpanded(!workspaceExpanded);
              if (!workspaceExpanded) setChatHeight(35);
              else setChatHeight(60);
            }}
            hydrationProgress={store.hydrationProgress}
          />
        </div>
        {/* Drag handle */}
        <div onMouseDown={handleMouseDown}
          className="h-1.5 bg-gray-100 hover:bg-orange-200 cursor-row-resize flex-shrink-0 flex items-center justify-center border-y border-gray-200 transition-colors">
          <div className="w-8 h-0.5 bg-gray-300 rounded-full" />
        </div>
        <div className="flex-1 min-h-0">
          <GenomeWorkspace
            originalContent={store.originalContent}
            selectedPath={store.selectedGenomePath}
            filesystemPlan={store.filesystemPlan}
            onSave={handleSave}
            onRemoveFile={store.removeFileFromPlan}
            onClearPlan={store.clearPlan}
            isSaving={store.loadingState === "saving"}
            savedBranch={store.savedBranch}
            expanded={workspaceExpanded}
            translations={store.translations}
            translationsLoading={store.translationsLoading}
            onFetchTranslations={handleFetchTranslations}
            onRunTranslation={handleRunTranslation}
            onSaveAsTranslation={handleSaveAsTranslation}
            isTransforming={store.loadingState === "transforming"}
            repoConnected={!!connectedRepo}
            targetFolder={store.targetFolder}
          />
        </div>
      </div>
      {!workspaceExpanded && (
        <IntegrationsSidebar
          filesystemPlan={store.filesystemPlan}
          onCommit={handleSave}
          isSaving={store.loadingState === "saving"}
          savedBranch={store.savedBranch}
          onConnectRepo={handleConnectRepo}
          onDisconnectRepo={() => { setConnectedRepo(null); store.setRepoAndLoadTransformations(null); }}
          connectedRepo={connectedRepo}
        />
      )}

      {/* Save as Translation Modal */}
      {showSaveModal && (
        <SaveTranslationModal
          sourceVendor={getVendorFromPath(store.selectedGenomePath)}
          onGenerate={store.generateTranslationRecipe}
          onSave={store.saveAsTranslation}
          onClose={() => setShowSaveModal(false)}
          hasOutputFiles={!!store.filesystemPlan?.files?.length}
        />
      )}

      {/* Commit Dialog */}
      {showCommitDialog && store.filesystemPlan && (
        <CommitDialog
          suggestedBranchName={getSuggestedBranchName()}
          targetFolder={store.targetFolder}
          translationName={store.lastTranslationName}
          fileCount={store.filesystemPlan.files.length}
          files={store.filesystemPlan.files}
          onCommit={handleCommitConfirm}
          onCancel={() => setShowCommitDialog(false)}
          isCommitting={store.loadingState === "saving"}
        />
      )}
    </div>
  );
}

import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, Search, GitBranch, Loader2, Crosshair, Download, Play, Package, ChevronUp, ArrowLeft } from 'lucide-react';
import type { SavedTransformation, FileEntry } from '../../store/useGenomeStore';

interface FileNode {
  name: string;
  type: string;
  children?: FileNode[];
  path: string;
}

function TreeNode({ node, level, selectedFile, targetFolder, onFileSelect, onFolderTarget }: {
  node: FileNode; level: number; selectedFile: string | null; targetFolder: string | null; onFileSelect: (path: string) => void; onFolderTarget: (path: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(level < 3);
  const [isHovered, setIsHovered] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const isFolder = node.type === 'dir' || node.type === 'folder';
  const isSelected = selectedFile === node.path;
  const isTarget = targetFolder === node.path;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const url = `/api/genome/download-zip?path=${encodeURIComponent(node.path)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${node.name}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer rounded-md transition-colors ${
          isTarget ? 'bg-orange-100 text-orange-800 ring-1 ring-orange-300' :
          isSelected ? 'bg-orange-50 text-orange-700' :
          'text-gray-700 hover:bg-gray-100'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => {
          if (isFolder) {
            setIsOpen(!isOpen);
            onFolderTarget(node.path);
          } else {
            onFileSelect(node.path);
          }
        }}
      >
        {isFolder ? (
          <>
            {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
            {isTarget ? (
              <FolderOpen className="w-4 h-4 text-orange-600 flex-shrink-0" />
            ) : isOpen ? (
              <FolderOpen className="w-4 h-4 text-orange-500 flex-shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-orange-500 flex-shrink-0" />
            )}
          </>
        ) : (
          <>
            <div className="w-3.5" />
            <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </>
        )}
        <span className="text-sm truncate">{node.name}</span>
        <div className="ml-auto flex items-center gap-1 flex-shrink-0">
          {isTarget && <Crosshair className="w-3 h-3 text-orange-600" />}
          {isFolder && (isHovered || isDownloading) && (
            <button
              onClick={handleDownload}
              title={`Download ${node.name} as zip`}
              className="p-0.5 rounded hover:bg-orange-200 transition-colors"
            >
              {isDownloading
                ? <Loader2 className="w-3 h-3 text-orange-500 animate-spin" />
                : <Download className="w-3 h-3 text-orange-500" />
              }
            </button>
          )}
        </div>
      </div>
      {isFolder && isOpen && node.children && node.children.map((child: FileNode) => (
        <TreeNode key={child.path} node={child} level={level + 1} selectedFile={selectedFile} targetFolder={targetFolder} onFileSelect={onFileSelect} onFolderTarget={onFolderTarget} />
      ))}
    </div>
  );
}

function TransformationItem({ transformation, isActive, onSelect, onRunTranslation, onDownload }: {
  transformation: SavedTransformation;
  isActive?: boolean;
  onSelect?: (t: SavedTransformation) => void;
  onRunTranslation?: (branchName: string) => void;
  onDownload?: (t: SavedTransformation) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloading || !onDownload) return;
    setIsDownloading(true);
    try {
      onDownload(transformation);
    } finally {
      setIsDownloading(false);
    }
  };

  const timeAgo = (date: Date) => {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div
      className={`px-3 py-2 cursor-pointer border-b border-gray-50 transition-colors ${
        isActive ? 'bg-orange-50 ring-1 ring-orange-200' : 'hover:bg-gray-50'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect?.(transformation)}
    >
      <div className="flex items-start gap-2">
        <GitBranch className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${isActive ? 'text-orange-600' : 'text-orange-500'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-800 truncate" title={transformation.branchName}>
            {transformation.branchName}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {transformation.fileCount} file{transformation.fileCount !== 1 ? 's' : ''}
            {transformation.translationName && (
              <span className="text-orange-600"> · {transformation.translationName}</span>
            )}
          </p>
          <p className="text-[10px] text-gray-400">{timeAgo(transformation.savedAt)}</p>
        </div>
        {isHovered && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {onRunTranslation && (
              <button
                onClick={(e) => { e.stopPropagation(); onRunTranslation(transformation.branchName); }}
                title="Run translation on this branch"
                className="p-1 rounded hover:bg-orange-100 transition-colors"
              >
                <Play className="w-3 h-3 text-orange-600" />
              </button>
            )}
            {onDownload && (
              <button
                onClick={handleDownload}
                title="Download as zip"
                className="p-1 rounded hover:bg-orange-100 transition-colors"
              >
                {isDownloading
                  ? <Loader2 className="w-3 h-3 text-orange-500 animate-spin" />
                  : <Download className="w-3 h-3 text-orange-500" />
                }
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Renders a transformation's files as a browsable file tree */
function TransformationFileTree({ files, selectedFile, onFileSelect }: {
  files: FileEntry[];
  selectedFile: string | null;
  onFileSelect: (path: string, content: string) => void;
}) {
  // Build a tree structure from flat file paths
  interface TreeEntry {
    name: string;
    path: string;
    content?: string;
    children: TreeEntry[];
  }

  const root: TreeEntry[] = [];

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      let existing = current.find((c) => c.name === part);
      if (!existing) {
        existing = {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          content: isFile ? file.content : undefined,
          children: [],
        };
        current.push(existing);
      }
      current = existing.children;
    }
  }

  return (
    <div className="p-2">
      {root.map((entry) => (
        <TransformationTreeNode key={entry.path} entry={entry} level={0} selectedFile={selectedFile} onFileSelect={onFileSelect} />
      ))}
    </div>
  );
}

function TransformationTreeNode({ entry, level, selectedFile, onFileSelect }: {
  entry: { name: string; path: string; content?: string; children: any[] };
  level: number;
  selectedFile: string | null;
  onFileSelect: (path: string, content: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const isFolder = entry.children.length > 0 && entry.content === undefined;
  const isSelected = selectedFile === `transformation://${entry.path}`;

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer rounded-md transition-colors ${
          isSelected ? 'bg-orange-50 text-orange-700' : 'text-gray-700 hover:bg-gray-100'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => {
          if (isFolder) {
            setIsOpen(!isOpen);
          } else if (entry.content !== undefined) {
            onFileSelect(`transformation://${entry.path}`, entry.content);
          }
        }}
      >
        {isFolder ? (
          <>
            {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
            {isOpen ? (
              <FolderOpen className="w-4 h-4 text-orange-500 flex-shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-orange-500 flex-shrink-0" />
            )}
          </>
        ) : (
          <>
            <div className="w-3.5" />
            <FileText className="w-4 h-4 text-orange-400 flex-shrink-0" />
          </>
        )}
        <span className="text-sm truncate">{entry.name}</span>
      </div>
      {isFolder && isOpen && entry.children.map((child: any) => (
        <TransformationTreeNode key={child.path} entry={child} level={level + 1} selectedFile={selectedFile} onFileSelect={onFileSelect} />
      ))}
    </div>
  );
}

interface GenomeExplorerProps {
  onFileSelect: (path: string) => void;
  selectedFile: string | null;
  targetFolder: string | null;
  onFolderTarget: (path: string) => void;
  fileTree?: FileNode[];
  repoName?: string | null;
  isLoading?: boolean;
  savedTransformations?: SavedTransformation[];
  onRunTranslationOnBranch?: (branchName: string) => void;
  onDownloadTransformation?: (transformation: SavedTransformation) => void;
  onSelectTransformation?: (transformation: SavedTransformation) => void;
  onViewTransformationFile?: (path: string, content: string) => void;
}

function filterTree(nodes: FileNode[], query: string): FileNode[] {
  if (!query) return nodes;
  const q = query.toLowerCase();
  const result: FileNode[] = [];
  for (const node of nodes) {
    if (node.name.toLowerCase().includes(q)) {
      result.push(node);
    } else if (node.children) {
      const filtered = filterTree(node.children, query);
      if (filtered.length > 0) {
        result.push({ ...node, children: filtered });
      }
    }
  }
  return result;
}

export function GenomeExplorer({ onFileSelect, selectedFile, targetFolder, onFolderTarget, fileTree, repoName, isLoading, savedTransformations, onRunTranslationOnBranch, onDownloadTransformation, onSelectTransformation, onViewTransformationFile }: GenomeExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [transformationsExpanded, setTransformationsExpanded] = useState(false);
  const [expandedTransformation, setExpandedTransformation] = useState<SavedTransformation | null>(null);
  const [selectedTransformFile, setSelectedTransformFile] = useState<string | null>(null);
  const tree = fileTree && fileTree.length > 0 ? fileTree : [];
  const filteredTree = searchQuery ? filterTree(tree, searchQuery) : tree;

  const targetFullLabel = targetFolder
    ? targetFolder.split('/').filter(Boolean).slice(-2).join(' / ')
    : null;

  const handleExpandTransformations = () => {
    setTransformationsExpanded(true);
    // Auto-select the first one if nothing selected
    if (!expandedTransformation && savedTransformations && savedTransformations.length > 0) {
      setExpandedTransformation(savedTransformations[0]);
      onSelectTransformation?.(savedTransformations[0]);
    }
  };

  const handleTransformationClick = (t: SavedTransformation) => {
    // Select this branch (in expanded view, just switch — don't toggle)
    setExpandedTransformation(t);
    setSelectedTransformFile(null);
    onSelectTransformation?.(t);
  };

  const handleCollapseTransformations = () => {
    setTransformationsExpanded(false);
    setExpandedTransformation(null);
    setSelectedTransformFile(null);
  };

  const handleTransformFileSelect = (path: string, content: string) => {
    setSelectedTransformFile(path);
    onViewTransformationFile?.(path, content);
  };

  const hasTransformations = savedTransformations && savedTransformations.length > 0;

  // When transformations are expanded, show the full transformations view
  if (transformationsExpanded && hasTransformations) {
    return (
      <div className="w-64 h-screen bg-gray-50 border-r border-gray-200 flex flex-col">
        {/* Header — click to collapse back to genomes */}
        <div
          className="p-3 border-b border-orange-200 bg-orange-50 cursor-pointer hover:bg-orange-100 transition-colors"
          onClick={handleCollapseTransformations}
        >
          <div className="flex items-center gap-2">
            <ArrowLeft className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
            <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Back to Genomes</span>
          </div>
        </div>

        {/* All branches — selectable list */}
        <div className="border-b border-gray-200 bg-white">
          <div className="px-3 py-1.5">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Branches</span>
          </div>
          <div className="max-h-44 overflow-y-auto">
            {savedTransformations!.map((t) => (
              <div
                key={t.id}
                className={`px-3 py-2 cursor-pointer transition-colors border-l-2 ${
                  expandedTransformation?.id === t.id
                    ? 'bg-orange-50 border-l-orange-500'
                    : 'border-l-transparent hover:bg-gray-50'
                }`}
                onClick={() => handleTransformationClick(t)}
              >
                <div className="flex items-center gap-2">
                  <GitBranch className={`w-3.5 h-3.5 flex-shrink-0 ${
                    expandedTransformation?.id === t.id ? 'text-orange-600' : 'text-gray-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs truncate ${
                      expandedTransformation?.id === t.id ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
                    }`} title={t.branchName}>
                      {t.branchName}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {t.fileCount} file{t.fileCount !== 1 ? 's' : ''}
                      {t.translationName && (
                        <span className="text-orange-600"> · {t.translationName}</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected branch detail + file tree */}
        {expandedTransformation ? (
          <>
            {/* Action buttons for selected branch */}
            <div className="px-3 py-2 border-b border-gray-200 bg-white flex items-center gap-1.5">
              {onRunTranslationOnBranch && (
                <button
                  onClick={() => onRunTranslationOnBranch(expandedTransformation.branchName)}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded hover:bg-orange-100 transition-colors"
                >
                  <Play className="w-3 h-3" />
                  Run Translation
                </button>
              )}
              {onDownloadTransformation && (
                <button
                  onClick={() => onDownloadTransformation(expandedTransformation)}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Download
                </button>
              )}
            </div>

            {/* File tree for selected branch */}
            <div className="flex-1 overflow-y-auto">
              <TransformationFileTree
                files={expandedTransformation.files}
                selectedFile={selectedTransformFile}
                onFileSelect={handleTransformFileSelect}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 px-4 text-center">
            <p className="text-xs">Select a branch above to browse its files</p>
          </div>
        )}
      </div>
    );
  }

  // Default view: genome file tree with transformations footer
  return (
    <div className="w-64 h-screen bg-gray-50 border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200 bg-white">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Repository</h2>
        {repoName ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg">
            <GitBranch className="w-4 h-4 text-green-500" />
            <span className="text-sm flex-1 truncate">{repoName}</span>
            <span className="text-xs text-gray-500">(main)</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-gray-400">
            <GitBranch className="w-4 h-4" />
            <span className="text-sm">Select a GitHub integration</span>
          </div>
        )}
      </div>

      {/* Target folder indicator */}
      {targetFolder && (
        <div className="px-3 py-2 bg-orange-50 border-b border-orange-200">
          <div className="flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
            <span className="text-[10px] font-semibold text-orange-700 uppercase tracking-wide">Transform Target</span>
          </div>
          <p className="text-xs text-orange-800 font-medium mt-0.5 truncate" title={targetFolder}>
            {targetFullLabel}
          </p>
        </div>
      )}

      <div className="p-3 border-b border-gray-200 bg-white">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search genomes..." className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex flex-col items-center py-8 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mb-2" />
            <span className="text-xs">Loading repository...</span>
          </div>
        ) : !repoName ? (
          <div className="flex flex-col items-center py-12 text-gray-400 px-4 text-center">
            <GitBranch className="w-6 h-6 mb-2" />
            <span className="text-xs">Click a GitHub integration on the right to load its repository</span>
          </div>
        ) : tree.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-gray-400">
            <span className="text-xs">No files found in repository</span>
          </div>
        ) : filteredTree.length === 0 && searchQuery ? (
          <div className="text-center py-6 text-gray-400">
            <span className="text-xs">No matches for "{searchQuery}"</span>
          </div>
        ) : filteredTree.map((node) => (
          <TreeNode key={node.path} node={node} level={0} selectedFile={selectedFile} targetFolder={targetFolder} onFileSelect={onFileSelect} onFolderTarget={onFolderTarget} />
        ))}
      </div>

      {/* Transformations Section — click header to expand full view */}
      {hasTransformations && (
        <div className="border-t border-gray-200 bg-white">
          <div
            className="px-4 py-2.5 border-b border-gray-100 cursor-pointer hover:bg-orange-50 transition-colors"
            onClick={handleExpandTransformations}
          >
            <div className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-orange-600" />
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Transformations</span>
              <span className="ml-auto flex items-center gap-1">
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{savedTransformations!.length}</span>
                <ChevronUp className="w-3 h-3 text-gray-400" />
              </span>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {savedTransformations!.map((t) => (
              <TransformationItem
                key={t.id}
                transformation={t}
                onSelect={(clicked) => { handleTransformationClick(clicked); setTransformationsExpanded(true); }}
                onRunTranslation={onRunTranslationOnBranch}
                onDownload={onDownloadTransformation}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

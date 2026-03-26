import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, Search, GitBranch, Loader2, Crosshair, Download } from 'lucide-react';

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

interface GenomeExplorerProps {
  onFileSelect: (path: string) => void;
  selectedFile: string | null;
  targetFolder: string | null;
  onFolderTarget: (path: string) => void;
  fileTree?: FileNode[];
  repoName?: string | null;
  isLoading?: boolean;
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

export function GenomeExplorer({ onFileSelect, selectedFile, targetFolder, onFolderTarget, fileTree, repoName, isLoading }: GenomeExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const tree = fileTree && fileTree.length > 0 ? fileTree : [];
  const filteredTree = searchQuery ? filterTree(tree, searchQuery) : tree;

  // Derive a friendly label from the target folder path
  const targetLabel = targetFolder
    ? targetFolder.split('/').filter(Boolean).slice(-1)[0] || targetFolder
    : null;
  const targetFullLabel = targetFolder
    ? targetFolder.split('/').filter(Boolean).slice(-2).join(' / ')
    : null;

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
    </div>
  );
}

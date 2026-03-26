import { useState } from 'react';
import { GitBranch, Save, X, Loader2, FolderOpen, Languages, Download } from 'lucide-react';
import type { FileEntry } from '../../store/useGenomeStore';

interface CommitDialogProps {
  suggestedBranchName: string;
  targetFolder: string | null;
  translationName: string | null;
  fileCount: number;
  files: FileEntry[];
  onCommit: (branchName: string) => void;
  onCancel: () => void;
  isCommitting: boolean;
}

function downloadZip(files: FileEntry[], zipName: string) {
  // Build a zip using the minimal local-file-header + central-directory format.
  // This avoids needing a library — works for text files which is all we produce.
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const offsets: number[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const dataBytes = encoder.encode(file.content);

    // Local file header (30 + nameLen + dataLen)
    const local = new ArrayBuffer(30 + nameBytes.length + dataBytes.length);
    const lv = new DataView(local);
    lv.setUint32(0, 0x04034b50, true);   // signature
    lv.setUint16(4, 20, true);            // version needed
    lv.setUint16(6, 0, true);             // flags
    lv.setUint16(8, 0, true);             // compression: stored
    lv.setUint16(10, 0, true);            // mod time
    lv.setUint16(12, 0, true);            // mod date
    lv.setUint32(14, 0, true);            // crc32 (0 for simplicity)
    lv.setUint32(18, dataBytes.length, true); // compressed size
    lv.setUint32(22, dataBytes.length, true); // uncompressed size
    lv.setUint16(26, nameBytes.length, true); // file name length
    lv.setUint16(28, 0, true);            // extra field length
    const localArr = new Uint8Array(local);
    localArr.set(nameBytes, 30);
    localArr.set(dataBytes, 30 + nameBytes.length);

    offsets.push(offset);
    localParts.push(localArr);
    offset += localArr.length;

    // Central directory header (46 + nameLen)
    const central = new ArrayBuffer(46 + nameBytes.length);
    const cv = new DataView(central);
    cv.setUint32(0, 0x02014b50, true);    // signature
    cv.setUint16(4, 20, true);            // version made by
    cv.setUint16(6, 20, true);            // version needed
    cv.setUint16(8, 0, true);             // flags
    cv.setUint16(10, 0, true);            // compression
    cv.setUint16(12, 0, true);            // mod time
    cv.setUint16(14, 0, true);            // mod date
    cv.setUint32(16, 0, true);            // crc32
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);            // extra field length
    cv.setUint16(32, 0, true);            // comment length
    cv.setUint16(34, 0, true);            // disk number start
    cv.setUint16(36, 0, true);            // internal attrs
    cv.setUint32(38, 0, true);            // external attrs
    cv.setUint32(42, offsets[offsets.length - 1], true); // local header offset
    const centralArr = new Uint8Array(central);
    centralArr.set(nameBytes, 46);
    centralParts.push(centralArr);
  }

  const centralSize = centralParts.reduce((s, c) => s + c.length, 0);

  // End of central directory (22 bytes)
  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const blob = new Blob([...localParts, ...centralParts, new Uint8Array(eocd)], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${zipName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export function CommitDialog({
  suggestedBranchName,
  targetFolder,
  translationName,
  fileCount,
  files,
  onCommit,
  onCancel,
  isCommitting,
}: CommitDialogProps) {
  const [branchName, setBranchName] = useState(suggestedBranchName);

  const targetLabel = targetFolder
    ? targetFolder.split('/').filter(Boolean).slice(-2).join(' / ')
    : 'Full repository';

  const handleDownload = () => {
    const name = branchName.trim() || 'transformation';
    downloadZip(files, name);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <Save className="w-4 h-4 text-orange-600" />
            <h3 className="text-sm font-semibold text-gray-900">Commit Transformation</h3>
          </div>
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Context info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <FolderOpen className="w-3.5 h-3.5 text-orange-500" />
              <span className="font-medium">Source:</span>
              <span className="text-gray-800">{targetLabel}</span>
            </div>
            {translationName && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Languages className="w-3.5 h-3.5 text-purple-500" />
                <span className="font-medium">Recipe:</span>
                <span className="text-gray-800">{translationName}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <GitBranch className="w-3.5 h-3.5 text-green-500" />
              <span className="font-medium">Files:</span>
              <span className="text-gray-800">{fileCount} file(s)</span>
            </div>
          </div>

          {/* Branch name input */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Branch / Transformation Name
            </label>
            <input
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
              placeholder="e.g. service_catalog-claude-build-v1.0"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Output: Genome Transformations/{branchName}/
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 text-xs text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Download ZIP
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onCommit(branchName)}
              disabled={isCommitting || !branchName.trim()}
              className="px-4 py-1.5 text-xs bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-1.5 font-medium"
            >
              {isCommitting ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Committing...</>
              ) : (
                <><Save className="w-3.5 h-3.5" /> Commit to GitHub</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

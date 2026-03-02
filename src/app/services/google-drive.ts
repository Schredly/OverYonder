const DRIVE_API = 'https://www.googleapis.com/drive/v3';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export interface ScaffoldProgress {
  message: string;
  current: number;
  total: number;
}

/**
 * Test that a Drive folder exists and is accessible.
 * Returns the folder name on success.
 */
export async function testDriveFolder(
  accessToken: string,
  folderId: string,
): Promise<string> {
  const url = `${DRIVE_API}/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType&supportsAllDrives=true`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    if (res.status === 404) throw new Error('Folder not found. Check the folder ID.');
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `Drive API error (${res.status})`);
  }

  const file: DriveFile = await res.json();
  if (file.mimeType !== 'application/vnd.google-apps.folder') {
    throw new Error(`"${file.name}" is not a folder (type: ${file.mimeType}).`);
  }
  return file.name;
}

/**
 * Idempotent folder creation: search by name + parent, create if missing.
 */
export async function ensureFolder(
  accessToken: string,
  name: string,
  parentId: string,
): Promise<{ id: string; name: string; created: boolean }> {
  // Search for existing folder
  const q = `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const searchUrl = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchRes.ok) {
    const body = await searchRes.json().catch(() => ({}));
    throw new Error(body.error?.message || `Search failed (${searchRes.status})`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return { id: searchData.files[0].id, name: searchData.files[0].name, created: false };
  }

  // Create folder
  const createRes = await fetch(`${DRIVE_API}/files?supportsAllDrives=true`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });

  if (!createRes.ok) {
    const body = await createRes.json().catch(() => ({}));
    throw new Error(body.error?.message || `Create folder failed (${createRes.status})`);
  }

  const created: DriveFile = await createRes.json();
  return { id: created.id, name: created.name, created: true };
}

/**
 * Creates the full scaffold tree under the root folder:
 *   rootFolder/
 *     AgenticKnowledge/
 *       {tenantId}/
 *         _schema/
 *         dimensions/
 *           {Level1DisplayName}/
 *           {Level2DisplayName}/
 *         documents/
 */
export async function scaffoldDrive(
  accessToken: string,
  rootFolderId: string,
  tenantId: string,
  classificationLevels: { displayName: string }[],
  onProgress?: (progress: ScaffoldProgress) => void,
): Promise<{ schemaFolderId: string }> {
  const levels = classificationLevels.filter((l) => l.displayName);
  // Total folders: AgenticKnowledge + tenantId + _schema + dimensions + each level + documents
  const total = 4 + levels.length;
  let current = 0;

  const report = (message: string) => {
    current++;
    onProgress?.({ message, current, total });
  };

  // AgenticKnowledge
  const ak = await ensureFolder(accessToken, 'AgenticKnowledge', rootFolderId);
  report(`${ak.created ? 'Created' : 'Found'} AgenticKnowledge/`);

  // {tenantId}
  const tenant = await ensureFolder(accessToken, tenantId, ak.id);
  report(`${tenant.created ? 'Created' : 'Found'} ${tenantId}/`);

  // _schema
  const schema = await ensureFolder(accessToken, '_schema', tenant.id);
  report(`${schema.created ? 'Created' : 'Found'} _schema/`);

  // dimensions
  const dims = await ensureFolder(accessToken, 'dimensions', tenant.id);
  report(`${dims.created ? 'Created' : 'Found'} dimensions/`);

  // Each classification level folder
  for (const level of levels) {
    const folder = await ensureFolder(accessToken, level.displayName, dims.id);
    report(`${folder.created ? 'Created' : 'Found'} dimensions/${level.displayName}/`);
  }

  // documents
  const docs = await ensureFolder(accessToken, 'documents', tenant.id);
  report(`${docs.created ? 'Created' : 'Found'} documents/`);

  return { schemaFolderId: schema.id };
}

/**
 * Upload classification_schema.json to the _schema/ folder.
 */
export async function uploadSchemaFile(
  accessToken: string,
  schemaFolderId: string,
  schema: unknown,
): Promise<void> {
  const fileName = 'classification_schema.json';
  const content = JSON.stringify(schema, null, 2);

  // Check if file already exists
  const q = `name='${fileName}' and '${schemaFolderId}' in parents and trashed=false`;
  const searchUrl = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const searchData = await searchRes.json();
  const existingId = searchData.files?.[0]?.id;

  const metadata = existingId
    ? { name: fileName }
    : { name: fileName, mimeType: 'application/json', parents: [schemaFolderId] };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
  );
  form.append(
    'file',
    new Blob([content], { type: 'application/json' }),
  );

  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart&supportsAllDrives=true`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true`;

  const res = await fetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `Upload failed (${res.status})`);
  }
}

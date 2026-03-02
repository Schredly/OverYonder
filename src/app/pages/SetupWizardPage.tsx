import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChevronLeft, ChevronRight, Plus, Trash2, CheckCircle, XCircle, Loader2, LogOut, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { SetupStepper } from '../components/SetupStepper';
import { addTenant, getTenantById, updateTenant, type ClassificationLevel } from '../data/mockData';
import { useGoogleAuth } from '../auth/GoogleAuthContext';
import { testDriveFolder, scaffoldDrive, uploadSchemaFile, type ScaffoldProgress } from '../services/google-drive';

const steps = [
  { id: 1, title: 'Create Tenant' },
  { id: 2, title: 'Configure ServiceNow' },
  { id: 3, title: 'Configure Classification Schema' },
  { id: 4, title: 'Configure Google Drive' },
  { id: 5, title: 'Scaffold Drive' },
  { id: 6, title: 'Activate Tenant' },
];

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

export function SetupWizardPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [currentStep, setCurrentStep] = useState(0);

  // Form state
  const [tenantName, setTenantName] = useState('');
  const [instanceUrl, setInstanceUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [classificationLevels, setClassificationLevels] = useState<ClassificationLevel[]>([
    { levelKey: 'department', displayName: 'Department', required: true },
  ]);
  const [folderId, setFolderId] = useState('');
  const [folderName, setFolderName] = useState('');

  // Google Auth
  const { isAuthenticated, accessToken, userEmail, signIn, signOut: googleSignOut, isInitialized, initError } = useGoogleAuth();

  // Connection test state
  const [snowStatus, setSnowStatus] = useState<ConnectionStatus>('idle');
  const [snowError, setSnowError] = useState('');
  const [driveStatus, setDriveStatus] = useState<ConnectionStatus>('idle');
  const [driveError, setDriveError] = useState('');

  // Scaffold state
  const [scaffoldStatus, setScaffoldStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [scaffoldProgress, setScaffoldProgress] = useState<ScaffoldProgress | null>(null);
  const [scaffoldError, setScaffoldError] = useState('');

  // Load existing tenant for editing
  useEffect(() => {
    if (id) {
      const existing = getTenantById(id);
      if (existing) {
        setTenantName(existing.name);
        if (existing.servicenow) {
          setInstanceUrl(existing.servicenow.instanceUrl);
          setUsername(existing.servicenow.username);
        }
        if (existing.classificationSchema?.length) {
          setClassificationLevels(existing.classificationSchema);
        }
        if (existing.googleDrive) {
          setFolderId(existing.googleDrive.folderId);
        }
      }
    }
  }, [id]);

  const handleTestServiceNow = () => {
    setSnowStatus('testing');
    setSnowError('');
    setTimeout(() => {
      if (instanceUrl && username && password) {
        setSnowStatus('success');
      } else {
        setSnowStatus('error');
        setSnowError('Please fill in all ServiceNow fields.');
      }
    }, 1500);
  };

  const handleSignIn = async () => {
    try {
      await signIn();
      toast.success('Signed in with Google');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sign-in failed');
    }
  };

  const handleSignOut = async () => {
    await googleSignOut();
    setDriveStatus('idle');
    setDriveError('');
    setFolderName('');
    toast.info('Signed out of Google');
  };

  const handleTestGoogleDrive = async () => {
    if (!accessToken) {
      setDriveStatus('error');
      setDriveError('Please sign in with Google first.');
      return;
    }
    if (!folderId.trim()) {
      setDriveStatus('error');
      setDriveError('Please provide a folder ID.');
      return;
    }
    setDriveStatus('testing');
    setDriveError('');
    try {
      const name = await testDriveFolder(accessToken, folderId.trim());
      setFolderName(name);
      setDriveStatus('success');
    } catch (err) {
      setDriveStatus('error');
      setDriveError(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  const handleApplyScaffold = async () => {
    if (!accessToken || !folderId.trim()) return;
    setScaffoldStatus('running');
    setScaffoldProgress(null);
    setScaffoldError('');
    try {
      const tenantIdForScaffold = id || tenantName || 'default';
      const { schemaFolderId } = await scaffoldDrive(
        accessToken,
        folderId.trim(),
        tenantIdForScaffold,
        classificationLevels.filter((l) => l.displayName),
        (progress) => setScaffoldProgress(progress),
      );

      // Upload classification schema
      setScaffoldProgress((prev) => prev ? { ...prev, message: 'Uploading classification_schema.json...' } : prev);
      await uploadSchemaFile(accessToken, schemaFolderId, classificationLevels.filter((l) => l.levelKey));

      setScaffoldStatus('done');
      toast.success('Drive scaffold applied successfully');
    } catch (err) {
      setScaffoldStatus('error');
      setScaffoldError(err instanceof Error ? err.message : 'Scaffold failed');
      toast.error('Scaffold failed');
    }
  };

  const handleActivate = () => {
    const tenantData = {
      name: tenantName || 'Untitled Tenant',
      status: 'Active' as const,
      servicenow: instanceUrl ? { instanceUrl, username } : undefined,
      classificationSchema: classificationLevels.filter((l) => l.levelKey),
      googleDrive: folderId ? { folderId, folderName: folderName || undefined, scaffolded: scaffoldStatus === 'done' } : undefined,
    };

    if (id) {
      updateTenant(id, tenantData);
    } else {
      addTenant(tenantData);
    }

    navigate('/tenants');
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleActivate();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const addLevel = () => {
    setClassificationLevels([
      ...classificationLevels,
      { levelKey: '', displayName: '', required: false },
    ]);
  };

  const removeLevel = (index: number) => {
    setClassificationLevels(classificationLevels.filter((_, i) => i !== index));
  };

  const updateLevel = (index: number, field: keyof ClassificationLevel, value: string | boolean) => {
    const updated = [...classificationLevels];
    updated[index] = { ...updated[index], [field]: value };
    setClassificationLevels(updated);
  };

  const renderConnectionStatus = (status: ConnectionStatus, error: string) => {
    switch (status) {
      case 'testing':
        return (
          <span className="flex items-center gap-2 text-sm text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            Testing connection...
          </span>
        );
      case 'success':
        return (
          <span className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="w-4 h-4" />
            Connection successful
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-2 text-sm text-red-600">
            <XCircle className="w-4 h-4" />
            {error || 'Connection failed'}
          </span>
        );
      default:
        return null;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-2">Tenant Name</label>
              <input
                type="text"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                placeholder="e.g., Acme Corp"
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Enter a unique name for this tenant. This will be used to identify the
              tenant throughout the platform.
            </p>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-2">Instance URL</label>
              <input
                type="text"
                value={instanceUrl}
                onChange={(e) => setInstanceUrl(e.target.value)}
                placeholder="https://instance.service-now.com"
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin@company.com"
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleTestServiceNow}
                disabled={snowStatus === 'testing'}
                className="px-4 py-2 bg-white border border-border rounded-md hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
              >
                Test Connection
              </button>
              {renderConnectionStatus(snowStatus, snowError)}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              Define the hierarchical classification schema for organizing documents.
            </p>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs text-muted-foreground uppercase">
                      Level Key
                    </th>
                    <th className="text-left px-4 py-2 text-xs text-muted-foreground uppercase">
                      Display Name
                    </th>
                    <th className="text-center px-4 py-2 text-xs text-muted-foreground uppercase">
                      Required
                    </th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {classificationLevels.map((level, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={level.levelKey}
                          onChange={(e) =>
                            updateLevel(index, 'levelKey', e.target.value)
                          }
                          placeholder="e.g., department"
                          className="w-full px-2 py-1 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={level.displayName}
                          onChange={(e) =>
                            updateLevel(index, 'displayName', e.target.value)
                          }
                          placeholder="e.g., Department"
                          className="w-full px-2 py-1 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={level.required}
                          onChange={(e) =>
                            updateLevel(index, 'required', e.target.checked)
                          }
                          className="w-4 h-4 accent-blue-600"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => removeLevel(index)}
                          className="p-1 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={addLevel}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-border rounded-md hover:bg-gray-50 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Level
            </button>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            {/* Auth error / not initialized */}
            {initError && (
              <div className="border border-yellow-300 bg-yellow-50 rounded-lg p-4 text-sm text-yellow-800">
                {initError}
              </div>
            )}

            {/* Sign-in section */}
            {!isAuthenticated ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Sign in with your Google account to connect to Google Drive.
                </p>
                <button
                  onClick={handleSignIn}
                  disabled={!isInitialized}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
                >
                  Sign in with Google
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Authenticated user info */}
                <div className="flex items-center justify-between border border-green-200 bg-green-50 rounded-lg p-3">
                  <span className="flex items-center gap-2 text-sm text-green-800">
                    <CheckCircle className="w-4 h-4" />
                    Signed in as <strong>{userEmail}</strong>
                  </span>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <LogOut className="w-3 h-3" />
                    Sign out
                  </button>
                </div>

                {/* Folder ID input */}
                <div>
                  <label className="block text-sm mb-2">Root Folder ID</label>
                  <input
                    type="text"
                    value={folderId}
                    onChange={(e) => { setFolderId(e.target.value); setDriveStatus('idle'); setFolderName(''); }}
                    placeholder="1abc123def456"
                    className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Enter the Google Drive folder ID where documents will be stored. You can
                  find this in the folder URL after <code>/folders/</code>.
                </p>

                {/* Test Connection */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleTestGoogleDrive}
                    disabled={driveStatus === 'testing'}
                    className="px-4 py-2 bg-white border border-border rounded-md hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
                  >
                    Test Connection
                  </button>
                  {driveStatus === 'testing' && (
                    <span className="flex items-center gap-2 text-sm text-blue-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Testing connection...
                    </span>
                  )}
                  {driveStatus === 'success' && (
                    <span className="flex items-center gap-2 text-sm text-green-600">
                      <FolderOpen className="w-4 h-4" />
                      Connected to "{folderName}"
                    </span>
                  )}
                  {driveStatus === 'error' && (
                    <span className="flex items-center gap-2 text-sm text-red-600">
                      <XCircle className="w-4 h-4" />
                      {driveError}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case 4: {
        const canScaffold = isAuthenticated && driveStatus === 'success' && folderId.trim();
        const levels = classificationLevels.filter((l) => l.displayName);
        const tenantIdForPreview = id || tenantName || 'default';
        return (
          <div className="space-y-4">
            {!canScaffold ? (
              <div className="border border-yellow-300 bg-yellow-50 rounded-lg p-4 text-sm text-yellow-800">
                Please complete Step 3 first: sign in with Google and test your folder connection.
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-2">
                  The following folder structure will be created in "{folderName}":
                </p>

                {/* Tree preview */}
                <div className="border border-border rounded-lg p-4 bg-gray-50 font-mono text-xs text-muted-foreground space-y-0.5">
                  <div>{folderName}/</div>
                  <div>&nbsp;&nbsp;AgenticKnowledge/</div>
                  <div>&nbsp;&nbsp;&nbsp;&nbsp;{tenantIdForPreview}/</div>
                  <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;_schema/</div>
                  <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;classification_schema.json</div>
                  <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;dimensions/</div>
                  {levels.map((l, i) => (
                    <div key={i}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{l.displayName}/</div>
                  ))}
                  {levels.length === 0 && (
                    <div className="italic">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(no classification levels defined)</div>
                  )}
                  <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;documents/</div>
                </div>

                {/* Apply button */}
                <button
                  onClick={handleApplyScaffold}
                  disabled={scaffoldStatus === 'running'}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
                >
                  {scaffoldStatus === 'running' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {scaffoldStatus === 'running' ? 'Applying...' : 'Apply Scaffold'}
                </button>

                {/* Progress */}
                {scaffoldStatus === 'running' && scaffoldProgress && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{scaffoldProgress.message}</span>
                      <span>{scaffoldProgress.current}/{scaffoldProgress.total}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${(scaffoldProgress.current / scaffoldProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Success */}
                {scaffoldStatus === 'done' && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    Scaffold applied successfully. Folders are ready in Google Drive.
                  </div>
                )}

                {/* Error */}
                {scaffoldStatus === 'error' && (
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <XCircle className="w-4 h-4" />
                    {scaffoldError}
                  </div>
                )}
              </>
            )}
          </div>
        );
      }

      case 5:
        return (
          <div className="space-y-4">
            <div className="border border-border rounded-lg p-6 bg-green-50">
              <h3 className="text-sm mb-2">Ready to Activate</h3>
              <p className="text-sm text-muted-foreground mb-4">
                All configuration steps are complete. Click "Activate" to enable this
                tenant.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tenant Name:</span>
                  <span>{tenantName || 'Not set'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ServiceNow:</span>
                  <span>{instanceUrl ? 'Configured' : 'Not configured'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Classification:</span>
                  <span>{classificationLevels.length} levels</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Google Drive:</span>
                  <span>{folderId ? (folderName ? `"${folderName}" (verified)` : 'Configured') : 'Not configured'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scaffold:</span>
                  <span>{scaffoldStatus === 'done' ? 'Applied' : 'Not applied'}</span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex h-full bg-white">
      {/* Left Stepper */}
      <div className="w-80 border-r border-border p-6 bg-gray-50">
        <div className="mb-6">
          <button
            onClick={() => navigate('/tenants')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Tenants
          </button>
        </div>
        <h2 className="text-lg mb-6">{id ? 'Edit Tenant' : 'Setup Wizard'}</h2>
        <SetupStepper
          steps={steps}
          currentStep={currentStep}
          onStepClick={setCurrentStep}
        />
      </div>

      {/* Right Content Panel */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 p-8 overflow-auto">
          <h2 className="text-xl mb-2">{steps[currentStep].title}</h2>
          <div className="max-w-2xl">{renderStepContent()}</div>
        </div>

        {/* Bottom Action Bar */}
        <div className="border-t border-border p-6 flex justify-end gap-3">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className="px-4 py-2 border border-border rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
          >
            {currentStep === steps.length - 1 ? 'Activate' : 'Next'}
            {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

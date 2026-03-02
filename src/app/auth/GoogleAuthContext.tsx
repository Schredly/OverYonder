import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { initGoogleAuth, requestAccessToken, getAccessToken, signOut as gisSignOut } from './google-auth';

interface GoogleAuthContextValue {
  isAuthenticated: boolean;
  accessToken: string | null;
  userEmail: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  isInitialized: boolean;
  initError: string | null;
  /** Manually provide a client ID at runtime (when env var is not set) */
  configureClientId: (clientId: string) => Promise<void>;
  needsClientId: boolean;
}

const GoogleAuthContext = createContext<GoogleAuthContextValue | null>(null);

function waitForGis(signal: AbortSignal, timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof google !== 'undefined' && google.accounts?.oauth2) {
      resolve();
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      if (signal.aborted) {
        clearInterval(interval);
        reject(new Error('Aborted'));
        return;
      }
      if (typeof google !== 'undefined' && google.accounts?.oauth2) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error('Google Identity Services script failed to load'));
      }
    }, 100);
  });
}

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [needsClientId, setNeedsClientId] = useState(false);

  const initWithClientId = useCallback(async (clientId: string) => {
    setInitError(null);
    const controller = new AbortController();
    try {
      await waitForGis(controller.signal);
      initGoogleAuth(clientId);
      setIsInitialized(true);
      setNeedsClientId(false);
    } catch (err) {
      if (!controller.signal.aborted) {
        setInitError(err instanceof Error ? err.message : 'Failed to initialize');
      }
    }
  }, []);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setNeedsClientId(true);
      return;
    }

    const controller = new AbortController();
    waitForGis(controller.signal)
      .then(() => {
        if (!controller.signal.aborted) {
          initGoogleAuth(clientId);
          setIsInitialized(true);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setInitError(err.message);
        }
      });
    return () => controller.abort();
  }, []);

  const signIn = useCallback(async () => {
    const accessToken = await requestAccessToken();
    setToken(accessToken);
    setIsAuthenticated(true);

    // Fetch user email
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const info = await res.json();
        setUserEmail(info.email || null);
      }
    } catch {
      // Email fetch is best-effort
    }
  }, []);

  const signOut = useCallback(async () => {
    await gisSignOut();
    setToken(null);
    setIsAuthenticated(false);
    setUserEmail(null);
  }, []);

  // Keep token in sync (e.g., if it expires)
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      const current = getAccessToken();
      if (!current) {
        setToken(null);
        setIsAuthenticated(false);
        setUserEmail(null);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  return (
    <GoogleAuthContext.Provider
      value={{
        isAuthenticated,
        accessToken: token,
        userEmail,
        signIn,
        signOut,
        isInitialized,
        initError,
        configureClientId: initWithClientId,
        needsClientId,
      }}
    >
      {children}
    </GoogleAuthContext.Provider>
  );
}

const FALLBACK: GoogleAuthContextValue = {
  isAuthenticated: false,
  accessToken: null,
  userEmail: null,
  signIn: async () => {},
  signOut: async () => {},
  isInitialized: false,
  initError: 'GoogleAuthProvider not found',
  configureClientId: async () => {},
  needsClientId: true,
};

export function useGoogleAuth(): GoogleAuthContextValue {
  const ctx = useContext(GoogleAuthContext);
  return ctx ?? FALLBACK;
}

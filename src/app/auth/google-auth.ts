/// <reference path="./gis.d.ts" />

const SCOPES = 'https://www.googleapis.com/auth/drive openid email';

let accessToken: string | null = null;
let expiresAt = 0;
let tokenClient: google.accounts.oauth2.TokenClient | null = null;

// Pending promise resolve/reject for the callback-based GIS popup
let pendingResolve: ((token: string) => void) | null = null;
let pendingReject: ((error: Error) => void) | null = null;

export function initGoogleAuth(clientId: string): void {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (response) => {
      if (response.error) {
        pendingReject?.(new Error(response.error_description || response.error));
        pendingResolve = null;
        pendingReject = null;
        return;
      }
      accessToken = response.access_token;
      expiresAt = Date.now() + response.expires_in * 1000;
      pendingResolve?.(response.access_token);
      pendingResolve = null;
      pendingReject = null;
    },
    error_callback: (error) => {
      pendingReject?.(new Error(error.message || 'OAuth popup error'));
      pendingResolve = null;
      pendingReject = null;
    },
  });
}

export function requestAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google Auth not initialized. Call initGoogleAuth() first.'));
      return;
    }
    pendingResolve = resolve;
    pendingReject = reject;
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

export function getAccessToken(): string | null {
  if (!accessToken || Date.now() >= expiresAt) {
    return null;
  }
  return accessToken;
}

export function signOut(): Promise<void> {
  return new Promise((resolve) => {
    if (accessToken) {
      google.accounts.oauth2.revoke(accessToken, () => {
        accessToken = null;
        expiresAt = 0;
        resolve();
      });
    } else {
      accessToken = null;
      expiresAt = 0;
      resolve();
    }
  });
}

export function getAuthErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code?: unknown }).code ?? '');
  }
  return '';
}

export function getReadableAuthError(error: unknown, hostname?: string): string {
  const code = getAuthErrorCode(error);
  const rawMessage = error instanceof Error ? error.message : String(error ?? '');
  const lower = rawMessage.toLowerCase();
  const host = hostname || (typeof window !== 'undefined' ? window.location.hostname : '');

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Google sign-in was cancelled before completion.';
  }

  if (code === 'auth/unauthorized-domain' || lower.includes('unauthorized-domain')) {
    return host
      ? `Sign-in is blocked for "${host}". Add "${host}" in Firebase Console → Authentication → Settings → Authorized domains.`
      : 'This domain is not authorized in Firebase Console → Authentication → Settings → Authorized domains.';
  }

  if (code === 'auth/popup-blocked') {
    return 'Your browser blocked the sign-in popup. Allow popups for this site or open it directly in Safari or Chrome.';
  }

  if (code === 'auth/operation-not-supported-in-this-environment' || code === 'auth/web-storage-unsupported') {
    return 'This in-app browser restricts sign-in storage. Open this URL directly in Safari or Chrome and try again.';
  }

  if (code === 'auth/network-request-failed') {
    return 'Network error while connecting to Google sign-in. Check your connection and try again.';
  }

  if (code === 'auth/invalid-action-code' || lower.includes('requested action is invalid')) {
    return host
      ? `The sign-in request was rejected for "${host}". Ensure "${host}" is added to Firebase Console → Authentication → Settings → Authorized domains and open the link directly in Safari or Chrome.`
      : 'The sign-in request is invalid. Ensure this deployment domain is authorized in Firebase Console → Authentication → Settings → Authorized domains.';
  }

  return rawMessage || 'Unable to sign in with Google right now.';
}

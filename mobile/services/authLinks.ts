export const AUTH_CALLBACK_URL = 'taskai://auth/callback';
export const RECOVERY_CALLBACK_URL = `${AUTH_CALLBACK_URL}?flow=recovery`;

export interface AuthCallback {
  code?: string;
  accessToken?: string;
  refreshToken?: string;
  type?: string;
  error?: string;
}

export function parseAuthCallback(url: string): AuthCallback {
  const [withoutFragment, fragment = ''] = url.split('#', 2);
  const query = withoutFragment.includes('?') ? withoutFragment.split('?', 2)[1] : '';
  const params = new URLSearchParams(query);
  const fragmentParams = new URLSearchParams(fragment);
  fragmentParams.forEach((value, key) => params.set(key, value));

  return {
    code: params.get('code') || undefined,
    accessToken: params.get('access_token') || undefined,
    refreshToken: params.get('refresh_token') || undefined,
    type: params.get('type') || params.get('flow') || undefined,
    error: params.get('error_description') || params.get('error') || undefined,
  };
}

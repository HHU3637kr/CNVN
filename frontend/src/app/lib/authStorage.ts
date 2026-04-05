/** 与 getAccessToken() 键名一致 — plan.md §1.2 */

const KEY_ACCESS = "cnvn_access_token";
const KEY_REFRESH = "cnvn_refresh_token";

export function setAuthTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(KEY_ACCESS, accessToken);
  localStorage.setItem(KEY_REFRESH, refreshToken);
}

export function clearAuthTokens(): void {
  localStorage.removeItem(KEY_ACCESS);
  localStorage.removeItem(KEY_REFRESH);
  localStorage.removeItem("access_token");
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(KEY_REFRESH);
}

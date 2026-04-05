/**
 * HTTP 封装 — 见 spec/03-功能实现/20260404-1400-前端对接真实API/plan.md §3.2
 */
import { API_BASE_URL, getAccessToken } from "./api";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function detailToString(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((x) => (typeof x === "object" && x && "msg" in x ? String((x as { msg: string }).msg) : JSON.stringify(x)))
      .join("；");
  }
  if (detail && typeof detail === "object" && "detail" in detail) {
    return detailToString((detail as { detail: unknown }).detail);
  }
  return "请求失败";
}

export async function parseErrorResponse(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return detailToString(j.detail ?? j);
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}

export type FetchOptions = RequestInit & {
  /** 默认 true：除白名单外自动带 Bearer */
  auth?: boolean;
};

function pathnameNeedsOptionalBearer(pathname: string): boolean {
  const p = pathname.replace(/^\/api\/v1/, "") || "/";
  // 注册/登录/刷新：勿带旧 Bearer（由调用方 auth:false 或此处识别）
  return !/^\/auth\/(register|login|refresh)$/.test(p);
}

function needsAuth(pathname: string, auth?: boolean): boolean {
  if (auth === false) return false;
  if (auth === true) return true;
  return pathnameNeedsOptionalBearer(pathname);
}

/**
 * @param path 须以 `/api/v1` 开头，或传相对路径如 `/teachers`（自动加前缀）
 */
export async function apiFetchJson<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { auth, headers: h, ...rest } = options;
  let url = path.startsWith("http")
    ? path
    : path.startsWith("/api/v1")
      ? `${API_BASE_URL}${path}`
      : `${API_BASE_URL}/api/v1${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers(h);
  if (!headers.has("Content-Type") && rest.body && !(rest.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const pathForAuth = new URL(url).pathname;
  if (needsAuth(pathForAuth, auth)) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, { ...rest, headers });
  if (!res.ok) {
    const msg = await parseErrorResponse(res);
    throw new ApiError(msg, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

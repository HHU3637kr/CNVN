/** 后端 API 基址；登录后请将 access_token 写入 localStorage（键名见 getAccessToken） */
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:8001";

export function getAccessToken(): string | null {
  return (
    localStorage.getItem("cnvn_access_token") ??
    localStorage.getItem("access_token")
  );
}

export function wsUrlForLesson(lessonId: string, accessToken: string): string {
  const base = API_BASE_URL.replace(/^http/, "ws");
  const q = new URLSearchParams({ access_token: accessToken });
  return `${base}/api/v1/lessons/${lessonId}/ws?${q.toString()}`;
}

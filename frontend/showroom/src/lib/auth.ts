const AUTH_TOKEN_KEY = "showroom-auth-token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getAuthToken());
}

export async function logout(): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    clearAuthToken();
  }
}

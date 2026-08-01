export type AdminSession = {
  token: string;
  email: string;
  displayName: string;
  role: "job_seeker" | "employer";
};

export const ADMIN_SESSION_STORAGE_KEY = "mastaskillz_admin_session";
export const ADMIN_TOKEN_STORAGE_KEY = "mastaskillz_admin_token";

export function getStoredAdminSession(): AdminSession | null {
  const sessionValue = window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
  if (sessionValue) {
    try {
      const session = JSON.parse(sessionValue) as Partial<AdminSession>;
      if (session.token && session.displayName && session.email && session.role) {
        return session as AdminSession;
      }
    } catch {
      window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    }
  }

  const legacyToken = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  if (!legacyToken) return null;

  return {
    token: legacyToken,
    email: "admin@mastaskillz.com",
    displayName: "Admin",
    role: "job_seeker",
  };
}

export function storeAdminSession(session: AdminSession) {
  window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session));
  window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, session.token);
}

export function clearAdminSession() {
  window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
}

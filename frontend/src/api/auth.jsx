import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken, logout as clearSession } from "./client.js";
import { currentSubscription, syncPush } from "../push.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const me = await api("/me");
        setUser(me);
        localStorage.setItem("cyklia_user", JSON.stringify(me));
        syncPush();
      } catch {
        clearSession();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(email, password) {
    const { token, user } = await api("/login", {
      method: "POST",
      body: { email, password },
    });
    setToken(token);
    localStorage.setItem("cyklia_user", JSON.stringify(user));
    setUser(user);
  }

  async function register(payload) {
    const { token, user } = await api("/register", {
      method: "POST",
      body: payload,
    });
    setToken(token);
    localStorage.setItem("cyklia_user", JSON.stringify(user));
    setUser(user);
  }

  async function logout() {
    // to urządzenie przestaje dostawać powiadomienia tego konta
    try {
      const sub = await currentSubscription();
      if (sub) {
        await api("/push/unsubscribe", { method: "POST", body: { endpoint: sub.endpoint } });
      }
    } catch {
      /* ignore */
    }
    clearSession();
    setUser(null);
  }

  // wygasła sesja (401) w trakcie korzystania → powrót do logowania
  useEffect(() => {
    const onExpired = () => {
      clearSession();
      setUser(null);
    };
    window.addEventListener("cyklia:unauthorized", onExpired);
    return () => window.removeEventListener("cyklia:unauthorized", onExpired);
  }, []);

  function updateUser(patch) {
    setUser((u) => {
      const next = { ...u, ...patch };
      localStorage.setItem("cyklia_user", JSON.stringify(next));
      return next;
    });
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken, logout as clearSession } from "./client.js";

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

  function logout() {
    clearSession();
    setUser(null);
  }

  function updateUser(patch) {
    setUser((u) => ({ ...u, ...patch }));
    localStorage.setItem("cyklia_user", JSON.stringify({ ...user, ...patch }));
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

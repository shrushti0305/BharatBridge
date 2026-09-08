import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api.js";

const AuthContext = createContext(null);

function readStored(key) {
  return localStorage.getItem(key) || sessionStorage.getItem(key);
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readStored("lt_token") || null);
  const [user, setUser] = useState(() => {
    const raw = readStored("lt_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token) {
      setReady(true);
      return;
    }
    api
      .me(token)
      .then(({ user }) => setUser(user))
      .catch(() => {
        setToken(null);
        setUser(null);
        localStorage.removeItem("lt_token");
        localStorage.removeItem("lt_user");
        sessionStorage.removeItem("lt_token");
        sessionStorage.removeItem("lt_user");
      })
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function login(newToken, newUser, remember = true) {
    setToken(newToken);
    setUser(newUser);
    const store = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    store.setItem("lt_token", newToken);
    store.setItem("lt_user", JSON.stringify(newUser));
    other.removeItem("lt_token");
    other.removeItem("lt_user");
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem("lt_token");
    localStorage.removeItem("lt_user");
    sessionStorage.removeItem("lt_token");
    sessionStorage.removeItem("lt_user");
  }

  return (
    <AuthContext.Provider value={{ token, user, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
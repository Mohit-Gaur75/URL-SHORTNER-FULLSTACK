import { createContext, useContext, useEffect, useState } from "react";
import { setAccessToken, setSessionEndedHandler } from "../api/http";
import { loginUser, logoutUser, registerUser, restoreSession } from "../api/auth";

const AuthContext = createContext(null);

// Earlier versions kept the login token under this key in localStorage.
const LEGACY_TOKEN_KEY = "token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while we check for an existing session

  useEffect(() => {
    localStorage.removeItem(LEGACY_TOKEN_KEY);

    // If the API client discovers the session is over, show the logged-out UI.
    setSessionEndedHandler(() => setUser(null));

    restoreSession()
      .then(({ user }) => setUser(user))
      .catch(() => {}) // no cookie, or it expired: simply logged out
      .finally(() => setLoading(false));
  }, []);

  const handleAuthSuccess = ({ accessToken, user }) => {
    setAccessToken(accessToken);
    setUser(user);
  };

  const login = async (credentials) =>
    handleAuthSuccess(await loginUser(credentials));

  const register = async (details) =>
    handleAuthSuccess(await registerUser(details));

  const logout = async () => {
    // Update the screen first, then tell the server.
    setAccessToken(null);
    setUser(null);
    try {
      await logoutUser();
    } catch {
      // Even if the server can't be reached, this browser is logged out.
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

import { createContext, useContext, useEffect, useState } from "react";
import { TOKEN_KEY } from "../api/http";
import { fetchMe, loginUser, registerUser } from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while we check a stored token

  // On first load: if a token exists, ask the server who it belongs to
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setLoading(false);
      return;
    }
    fetchMe()
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY)) // expired or invalid
      .finally(() => setLoading(false));
  }, []);

  const handleAuthSuccess = ({ token, user }) => {
    localStorage.setItem(TOKEN_KEY, token);
    setUser(user);
  };

  const login = async (credentials) =>
    handleAuthSuccess(await loginUser(credentials));

  const register = async (details) =>
    handleAuthSuccess(await registerUser(details));

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

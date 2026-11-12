import { Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import LinksPage from "./pages/LinksPage";
import CreateLinkPage from "./pages/CreateLinkPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SystemStatusPage from "./pages/SystemStatusPage";
import SettingsPage from "./pages/SettingsPage";
import AdminPage from "./pages/AdminPage";
import RedirectBridge from "./pages/RedirectBridge";
import NotFound from "./pages/NotFound";

const CURRENT_YEAR = new Date().getFullYear();

export default function App() {
  return (
    <div className="app-layout">
      <Navbar />
      <main className="main-content">
        <Routes>
          {/* Public Authentication & Landing */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Authenticated SaaS Modules */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/links"
            element={
              <ProtectedRoute>
                <LinksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create"
            element={
              <ProtectedRoute>
                <CreateLinkPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/system-status"
            element={
              <ProtectedRoute>
                <SystemStatusPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
          />

          {/* Short Link Redirect Bridge */}
          <Route path="/:code" element={<RedirectBridge />} />

          {/* Unmatched / 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="app-footer">
        <p>
          &copy; {CURRENT_YEAR} ShortLink Platform &bull; Built with
          High-Throughput Redis Caching &amp; Asynchronous Click Analytics
        </p>
      </footer>
    </div>
  );
}

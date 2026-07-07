import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Auth from "./components/Auth";
import AppLayout from "./components/AppLayout";
import DashboardPlaceholder from "./pages/DashboardPlaceholder";
import WizardPlaceholder from "./pages/WizardPlaceholder";
import HackathonsPlaceholder from "./pages/HackathonsPlaceholder";
import { Loader2 } from "lucide-react";

function ProtectedRoute({
  children,
  allowedRole,
}: {
  children: React.ReactNode;
  allowedRole?: "participant" | "organizer";
}) {
  const auth = useAuth();

  if (auth.status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (auth.status === "unauthenticated") {
    return <Navigate to="/" replace />;
  }

  // Unknown role: send back to auth
  if (auth.role === "unknown") {
    return <Navigate to="/" replace />;
  }

  if (allowedRole && auth.role !== allowedRole) {
    if (auth.role === "organizer") return <Navigate to="/dashboard" replace />;
    if (auth.role === "participant") return <Navigate to="/wizard" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const auth = useAuth();

  return (
    <Routes>
      {/* Public route — sign-in */}
      <Route
        path="/"
        element={
          auth.status === "authenticated" ? (
            auth.role === "organizer" ? (
              <Navigate to="/dashboard" replace />
            ) : auth.role === "participant" ? (
              <Navigate to="/wizard" replace />
            ) : (
              <Auth />
            )
          ) : auth.status === "unauthenticated" ? (
            <Auth />
          ) : (
            <div className="min-h-screen bg-background flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-accent animate-spin" aria-hidden="true" />
            </div>
          )
        }
      />

      {/* Authenticated routes wrapped in AppLayout */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Organizer routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRole="organizer">
              <DashboardPlaceholder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hackathons"
          element={
            <ProtectedRoute allowedRole="organizer">
              <HackathonsPlaceholder />
            </ProtectedRoute>
          }
        />

        {/* Participant routes */}
        <Route
          path="/wizard"
          element={
            <ProtectedRoute allowedRole="participant">
              <WizardPlaceholder />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
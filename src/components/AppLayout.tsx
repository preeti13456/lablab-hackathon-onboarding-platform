import { useState, useEffect, useCallback, useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import {
  LayoutDashboard,
  Trophy,
  Wand2,
  LogOut,
  ChevronLeft,
  Menu,
  Loader2,
} from "lucide-react";

/* ─── Navigation items per role ─── */
const PARTICIPANT_NAV = [
  { to: "/wizard", label: "Onboarding", icon: Wand2 },
];

const ORGANIZER_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/hackathons", label: "Hackathons", icon: Trophy },
];

/* ─── Helper: use localStorage with SSR safety ─── */
function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v: T) => {
      setVal(v);
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* quota exceeded — silently ignore */
      }
    },
    [key]
  );
  return [val, set];
}

export default function AppLayout() {
  const auth = useAuth();
  const location = useLocation();

  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage(
    "sidebar-collapsed",
    false
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  /* Close mobile drawer on navigation */
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  /* Focus trap + Escape key for mobile drawer */
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        hamburgerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mobileOpen]);

  /* Prevent body scroll when mobile drawer is open */
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const navItems =
    auth.status === "authenticated" && auth.role === "organizer"
      ? ORGANIZER_NAV
      : PARTICIPANT_NAV;

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (auth.status === "loading") {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        role="status"
        aria-label="Loading application"
      >
        <Loader2 className="w-6 h-6 text-accent animate-spin" aria-hidden="true" />
      </div>
    );
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
          <span className="text-accent font-heading text-xs">LL</span>
        </div>
        {!sidebarCollapsed && (
          <span className="font-heading text-sm tracking-wider text-foreground/80 uppercase truncate">
            LabLab
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === "/dashboard"}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
                    isActive
                      ? "bg-accent/10 text-accent border border-accent/20"
                      : "text-foreground/60 hover:text-foreground hover:bg-muted border border-transparent"
                  }`
                }
              >
                <item.icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Sign Out */}
      <div className="p-3 border-t border-border shrink-0">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-foreground/60 hover:text-foreground hover:bg-muted transition-all duration-150 cursor-pointer border border-transparent"
          aria-label="Sign out"
        >
          <LogOut className="w-5 h-5 shrink-0" aria-hidden="true" />
          {!sidebarCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* ─── Desktop sidebar ─── */}
      <aside
        aria-label="Sidebar navigation"
        className={`hidden md:flex flex-col border-r border-border bg-background transition-all duration-200 ease-out relative ${
          sidebarCollapsed ? "w-16" : "w-64"
        }`}
      >
        {sidebarContent}

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center text-foreground/60 hover:text-foreground transition-all duration-150 cursor-pointer"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              sidebarCollapsed ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>
      </aside>

      {/* ─── Mobile drawer overlay ─── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => {
            setMobileOpen(false);
            hamburgerRef.current?.focus();
          }}
          aria-hidden="true"
        />
      )}

      {/* ─── Mobile drawer ─── */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-background border-r border-border shadow-xl transition-transform duration-250 ease-out md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </div>

      {/* ─── Main content ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between h-16 px-4 border-b border-border bg-background shrink-0">
          <button
            ref={hamburgerRef}
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl text-foreground/60 hover:text-foreground hover:bg-muted transition-all duration-150 cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
              <span className="text-accent font-heading text-[10px]">LL</span>
            </div>
            <span className="font-heading text-xs tracking-wider text-foreground/60 uppercase">
              LabLab
            </span>
          </div>

          <button
            onClick={handleSignOut}
            className="p-2 rounded-xl text-foreground/60 hover:text-foreground hover:bg-muted transition-all duration-150 cursor-pointer"
            aria-label="Sign out"
          >
            <LogOut className="w-5 h-5" aria-hidden="true" />
          </button>
        </header>

        {/* Page content */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
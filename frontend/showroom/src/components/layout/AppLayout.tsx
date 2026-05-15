import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Package,
  Tag,
  ShoppingCart,
  Users,
  UserCircle,
  Receipt,
  LogOut,
  ChevronUp,
  Menu,
  X,
} from "lucide-react";
import { getAuthToken, logout } from "@/lib/auth";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Products", href: "/products", icon: Package },
  { name: "Categories", href: "/categories", icon: Tag },
  { name: "Orders", href: "/orders", icon: ShoppingCart },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Billing", href: "/billing", icon: Receipt },
  { name: "Staff", href: "/staff", icon: UserCircle },
];

function useCurrentUser() {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.user) setUser(data.user); })
      .catch(() => {});
  }, []);

  return user;
}

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const [location, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const user = useCurrentUser();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      setLocation("/signin");
    } catch {
      // ignore
    } finally {
      setIsLoggingOut(false);
    }
  };

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Logo */}
      <div className="flex items-center h-16 flex-shrink-0 px-4 bg-sidebar-primary/5">
        <span className="text-xl font-bold text-sidebar-foreground tracking-tight">
          VoltEdge<span className="text-primary">.</span>
        </span>
      </div>

      {/* Nav */}
      <div className="flex-1 flex flex-col overflow-y-auto pt-5 pb-4">
        <nav className="mt-5 flex-1 px-2 space-y-1">
          {navigation.map((item) => {
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onNavClick}
                className={`
                  group flex items-center px-2 py-2 text-sm font-medium rounded-md
                  ${isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"}
                `}
              >
                <item.icon
                  className={`
                    mr-3 flex-shrink-0 h-5 w-5
                    ${isActive
                      ? "text-primary"
                      : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70"}
                  `}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Profile section at bottom */}
      <div className="border-t border-sidebar-border px-2 py-3" ref={menuRef}>
        {menuOpen && (
          <div className="mb-2 mx-1 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm font-semibold text-popover-foreground truncate">
                {user?.name ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user?.email ?? ""}</p>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              {isLoggingOut ? "Logging out…" : "Logout"}
            </button>
          </div>
        )}

        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-sidebar-accent/50 transition-colors text-left"
        >
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.name ?? "Loading…"}
            </p>
            <p className="text-xs text-sidebar-foreground/50 truncate">
              {user?.email ?? ""}
            </p>
          </div>
          <ChevronUp
            className={`h-4 w-4 text-sidebar-foreground/50 flex-shrink-0 transition-transform ${menuOpen ? "" : "rotate-180"}`}
          />
        </button>
      </div>
    </div>
  );
}

export function Sidebar({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  return (
    <>
      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          {/* Slide-in panel */}
          <div className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-sidebar border-r border-sidebar-border">
            <button
              onClick={onMobileClose}
              className="absolute top-4 right-3 p-1 rounded-md text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavClick={onMobileClose} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-sidebar border-r border-sidebar-border print:hidden">
        <SidebarContent />
      </div>
    </>
  );
}

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <div className="flex items-center h-16 px-4 sm:px-6 md:px-8 bg-background border-b border-border print:hidden">
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 rounded-md text-foreground/70 hover:text-foreground hover:bg-accent/50 transition-colors"
        aria-label="Open sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="flex flex-col w-0 flex-1 md:pl-64">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
          <div className="py-6 px-4 sm:px-6 md:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

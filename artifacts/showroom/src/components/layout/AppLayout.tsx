import React from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  UserCircle,
  Receipt
} from "lucide-react";

export function Sidebar() {
  const [location] = useLocation();

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Products", href: "/products", icon: Package },
    { name: "Orders", href: "/orders", icon: ShoppingCart },
    { name: "Customers", href: "/customers", icon: Users },
    { name: "Billing", href: "/billing", icon: Receipt },
    { name: "Staff", href: "/staff", icon: UserCircle },
  ];

  return (
    <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-sidebar border-r border-sidebar-border">
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center h-16 flex-shrink-0 px-4 bg-sidebar-primary/5">
          <span className="text-xl font-bold text-sidebar-foreground tracking-tight">VoltEdge<span className="text-primary">.</span></span>
        </div>
        <div className="flex-1 flex flex-col overflow-y-auto pt-5 pb-4">
          <nav className="mt-5 flex-1 px-2 space-y-1">
            {navigation.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    group flex items-center px-2 py-2 text-sm font-medium rounded-md
                    ${isActive 
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground' 
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}
                  `}
                >
                  <item.icon
                    className={`
                      mr-3 flex-shrink-0 h-5 w-5
                      ${isActive ? 'text-primary' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70'}
                    `}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col w-0 flex-1 md:pl-64">
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
          <div className="py-6 px-4 sm:px-6 md:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

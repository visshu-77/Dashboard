import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Categories from "./pages/Categories";
import Orders from "./pages/Orders";
import Customers from "./pages/Customers";
import Staff from "./pages/Staff";
import Billing from "./pages/Billing";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import { getAuthToken, clearAuthToken } from "./lib/auth";

const queryClient = new QueryClient();

function Router() {
  const [location, setLocation] = useLocation();
  const [authState, setAuthState] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setAuthState("unauthenticated");
      if (location !== "/signin" && location !== "/signup") {
        setLocation("/signin");
      }
      return;
    }

    const abortController = new AbortController();

    fetch("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: abortController.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unauthorized");
        }
        return response.json();
      })
      .then(() => {
        setAuthState("authenticated");
        if (location === "/signin" || location === "/signup") {
          setLocation("/");
        }
      })
      .catch(() => {
        clearAuthToken();
        setAuthState("unauthenticated");
        if (location !== "/signin" && location !== "/signup") {
          setLocation("/signin");
        }
      });

    return () => abortController.abort();
  }, [location, setLocation]);

  if (authState === "loading") {
    return null;
  }

  if (authState === "unauthenticated") {
    // A token exists but hasn't been verified yet (e.g. right after login).
    // Return null to avoid briefly rendering NotFound before the effect updates auth state.
    if (getAuthToken()) return null;

    return (
      <Switch>
        <Route path="/signin" component={SignIn} />
        <Route path="/signup" component={SignUp} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/products" component={Products} />
        <Route path="/categories" component={Categories} />
        <Route path="/orders" component={Orders} />
        <Route path="/customers" component={Customers} />
        <Route path="/staff" component={Staff} />
        <Route path="/billing" component={Billing} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

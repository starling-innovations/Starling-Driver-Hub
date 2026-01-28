import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import OnboardingPage from "@/pages/onboarding";
import ProfilePage from "@/pages/profile";
import VehiclePage from "@/pages/vehicle";
import AgreementPage from "@/pages/agreement";
import AdminPage from "@/pages/admin";
import AvailabilityRespondPage from "@/pages/availability-respond";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <Skeleton className="h-10 w-10 rounded-md mx-auto" />
        <Skeleton className="h-6 w-32 mx-auto" />
        <Skeleton className="h-2 w-full" />
      </div>
    </div>
  );
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Switch>
      <Route path="/">
        {user ? <Dashboard /> : <LandingPage />}
      </Route>
      <Route path="/onboarding">
        {user ? <OnboardingPage /> : <LandingPage />}
      </Route>
      <Route path="/profile">
        {user ? <ProfilePage /> : <LandingPage />}
      </Route>
      <Route path="/vehicle">
        {user ? <VehiclePage /> : <LandingPage />}
      </Route>
      <Route path="/agreement">
        {user ? <AgreementPage /> : <LandingPage />}
      </Route>
      <Route path="/admin">
        {user ? <AdminPage /> : <LandingPage />}
      </Route>
      <Route path="/respond/:token">
        <AvailabilityRespondPage />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

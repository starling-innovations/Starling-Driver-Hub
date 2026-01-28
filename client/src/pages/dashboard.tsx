import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  User, 
  FileText, 
  Truck, 
  ChevronRight, 
  LogOut, 
  CheckCircle2, 
  Clock,
  AlertCircle,
  Calendar,
  Shield
} from "lucide-react";
import type { DriverProfile } from "@shared/schema";

export default function Dashboard() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: profile, isLoading: profileLoading } = useQuery<DriverProfile | null>({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  const isLoading = authLoading || profileLoading;

  const getOnboardingProgress = () => {
    if (!profile) return 0;
    if (profile.onboardingCompleted) return 100;
    return ((profile.onboardingStep || 1) - 1) * 25;
  };

  const getInitials = () => {
    if (profile?.firstName && profile?.lastName) {
      return `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase();
    }
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return "DP";
  };

  const getDisplayName = () => {
    if (profile?.firstName) return profile.firstName;
    if (user?.firstName) return user.firstName;
    return "Driver";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10" data-testid="avatar-user">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm" data-testid="text-welcome">
                Welcome back, {getDisplayName()}
              </p>
              <p className="text-xs text-muted-foreground">Driver Partner</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => logout()}
            data-testid="button-logout"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 space-y-4">
        {!profile?.onboardingCompleted && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Complete Onboarding</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {getOnboardingProgress()}%
                </span>
              </div>
              <Progress value={getOnboardingProgress()} className="h-2 mb-3" />
              <Button 
                className="w-full" 
                onClick={() => setLocation("/onboarding")}
                data-testid="button-continue-onboarding"
              >
                Continue Setup
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}

        {profile?.onboardingCompleted && profile?.approvalStatus !== "approved" && (
          <Card className="border-yellow-500/20 bg-yellow-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-sm">Pending Approval</p>
                <p className="text-xs text-muted-foreground">Your application is being reviewed by our team.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {profile?.approvalStatus === "approved" && profile?.identityVerificationStatus !== "verified" && (
          <Card 
            className="border-blue-500/20 bg-blue-500/5 hover-elevate cursor-pointer" 
            onClick={() => setLocation("/verification")}
            data-testid="card-verification"
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-sm">Complete Identity Verification</p>
                  <p className="text-xs text-muted-foreground">
                    {profile?.identityVerificationStatus === "requires_input" 
                      ? "Continue your verification to get started"
                      : profile?.identityVerificationStatus === "failed"
                      ? "Verification failed - please try again"
                      : "Verify your identity to start accepting deliveries"}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {profile?.identityVerificationStatus === "verified" && (
          <Card className="border-green-500/20 bg-green-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-sm">Ready to Drive</p>
                <p className="text-xs text-muted-foreground">Your identity is verified. You're all set!</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3">
          <Card 
            className="hover-elevate cursor-pointer" 
            onClick={() => setLocation("/profile")}
            data-testid="card-profile"
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">My Profile</p>
                  <p className="text-xs text-muted-foreground">Personal info & e-transfer email</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card 
            className="hover-elevate cursor-pointer" 
            onClick={() => setLocation("/vehicle")}
            data-testid="card-vehicle"
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Vehicle Info</p>
                  <p className="text-xs text-muted-foreground">
                    {profile?.vehicleMake && profile?.vehicleModel 
                      ? `${profile.vehicleMake} ${profile.vehicleModel}` 
                      : "Add your vehicle details"}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card 
            className="hover-elevate cursor-pointer" 
            onClick={() => setLocation("/agreement")}
            data-testid="card-agreement"
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Partner Agreement</p>
                  <p className="text-xs text-muted-foreground">
                    {profile?.agreementSigned 
                      ? "Agreement signed" 
                      : "Review and sign agreement"}
                  </p>
                </div>
              </div>
              {profile?.agreementSigned ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
            </CardContent>
          </Card>

          {profile?.onboardingCompleted && (
            <Card 
              className="hover-elevate cursor-pointer" 
              onClick={() => setLocation("/availability")}
              data-testid="card-availability"
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">My Availability</p>
                    <p className="text-xs text-muted-foreground">
                      Manage your route availability
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          )}
        </div>

        {!profile && (
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="font-medium text-sm">Complete Your Profile</p>
                  <p className="text-xs text-muted-foreground">
                    To start driving with Starling, please complete the onboarding process.
                  </p>
                  <Button 
                    size="sm" 
                    onClick={() => setLocation("/onboarding")}
                    data-testid="button-start-onboarding"
                  >
                    Start Onboarding
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

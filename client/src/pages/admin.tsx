import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle, XCircle, Clock, Users, UserCheck, AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UserWithProfile {
  user: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    lastLoginAt: string | null;
    createdAt: string | null;
  };
  profile: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    onboardingCompleted: boolean;
    onboardingStep: number;
    agreementSigned: boolean;
    onfleetId: string | null;
    approvalStatus: string | null;
    createdAt: string | null;
  } | null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

function getOnboardingStatus(profile: UserWithProfile["profile"]): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: typeof CheckCircle;
} {
  if (!profile) {
    return { label: "No Profile", variant: "outline", icon: AlertCircle };
  }
  if (profile.onboardingCompleted) {
    return { label: "Completed", variant: "default", icon: CheckCircle };
  }
  return {
    label: `Step ${profile.onboardingStep}/4`,
    variant: "secondary",
    icon: Clock,
  };
}

export default function AdminPage() {
  const { toast } = useToast();
  const { data: usersWithProfiles, isLoading } = useQuery<UserWithProfile[]>({
    queryKey: ["/api/admin/users"],
  });

  const approveMutation = useMutation({
    mutationFn: async (profileId: string) => {
      await apiRequest("POST", `/api/admin/approve/${profileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Driver Approved",
        description: "The driver has been approved and synced to Onfleet.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve driver.",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (profileId: string) => {
      await apiRequest("POST", `/api/admin/reject/${profileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Driver Rejected",
        description: "The driver application has been rejected.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject driver.",
        variant: "destructive",
      });
    },
  });

  const totalUsers = usersWithProfiles?.length || 0;
  const completedOnboarding = usersWithProfiles?.filter(
    (u) => u.profile?.onboardingCompleted
  ).length || 0;
  const pendingApproval = usersWithProfiles?.filter(
    (u) => u.profile?.onboardingCompleted && u.profile?.approvalStatus === "pending"
  ).length || 0;
  const inProgress = usersWithProfiles?.filter(
    (u) => u.profile && !u.profile.onboardingCompleted
  ).length || 0;
  const noProfile = usersWithProfiles?.filter((u) => !u.profile).length || 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-semibold">Admin Dashboard</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-total-users">{totalUsers}</p>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-completed-users">{completedOnboarding}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                  <ShieldCheck className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-pending-approval">{pendingApproval}</p>
                  <p className="text-sm text-muted-foreground">Pending Approval</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-inprogress-users">{inProgress}</p>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-noprofile-users">{noProfile}</p>
                  <p className="text-sm text-muted-foreground">No Profile</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="table-users">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">User</th>
                    <th className="pb-3 font-medium text-muted-foreground">Email</th>
                    <th className="pb-3 font-medium text-muted-foreground">Phone</th>
                    <th className="pb-3 font-medium text-muted-foreground">Last Login</th>
                    <th className="pb-3 font-medium text-muted-foreground">Onboarding</th>
                    <th className="pb-3 font-medium text-muted-foreground">Approval</th>
                    <th className="pb-3 font-medium text-muted-foreground">Onfleet</th>
                    <th className="pb-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersWithProfiles?.map((item) => {
                    const status = getOnboardingStatus(item.profile);
                    const StatusIcon = status.icon;
                    const name = item.profile
                      ? `${item.profile.firstName} ${item.profile.lastName}`
                      : item.user.firstName && item.user.lastName
                      ? `${item.user.firstName} ${item.user.lastName}`
                      : "Unknown";

                    return (
                      <tr
                        key={item.user.id}
                        className="border-b last:border-0"
                        data-testid={`row-user-${item.user.id}`}
                      >
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            {item.user.profileImageUrl ? (
                              <img
                                src={item.user.profileImageUrl}
                                alt=""
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-sm font-medium text-primary">
                                  {name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <span className="font-medium" data-testid={`text-name-${item.user.id}`}>
                              {name}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 text-sm text-muted-foreground" data-testid={`text-email-${item.user.id}`}>
                          {item.profile?.email || item.user.email || "-"}
                        </td>
                        <td className="py-4 text-sm text-muted-foreground" data-testid={`text-phone-${item.user.id}`}>
                          {item.profile?.phone || "-"}
                        </td>
                        <td className="py-4 text-sm" data-testid={`text-lastlogin-${item.user.id}`}>
                          <span title={formatDate(item.user.lastLoginAt)}>
                            {formatRelativeTime(item.user.lastLoginAt)}
                          </span>
                        </td>
                        <td className="py-4">
                          <Badge variant={status.variant} data-testid={`badge-status-${item.user.id}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {status.label}
                          </Badge>
                        </td>
                        <td className="py-4">
                          {!item.profile ? (
                            <Badge variant="outline" className="text-muted-foreground">-</Badge>
                          ) : item.profile.approvalStatus === "approved" ? (
                            <Badge variant="default" className="gap-1" data-testid={`badge-approval-${item.user.id}`}>
                              <CheckCircle className="h-3 w-3" />
                              Approved
                            </Badge>
                          ) : item.profile.approvalStatus === "rejected" ? (
                            <Badge variant="destructive" className="gap-1" data-testid={`badge-approval-${item.user.id}`}>
                              <XCircle className="h-3 w-3" />
                              Rejected
                            </Badge>
                          ) : item.profile.onboardingCompleted ? (
                            <Badge variant="secondary" className="gap-1" data-testid={`badge-approval-${item.user.id}`}>
                              <Clock className="h-3 w-3" />
                              Pending
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">-</Badge>
                          )}
                        </td>
                        <td className="py-4">
                          {item.profile?.onfleetId ? (
                            <Badge variant="outline" className="gap-1" data-testid={`badge-onfleet-${item.user.id}`}>
                              <CheckCircle className="h-3 w-3 text-green-500" />
                              Synced
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-muted-foreground">
                              <XCircle className="h-3 w-3" />
                              Not synced
                            </Badge>
                          )}
                        </td>
                        <td className="py-4">
                          {item.profile?.onboardingCompleted && item.profile?.approvalStatus === "pending" && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => approveMutation.mutate(item.profile!.id)}
                                disabled={approveMutation.isPending || rejectMutation.isPending}
                                data-testid={`button-approve-${item.user.id}`}
                              >
                                {approveMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Approve
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => rejectMutation.mutate(item.profile!.id)}
                                disabled={approveMutation.isPending || rejectMutation.isPending}
                                data-testid={`button-reject-${item.user.id}`}
                              >
                                {rejectMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Reject
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {(!usersWithProfiles || usersWithProfiles.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  No users found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

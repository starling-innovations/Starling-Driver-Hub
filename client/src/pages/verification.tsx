import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle, Clock, AlertCircle, Shield, Loader2, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DriverProfile } from "@shared/schema";

export default function VerificationPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery<DriverProfile>({
    queryKey: ["/api/profile"],
  });

  const { data: statusData, refetch: refetchStatus } = useQuery<{ status: string; stripeStatus?: string }>({
    queryKey: ["/api/identity/status"],
    enabled: !!profile?.approvalStatus && profile.approvalStatus === "approved",
    refetchInterval: isVerifying ? 3000 : false,
  });

  const [stripeLoaded, setStripeLoaded] = useState(false);

  useEffect(() => {
    if ((window as any).Stripe) {
      setStripeLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.async = true;
    script.onload = () => setStripeLoaded(true);
    document.body.appendChild(script);
    return () => {
      if (script.parentNode) {
        document.body.removeChild(script);
      }
    };
  }, []);

  async function getPublishableKey() {
    const response = await fetch("/api/stripe/publishable-key");
    const data = await response.json();
    return data.publishableKey;
  }

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/identity/create-session");
      return await response.json();
    },
    onSuccess: async (data) => {
      if (data.clientSecret && stripeLoaded) {
        const publishableKey = await getPublishableKey();
        const stripe = (window as any).Stripe(publishableKey);
        setIsVerifying(true);
        
        const { error } = await stripe.verifyIdentity(data.clientSecret);
        
        if (error) {
          toast({
            title: "Verification Error",
            description: error.message,
            variant: "destructive",
          });
          setIsVerifying(false);
        } else {
          toast({
            title: "Verification Submitted",
            description: "We're reviewing your documents. This usually takes a few minutes.",
          });
          setTimeout(() => {
            refetchStatus();
            queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
          }, 2000);
        }
      } else if (!stripeLoaded) {
        toast({
          title: "Loading",
          description: "Please wait while we set up verification...",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start verification. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (statusData?.status === "verified") {
      setIsVerifying(false);
    }
  }, [statusData?.status]);

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto text-center py-8">
          <p className="text-muted-foreground">Profile not found</p>
          <Link href="/">
            <Button className="mt-4">Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (profile.approvalStatus !== "approved") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-semibold">Identity Verification</h1>
          </div>
        </header>
        <main className="max-w-md mx-auto p-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <Clock className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Account Pending Approval</h2>
              <p className="text-muted-foreground">
                Your account is pending admin approval. Once approved, you'll be able to complete identity verification.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const verificationStatus = statusData?.status || profile.identityVerificationStatus;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-semibold">Identity Verification</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        {verificationStatus === "verified" ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-lg font-semibold mb-2">Identity Verified</h2>
              <p className="text-muted-foreground mb-4">
                Your identity has been successfully verified. You're all set to start driving!
              </p>
              <Badge variant="default" className="gap-1">
                <Shield className="h-3 w-3" />
                Verified Driver
              </Badge>
            </CardContent>
          </Card>
        ) : verificationStatus === "pending" || isVerifying ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                Verification Processing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Your identity documents are being reviewed. This usually takes a few minutes.
              </p>
              <p className="text-sm text-muted-foreground">
                You can close this page - we'll notify you when verification is complete.
              </p>
            </CardContent>
          </Card>
        ) : verificationStatus === "requires_input" ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-500" />
                Verification In Progress
              </CardTitle>
              <CardDescription>
                {isVerifying 
                  ? "Processing your verification..."
                  : "Continue your identity verification to complete setup."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isVerifying ? (
                <div className="text-center py-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">Verifying your documents...</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    You started a verification session but haven't completed it yet. 
                    Click below to continue.
                  </p>
                  <Button 
                    className="w-full"
                    onClick={() => createSessionMutation.mutate()}
                    disabled={createSessionMutation.isPending}
                    data-testid="button-continue-verification"
                  >
                    {createSessionMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Continue Verification
                  </Button>
                </>
              )}
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => refetchStatus()}
                data-testid="button-refresh-status"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Check Status
              </Button>
            </CardContent>
          </Card>
        ) : verificationStatus === "failed" ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-lg font-semibold mb-2">Verification Failed</h2>
              <p className="text-muted-foreground mb-4">
                We couldn't verify your identity. Please try again with clear photos of your documents.
              </p>
              <Button 
                onClick={() => createSessionMutation.mutate()}
                disabled={createSessionMutation.isPending}
                data-testid="button-retry-verification"
              >
                {createSessionMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-500" />
                Verify Your Identity
              </CardTitle>
              <CardDescription>
                Complete identity verification to start accepting deliveries.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-primary">1</span>
                  </div>
                  <div>
                    <p className="font-medium">Take a photo of your ID</p>
                    <p className="text-sm text-muted-foreground">
                      Driver's license, passport, or government ID
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-primary">2</span>
                  </div>
                  <div>
                    <p className="font-medium">Take a selfie</p>
                    <p className="text-sm text-muted-foreground">
                      We'll match your face to your ID
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-primary">3</span>
                  </div>
                  <div>
                    <p className="font-medium">Get verified</p>
                    <p className="text-sm text-muted-foreground">
                      Usually takes just a few minutes
                    </p>
                  </div>
                </div>
              </div>

              <Button 
                className="w-full"
                onClick={() => createSessionMutation.mutate()}
                disabled={createSessionMutation.isPending}
                data-testid="button-start-verification"
              >
                {createSessionMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                Start Verification
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

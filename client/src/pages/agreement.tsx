import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ExternalLink, CheckCircle2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { DriverProfile } from "@shared/schema";
import { useState } from "react";

export default function AgreementPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [agreed, setAgreed] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery<DriverProfile | null>({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  const signMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", "/api/profile", {
        agreementSigned: true,
        agreementSignedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({
        title: "Agreement Signed",
        description: "Thank you for signing the Driver Partner Agreement.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to sign agreement",
        variant: "destructive",
      });
    },
  });

  const handleSign = () => {
    if (agreed) {
      signMutation.mutate();
    }
  };

  const isLoading = authLoading || profileLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">Please complete onboarding first</p>
            <Button onClick={() => setLocation("/onboarding")}>
              Start Onboarding
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSigned = profile.agreementSigned;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <p className="font-medium">Partner Agreement</p>
            <p className="text-xs text-muted-foreground">Driver Partner Onboarding Agreement</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 pb-24">
        {isSigned ? (
          <Card className="border-green-500/20 bg-green-500/5">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
                <div>
                  <p className="font-medium text-lg">Agreement Signed</p>
                  <p className="text-sm text-muted-foreground">
                    You signed the Driver Partner Agreement on{" "}
                    {profile.agreementSignedAt 
                      ? new Date(profile.agreementSignedAt).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  className="gap-2 mt-4"
                  onClick={() => window.open("https://example.com/driver-agreement", "_blank")}
                  data-testid="button-view-agreement"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Agreement
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Driver Partner Agreement</CardTitle>
                  <CardDescription>Please review and sign</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-md p-4 space-y-3 text-sm max-h-64 overflow-y-auto">
                <p className="font-medium">Starling Driver Partner Agreement</p>
                <p className="text-muted-foreground">
                  By signing this agreement, you acknowledge that you are an independent contractor 
                  and agree to Starling's terms and conditions for driver partners.
                </p>
                <p className="text-muted-foreground">
                  This includes but is not limited to:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                  <li>Maintaining valid driver's license and insurance</li>
                  <li>Following all traffic laws and safety guidelines</li>
                  <li>Representing Starling professionally during deliveries</li>
                  <li>Keeping your vehicle clean and well-maintained</li>
                  <li>Completing deliveries in a timely manner</li>
                  <li>Maintaining proper communication with customers</li>
                  <li>Adhering to all food safety regulations when applicable</li>
                </ul>
                <p className="text-muted-foreground pt-2">
                  <strong>Compensation:</strong> You will receive weekly payments via e-transfer to the email 
                  address you provided in your profile. Payment is calculated based on completed deliveries 
                  and any applicable bonuses.
                </p>
                <p className="text-muted-foreground">
                  <strong>Termination:</strong> Either party may terminate this agreement at any time with 
                  or without cause. Upon termination, you must complete any outstanding deliveries and 
                  return any Starling property in your possession.
                </p>
              </div>
              
              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={() => window.open("https://example.com/driver-agreement", "_blank")}
                data-testid="button-view-full-agreement"
              >
                <ExternalLink className="h-4 w-4" />
                View Full Agreement
              </Button>

              <div className="flex items-start gap-3 space-y-0 p-4 border rounded-md">
                <Checkbox 
                  id="agreement-checkbox"
                  checked={agreed}
                  onCheckedChange={(checked) => setAgreed(checked === true)}
                  data-testid="checkbox-agreement"
                />
                <label 
                  htmlFor="agreement-checkbox" 
                  className="text-sm cursor-pointer leading-relaxed"
                >
                  I have read and agree to the Driver Partner Onboarding Agreement
                </label>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {!isSigned && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 pb-6">
          <Button 
            className="w-full" 
            onClick={handleSign}
            disabled={!agreed || signMutation.isPending}
            data-testid="button-sign"
          >
            {signMutation.isPending ? "Signing..." : "Sign Agreement"}
          </Button>
        </div>
      )}
    </div>
  );
}

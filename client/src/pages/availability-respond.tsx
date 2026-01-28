import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  ThermometerSun, 
  Package,
  Loader2
} from "lucide-react";

interface AvailabilityTokenData {
  workerName: string;
  date: string;
  formattedDate: string;
  responded: boolean;
  response: string | null;
  thermalBlanket: boolean;
  thermalBag: boolean;
  otherPackaging: boolean;
  notes: string | null;
}

export default function AvailabilityRespondPage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();

  const [thermalBlanket, setThermalBlanket] = useState(false);
  const [thermalBag, setThermalBag] = useState(false);
  const [otherPackaging, setOtherPackaging] = useState(false);
  const [notes, setNotes] = useState("");

  const { data, isLoading, error, refetch } = useQuery<AvailabilityTokenData>({
    queryKey: ["/api/availability-response", token],
    queryFn: async () => {
      const response = await fetch(`/api/availability-response/${token}`, {
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to load availability request");
      }
      return response.json();
    },
    enabled: !!token,
  });

  useEffect(() => {
    if (data) {
      setThermalBlanket(data.thermalBlanket || false);
      setThermalBag(data.thermalBag || false);
      setOtherPackaging(data.otherPackaging || false);
      setNotes(data.notes || "");
    }
  }, [data]);

  const respondMutation = useMutation({
    mutationFn: async (response: "available" | "unavailable") => {
      return apiRequest("POST", `/api/availability-response/${token}`, {
        response,
        notes,
        thermalBlanket,
        thermalBag,
        otherPackaging,
      });
    },
    onSuccess: () => {
      toast({
        title: "Response Submitted",
        description: "Your availability has been recorded. Thank you!",
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit response",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-8 w-3/4 mx-auto" />
            <Skeleton className="h-6 w-1/2 mx-auto" />
            <Skeleton className="h-32 w-full" />
            <div className="flex gap-3">
              <Skeleton className="h-12 flex-1" />
              <Skeleton className="h-12 flex-1" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle className="mb-2">Invalid or Expired Link</CardTitle>
            <p className="text-muted-foreground">
              {(error as Error)?.message || "This availability link is no longer valid."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.responded) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <CardTitle className="mb-2">Response Recorded</CardTitle>
            <p className="text-muted-foreground mb-4">
              You've already responded to this availability request.
            </p>
            <div className="p-4 rounded-md bg-muted/50">
              <p className="text-sm font-medium">{data.formattedDate}</p>
              <p className="text-lg font-bold text-primary capitalize">
                {data.response === "available" ? "Available" : "Not Available"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground">
        <div className="px-4 py-4 text-center">
          <h1 className="font-bold text-lg">Starling Driver Partners</h1>
          <p className="text-sm opacity-90">Route Availability</p>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 pb-32">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center pb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <CardTitle data-testid="text-worker-name">Hi, {data.workerName}!</CardTitle>
            <CardDescription className="text-base">
              Are you available for a route on:
            </CardDescription>
            <div className="mt-2 p-3 rounded-md bg-primary/10">
              <p className="text-lg font-bold text-primary" data-testid="text-availability-date">
                {data.formattedDate}
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="h-4 w-4" />
                <span className="font-medium">Packaging Equipment</span>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="thermalBlanket"
                    checked={thermalBlanket}
                    onCheckedChange={(checked) => setThermalBlanket(checked === true)}
                    data-testid="checkbox-thermal-blanket"
                  />
                  <Label htmlFor="thermalBlanket" className="flex items-center gap-2">
                    <ThermometerSun className="h-4 w-4 text-orange-500" />
                    Thermal Blanket
                  </Label>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="thermalBag"
                    checked={thermalBag}
                    onCheckedChange={(checked) => setThermalBag(checked === true)}
                    data-testid="checkbox-thermal-bag"
                  />
                  <Label htmlFor="thermalBag" className="flex items-center gap-2">
                    <ThermometerSun className="h-4 w-4 text-blue-500" />
                    Thermal Bag
                  </Label>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="otherPackaging"
                    checked={otherPackaging}
                    onCheckedChange={(checked) => setOtherPackaging(checked === true)}
                    data-testid="checkbox-other-packaging"
                  />
                  <Label htmlFor="otherPackaging" className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-gray-500" />
                    Other Packaging
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional information (e.g., available after 10am, can do partial route)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-none"
                rows={3}
                data-testid="textarea-notes"
              />
            </div>
          </CardContent>
        </Card>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 pb-6">
        <div className="max-w-md mx-auto flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-14 text-base border-destructive text-destructive hover:bg-destructive/10"
            onClick={() => respondMutation.mutate("unavailable")}
            disabled={respondMutation.isPending}
            data-testid="button-unavailable"
          >
            {respondMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <XCircle className="h-5 w-5 mr-2" />
                Not Available
              </>
            )}
          </Button>
          <Button
            className="flex-1 h-14 text-base bg-green-600 hover:bg-green-700"
            onClick={() => respondMutation.mutate("available")}
            disabled={respondMutation.isPending}
            data-testid="button-available"
          >
            {respondMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 mr-2" />
                Available
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

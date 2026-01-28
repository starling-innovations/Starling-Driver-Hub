import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { ArrowLeft, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { DriverProfile } from "@shared/schema";

const canadianPhoneRegex = /^(\+1)?[\s.-]?\(?[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string()
    .min(1, "Phone number is required")
    .regex(canadianPhoneRegex, "Please enter a valid Canadian phone number (e.g., 416-555-1234)"),
  etransferEmail: z.string().email("Valid e-transfer email is required"),
  etransferAutoDepositConfirmed: z.boolean(),
  streetAddress: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  province: z.string().min(1, "Province is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  googlePlaceId: z.string().optional(),
});

interface PlacePrediction {
  place_id: string;
  description: string;
}

export default function ProfilePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [addressInput, setAddressInput] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery<DriverProfile | null>({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      etransferEmail: "",
      etransferAutoDepositConfirmed: false,
      streetAddress: "",
      city: "",
      province: "",
      postalCode: "",
      googlePlaceId: "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        email: profile.email || "",
        phone: profile.phone || "",
        etransferEmail: profile.etransferEmail || "",
        etransferAutoDepositConfirmed: profile.etransferAutoDepositConfirmed || false,
        streetAddress: profile.streetAddress || "",
        city: profile.city || "",
        province: profile.province || "",
        postalCode: profile.postalCode || "",
        googlePlaceId: profile.googlePlaceId || "",
      });
      if (profile.streetAddress) {
        setAddressInput(`${profile.streetAddress}, ${profile.city}, ${profile.province} ${profile.postalCode}`);
      }
    }
  }, [profile]);

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 3) {
      setPredictions([]);
      return;
    }
    try {
      const response = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(input)}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.predictions) {
        setPredictions(data.predictions);
      }
    } catch (error) {
      console.error("Error fetching predictions:", error);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (addressInput && showPredictions) {
        fetchPredictions(addressInput);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [addressInput, showPredictions, fetchPredictions]);

  const selectPlace = async (prediction: PlacePrediction) => {
    try {
      const response = await fetch(`/api/places/details?placeId=${encodeURIComponent(prediction.place_id)}`, {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.result?.address_components) {
        const components = data.result.address_components;
        let streetNumber = "";
        let route = "";
        let city = "";
        let province = "";
        let postalCode = "";

        for (const component of components) {
          if (component.types.includes("street_number")) {
            streetNumber = component.long_name;
          } else if (component.types.includes("route")) {
            route = component.long_name;
          } else if (component.types.includes("locality")) {
            city = component.long_name;
          } else if (component.types.includes("administrative_area_level_1")) {
            province = component.long_name;
          } else if (component.types.includes("postal_code")) {
            postalCode = component.long_name;
          }
        }

        const streetAddress = `${streetNumber} ${route}`.trim();
        form.setValue("streetAddress", streetAddress);
        form.setValue("city", city);
        form.setValue("province", province);
        form.setValue("postalCode", postalCode);
        form.setValue("googlePlaceId", prediction.place_id);
        setAddressInput(prediction.description);
      }
    } catch (error) {
      console.error("Error fetching place details:", error);
    }
    setPredictions([]);
    setShowPredictions(false);
  };

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (match) {
      const parts = [match[1], match[2], match[3]].filter(Boolean);
      if (parts.length === 0) return '';
      if (parts.length === 1) return parts[0];
      if (parts.length === 2) return `${parts[0]}-${parts[1]}`;
      return `${parts[0]}-${parts[1]}-${parts[2]}`;
    }
    return value;
  };

  const saveMutation = useMutation({
    mutationFn: async (data: z.infer<typeof profileSchema>) => {
      return apiRequest("PATCH", "/api/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({
        title: "Profile Updated",
        description: "Your changes have been saved and synced.",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save profile",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof profileSchema>) => {
    saveMutation.mutate(data);
  };

  const isLoading = authLoading || profileLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
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
            <p className="font-medium">My Profile</p>
            <p className="text-xs text-muted-foreground">Personal information & address</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 pb-24">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Personal Information</CardTitle>
                <CardDescription>Your name and contact details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            data-testid="input-first-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            data-testid="input-last-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          {...field} 
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input 
                          type="tel"
                          placeholder="416-555-1234"
                          {...field}
                          onChange={(e) => {
                            const formatted = formatPhoneNumber(e.target.value);
                            field.onChange(formatted);
                          }}
                          data-testid="input-phone"
                        />
                      </FormControl>
                      <FormDescription>Canadian phone number required</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="etransferEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-Transfer Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          {...field} 
                          data-testid="input-etransfer-email"
                        />
                      </FormControl>
                      <FormDescription>Email for receiving weekly payments</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="etransferAutoDepositConfirmed"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-auto-deposit"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          I confirm this email has auto-deposit enabled
                        </FormLabel>
                        <FormDescription>
                          Auto-deposit must be enabled to receive payments automatically
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Address</CardTitle>
                <CardDescription>Your current address</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Label>Search Address</Label>
                  <Input
                    placeholder="Start typing your address..."
                    value={addressInput}
                    onChange={(e) => {
                      setAddressInput(e.target.value);
                      setShowPredictions(true);
                    }}
                    onFocus={() => setShowPredictions(true)}
                    data-testid="input-address-search"
                  />
                  {showPredictions && predictions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {predictions.map((prediction) => (
                        <button
                          key={prediction.place_id}
                          type="button"
                          className="w-full px-4 py-3 text-left text-sm hover-elevate border-b last:border-b-0"
                          onClick={() => selectPlace(prediction)}
                          data-testid={`place-${prediction.place_id}`}
                        >
                          {prediction.description}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="streetAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street Address</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          data-testid="input-street-address"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          data-testid="input-city"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="province"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Province</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            data-testid="input-province"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Code</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            data-testid="input-postal-code"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 pb-6">
        <Button 
          className="w-full" 
          onClick={form.handleSubmit(onSubmit)}
          disabled={saveMutation.isPending}
          data-testid="button-save"
        >
          {saveMutation.isPending ? (
            "Saving..."
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

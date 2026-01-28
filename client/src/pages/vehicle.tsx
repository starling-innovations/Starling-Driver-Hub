import { useEffect, useState, useRef } from "react";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ArrowLeft, Save, Truck, Camera, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { DriverProfile } from "@shared/schema";

const vehicleSchema = z.object({
  vehicleMake: z.string().min(1, "Vehicle make is required"),
  vehicleModel: z.string().min(1, "Vehicle model is required"),
  vehicleYear: z.string().min(1, "Vehicle year is required"),
  vehicleColor: z.string().min(1, "Vehicle color is required"),
  licensePlate: z.string().min(1, "License plate is required"),
  vehiclePhotoUrl: z.string().optional(),
  licensePlatePhotoUrl: z.string().optional(),
});

export default function VehiclePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(null);
  const [licensePlatePhoto, setLicensePlatePhoto] = useState<string | null>(null);
  const vehiclePhotoRef = useRef<HTMLInputElement>(null);
  const licensePlatePhotoRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading: profileLoading } = useQuery<DriverProfile | null>({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  const form = useForm<z.infer<typeof vehicleSchema>>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      vehicleMake: "",
      vehicleModel: "",
      vehicleYear: "",
      vehicleColor: "",
      licensePlate: "",
      vehiclePhotoUrl: "",
      licensePlatePhotoUrl: "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        vehicleMake: profile.vehicleMake || "",
        vehicleModel: profile.vehicleModel || "",
        vehicleYear: profile.vehicleYear || "",
        vehicleColor: profile.vehicleColor || "",
        licensePlate: profile.licensePlate || "",
        vehiclePhotoUrl: profile.vehiclePhotoUrl || "",
        licensePlatePhotoUrl: profile.licensePlatePhotoUrl || "",
      });
      if (profile.vehiclePhotoUrl) setVehiclePhoto(profile.vehiclePhotoUrl);
      if (profile.licensePlatePhotoUrl) setLicensePlatePhoto(profile.licensePlatePhotoUrl);
    }
  }, [profile]);

  const handlePhotoCapture = (
    event: React.ChangeEvent<HTMLInputElement>,
    type: 'vehicle' | 'licensePlate'
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        if (type === 'vehicle') {
          setVehiclePhoto(base64);
          form.setValue("vehiclePhotoUrl", base64);
        } else {
          setLicensePlatePhoto(base64);
          form.setValue("licensePlatePhotoUrl", base64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = (type: 'vehicle' | 'licensePlate') => {
    if (type === 'vehicle') {
      setVehiclePhoto(null);
      form.setValue("vehiclePhotoUrl", "");
      if (vehiclePhotoRef.current) vehiclePhotoRef.current.value = "";
    } else {
      setLicensePlatePhoto(null);
      form.setValue("licensePlatePhotoUrl", "");
      if (licensePlatePhotoRef.current) licensePlatePhotoRef.current.value = "";
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: z.infer<typeof vehicleSchema>) => {
      return apiRequest("PATCH", "/api/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({
        title: "Vehicle Updated",
        description: "Your vehicle information has been saved and synced.",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save vehicle info",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof vehicleSchema>) => {
    saveMutation.mutate(data);
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
            <p className="font-medium">Vehicle Info</p>
            <p className="text-xs text-muted-foreground">Your vehicle details</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 pb-24">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <Truck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Vehicle Details</CardTitle>
                    <CardDescription>Information about your delivery vehicle</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="vehicleMake"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Make</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Toyota"
                            {...field} 
                            data-testid="input-vehicle-make"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vehicleModel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Corolla"
                            {...field} 
                            data-testid="input-vehicle-model"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="vehicleYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="2020"
                            {...field} 
                            data-testid="input-vehicle-year"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vehicleColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Color</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Silver"
                            {...field} 
                            data-testid="input-vehicle-color"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="licensePlate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>License Plate</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="ABC 123"
                          {...field} 
                          data-testid="input-license-plate"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Vehicle Photos</CardTitle>
                <CardDescription>Photos of your vehicle and license plate</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="vehiclePhotoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Photo of Your Vehicle</FormLabel>
                      <FormControl>
                        <div>
                          {vehiclePhoto ? (
                            <div className="relative">
                              <img 
                                src={vehiclePhoto} 
                                alt="Vehicle" 
                                className="w-full h-48 object-cover rounded-md"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2"
                                onClick={() => removePhoto('vehicle')}
                                data-testid="button-remove-vehicle-photo"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div 
                              className="border-2 border-dashed rounded-md p-8 text-center cursor-pointer hover-elevate"
                              onClick={() => vehiclePhotoRef.current?.click()}
                            >
                              <Camera className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">Tap to take a photo of your vehicle</p>
                            </div>
                          )}
                          <input
                            ref={vehiclePhotoRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => handlePhotoCapture(e, 'vehicle')}
                            data-testid="input-vehicle-photo"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="licensePlatePhotoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Photo of License Plate</FormLabel>
                      <FormControl>
                        <div>
                          {licensePlatePhoto ? (
                            <div className="relative">
                              <img 
                                src={licensePlatePhoto} 
                                alt="License Plate" 
                                className="w-full h-48 object-cover rounded-md"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2"
                                onClick={() => removePhoto('licensePlate')}
                                data-testid="button-remove-license-photo"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div 
                              className="border-2 border-dashed rounded-md p-8 text-center cursor-pointer hover-elevate"
                              onClick={() => licensePlatePhotoRef.current?.click()}
                            >
                              <Camera className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">Tap to take a photo of your license plate</p>
                            </div>
                          )}
                          <input
                            ref={licensePlatePhotoRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => handlePhotoCapture(e, 'licensePlate')}
                            data-testid="input-license-photo"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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

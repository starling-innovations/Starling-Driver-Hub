import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  User, 
  MapPin, 
  Truck, 
  FileText,
  ExternalLink,
  Camera,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { DriverProfile } from "@shared/schema";

const canadianPhoneRegex = /^(\+1)?[\s.-]?\(?[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;

const personalInfoSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string()
    .min(1, "Phone number is required")
    .regex(canadianPhoneRegex, "Please enter a valid Canadian phone number (e.g., 416-555-1234)"),
  etransferEmail: z.string().email("Valid e-transfer email is required"),
  etransferAutoDepositConfirmed: z.boolean().refine((val) => val === true, {
    message: "You must confirm auto-deposit is enabled",
  }),
});

const addressSchema = z.object({
  streetAddress: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  province: z.string().min(1, "Province is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  googlePlaceId: z.string().optional(),
});

const vehicleSchema = z.object({
  vehicleMake: z.string().min(1, "Vehicle make is required"),
  vehicleModel: z.string().min(1, "Vehicle model is required"),
  vehicleYear: z.string().min(1, "Vehicle year is required"),
  vehicleColor: z.string().min(1, "Vehicle color is required"),
  licensePlate: z.string().min(1, "License plate is required"),
  vehiclePhotoUrl: z.string().min(1, "Vehicle photo is required"),
  licensePlatePhotoUrl: z.string().min(1, "License plate photo is required"),
});

const agreementSchema = z.object({
  agreementSigned: z.boolean().refine((val) => val === true, {
    message: "You must sign the agreement before continuing",
  }),
});

const TOTAL_STEPS = 4;
const DROPBOX_SIGN_URL = "https://app.hellosign.com/s/EzWAyRrV";

const steps = [
  { id: 1, title: "Personal Info", icon: User },
  { id: 2, title: "Address", icon: MapPin },
  { id: 3, title: "Vehicle", icon: Truck },
  { id: 4, title: "Agreement", icon: FileText },
];

interface PlacePrediction {
  place_id: string;
  description: string;
}

export default function OnboardingPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useQuery<DriverProfile | null>({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [addressInput, setAddressInput] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(null);
  const [licensePlatePhoto, setLicensePlatePhoto] = useState<string | null>(null);
  const vehiclePhotoRef = useRef<HTMLInputElement>(null);
  const licensePlatePhotoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile?.onboardingStep && profile.onboardingStep > 1) {
      setCurrentStep(Math.min(profile.onboardingStep, TOTAL_STEPS));
    }
  }, [profile]);

  const personalForm = useForm<z.infer<typeof personalInfoSchema>>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      etransferEmail: "",
      etransferAutoDepositConfirmed: false,
    },
  });

  const addressForm = useForm<z.infer<typeof addressSchema>>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      streetAddress: "",
      city: "",
      province: "",
      postalCode: "",
      googlePlaceId: "",
    },
  });

  const vehicleForm = useForm<z.infer<typeof vehicleSchema>>({
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

  const agreementForm = useForm<z.infer<typeof agreementSchema>>({
    resolver: zodResolver(agreementSchema),
    defaultValues: {
      agreementSigned: false,
    },
  });

  useEffect(() => {
    if (profile) {
      personalForm.reset({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        email: profile.email || "",
        phone: profile.phone || "",
        etransferEmail: profile.etransferEmail || "",
        etransferAutoDepositConfirmed: profile.etransferAutoDepositConfirmed || false,
      });
      addressForm.reset({
        streetAddress: profile.streetAddress || "",
        city: profile.city || "",
        province: profile.province || "",
        postalCode: profile.postalCode || "",
        googlePlaceId: profile.googlePlaceId || "",
      });
      if (profile.streetAddress) {
        setAddressInput(`${profile.streetAddress}, ${profile.city}, ${profile.province} ${profile.postalCode}`);
      }
      vehicleForm.reset({
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
      agreementForm.reset({
        agreementSigned: profile.agreementSigned || false,
      });
    } else if (user) {
      personalForm.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: "",
        etransferEmail: user.email || "",
        etransferAutoDepositConfirmed: false,
      });
    }
  }, [profile, user]);

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
        addressForm.setValue("streetAddress", streetAddress);
        addressForm.setValue("city", city);
        addressForm.setValue("province", province);
        addressForm.setValue("postalCode", postalCode);
        addressForm.setValue("googlePlaceId", prediction.place_id);
        setAddressInput(prediction.description);
      }
    } catch (error) {
      console.error("Error fetching place details:", error);
    }
    setPredictions([]);
    setShowPredictions(false);
  };

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
          vehicleForm.setValue("vehiclePhotoUrl", base64);
        } else {
          setLicensePlatePhoto(base64);
          vehicleForm.setValue("licensePlatePhotoUrl", base64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = (type: 'vehicle' | 'licensePlate') => {
    if (type === 'vehicle') {
      setVehiclePhoto(null);
      vehicleForm.setValue("vehiclePhotoUrl", "");
      if (vehiclePhotoRef.current) vehiclePhotoRef.current.value = "";
    } else {
      setLicensePlatePhoto(null);
      vehicleForm.setValue("licensePlatePhotoUrl", "");
      if (licensePlatePhotoRef.current) licensePlatePhotoRef.current.value = "";
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const method = profile ? "PATCH" : "POST";
      const url = profile ? "/api/profile" : "/api/profile";
      return apiRequest(method, url, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save progress",
        variant: "destructive",
      });
    },
  });

  const handleNext = async () => {
    let isValid = false;
    let formData: any = {};

    switch (currentStep) {
      case 1:
        isValid = await personalForm.trigger();
        if (isValid) {
          formData = { ...personalForm.getValues(), onboardingStep: 2 };
        }
        break;
      case 2:
        isValid = await addressForm.trigger();
        if (isValid) {
          formData = { ...addressForm.getValues(), onboardingStep: 3 };
        }
        break;
      case 3:
        isValid = await vehicleForm.trigger();
        if (isValid) {
          formData = { ...vehicleForm.getValues(), onboardingStep: 4 };
        }
        break;
      case 4:
        isValid = await agreementForm.trigger();
        if (isValid) {
          formData = { 
            ...agreementForm.getValues(), 
            onboardingStep: 5,
            onboardingCompleted: true,
            agreementSignedAt: new Date().toISOString(),
          };
        }
        break;
    }

    if (isValid) {
      await saveMutation.mutateAsync(formData);
      if (currentStep < TOTAL_STEPS) {
        setCurrentStep(currentStep + 1);
      } else {
        toast({
          title: "Onboarding Complete!",
          description: "You're all set to start driving with Starling.",
        });
        setLocation("/");
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      setLocation("/");
    }
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

  const isLoading = authLoading || profileLoading;
  const progress = ((currentStep - 1) / TOTAL_STEPS) * 100;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleBack}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <p className="font-medium text-sm">Step {currentStep} of {TOTAL_STEPS}</p>
              <p className="text-xs text-muted-foreground">{steps[currentStep - 1].title}</p>
            </div>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 space-y-4 flex items-center gap-2 overflow-x-auto">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            return (
              <div 
                key={step.id} 
                className={`flex items-center gap-2 px-3 py-2 rounded-md flex-shrink-0 ${
                  isCurrent 
                    ? "bg-primary/10 text-primary" 
                    : isCompleted 
                      ? "bg-green-500/10 text-green-600" 
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <StepIcon className="h-4 w-4" />
                )}
                <span className="text-xs font-medium whitespace-nowrap">{step.title}</span>
              </div>
            );
          })}
        </div>

        <main className="px-4 pb-32">
          {currentStep === 1 && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Personal Information</CardTitle>
                <CardDescription>Tell us about yourself</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...personalForm}>
                  <form className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={personalForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="John" 
                                {...field} 
                                data-testid="input-first-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={personalForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Doe" 
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
                      control={personalForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input 
                              type="email" 
                              placeholder="john@example.com" 
                              {...field} 
                              data-testid="input-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={personalForm.control}
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
                      control={personalForm.control}
                      name="etransferEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-Transfer Email</FormLabel>
                          <FormControl>
                            <Input 
                              type="email" 
                              placeholder="payments@example.com" 
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
                      control={personalForm.control}
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Address</CardTitle>
                <CardDescription>Where are you located?</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...addressForm}>
                  <form className="space-y-4">
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
                      control={addressForm.control}
                      name="streetAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street Address</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="123 Main St" 
                              {...field} 
                              data-testid="input-street-address"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addressForm.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Toronto" 
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
                        control={addressForm.control}
                        name="province"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Province</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Ontario" 
                                {...field} 
                                data-testid="input-province"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addressForm.control}
                        name="postalCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Postal Code</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="M5V 1A1" 
                                {...field} 
                                data-testid="input-postal-code"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {currentStep === 3 && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Vehicle Information</CardTitle>
                <CardDescription>Tell us about your vehicle</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...vehicleForm}>
                  <form className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={vehicleForm.control}
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
                        control={vehicleForm.control}
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
                        control={vehicleForm.control}
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
                        control={vehicleForm.control}
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
                      control={vehicleForm.control}
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

                    <div className="space-y-4 pt-4 border-t">
                      <h3 className="font-medium text-sm">Vehicle Photos</h3>
                      
                      <FormField
                        control={vehicleForm.control}
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
                        control={vehicleForm.control}
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
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {currentStep === 4 && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Driver Partner Agreement</CardTitle>
                <CardDescription>Complete your agreement to start driving</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 rounded-md p-4 space-y-3 text-sm">
                  <p className="font-medium">Important: Sign Your Agreement</p>
                  <p className="text-muted-foreground">
                    Before you can start driving with Starling, you must sign the Driver Partner 
                    Onboarding Agreement using Dropbox Sign.
                  </p>
                  <p className="text-muted-foreground">
                    Click the button below to open the agreement in a new window, review it, 
                    and sign electronically.
                  </p>
                </div>
                
                <Button 
                  type="button"
                  className="w-full"
                  onClick={() => window.open(DROPBOX_SIGN_URL, '_blank')}
                  data-testid="button-sign-agreement"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Sign Agreement with Dropbox Sign
                </Button>

                <div className="border-t pt-4">
                  <Form {...agreementForm}>
                    <FormField
                      control={agreementForm.control}
                      name="agreementSigned"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-agreement"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              I have signed the Driver Partner Agreement
                            </FormLabel>
                            <FormDescription>
                              By checking this box, you confirm that you have completed 
                              signing the agreement via Dropbox Sign
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormMessage />
                  </Form>
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
        <Button 
          className="w-full" 
          size="lg"
          onClick={handleNext}
          disabled={saveMutation.isPending}
          data-testid="button-next"
        >
          {saveMutation.isPending ? (
            "Saving..."
          ) : currentStep === TOTAL_STEPS ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Complete Onboarding
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

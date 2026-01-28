import { useState, useEffect } from "react";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  User, 
  MapPin, 
  Truck, 
  FileText,
  ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { DriverProfile } from "@shared/schema";

const personalInfoSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  etransferEmail: z.string().email("Valid e-transfer email is required"),
});

const addressSchema = z.object({
  streetAddress: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  province: z.string().min(1, "Province is required"),
  postalCode: z.string().min(1, "Postal code is required"),
});

const vehicleSchema = z.object({
  vehicleMake: z.string().min(1, "Vehicle make is required"),
  vehicleModel: z.string().min(1, "Vehicle model is required"),
  vehicleYear: z.string().optional(),
  vehicleColor: z.string().optional(),
  licensePlate: z.string().optional(),
});

const agreementSchema = z.object({
  agreementSigned: z.boolean().refine((val) => val === true, {
    message: "You must agree to the terms to continue",
  }),
});

const TOTAL_STEPS = 4;

const steps = [
  { id: 1, title: "Personal Info", icon: User },
  { id: 2, title: "Address", icon: MapPin },
  { id: 3, title: "Vehicle", icon: Truck },
  { id: 4, title: "Agreement", icon: FileText },
];

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
    },
  });

  const addressForm = useForm<z.infer<typeof addressSchema>>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      streetAddress: "",
      city: "",
      province: "",
      postalCode: "",
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
      });
      addressForm.reset({
        streetAddress: profile.streetAddress || "",
        city: profile.city || "",
        province: profile.province || "",
        postalCode: profile.postalCode || "",
      });
      vehicleForm.reset({
        vehicleMake: profile.vehicleMake || "",
        vehicleModel: profile.vehicleModel || "",
        vehicleYear: profile.vehicleYear || "",
        vehicleColor: profile.vehicleColor || "",
        licensePlate: profile.licensePlate || "",
      });
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
      });
    }
  }, [profile, user]);

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
                          <FormLabel>Phone (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              type="tel" 
                              placeholder="(555) 123-4567" 
                              {...field} 
                              data-testid="input-phone"
                            />
                          </FormControl>
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
                            <FormLabel>Year (Optional)</FormLabel>
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
                            <FormLabel>Color (Optional)</FormLabel>
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
                          <FormLabel>License Plate (Optional)</FormLabel>
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
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {currentStep === 4 && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Driver Partner Agreement</CardTitle>
                <CardDescription>Please review and accept our terms</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 rounded-md p-4 space-y-3 text-sm">
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
                  </ul>
                </div>
                
                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={() => window.open("https://example.com/driver-agreement", "_blank")}
                  data-testid="button-view-agreement"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Full Agreement
                </Button>

                <Form {...agreementForm}>
                  <form>
                    <FormField
                      control={agreementForm.control}
                      name="agreementSigned"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3 space-y-0 p-4 border rounded-md">
                          <FormControl>
                            <Checkbox 
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-agreement"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="cursor-pointer">
                              I have read and agree to the Driver Partner Onboarding Agreement
                            </FormLabel>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 pb-6">
        <Button 
          className="w-full" 
          onClick={handleNext}
          disabled={saveMutation.isPending}
          data-testid="button-next"
        >
          {saveMutation.isPending ? (
            "Saving..."
          ) : currentStep === TOTAL_STEPS ? (
            <>
              Complete Onboarding
              <Check className="h-4 w-4 ml-1" />
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

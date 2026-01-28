import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { updateDriverProfileSchema } from "@shared/schema";
import { z } from "zod";
import { syncDriverToOnfleet } from "./onfleet";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";

const canadianPhoneRegex = /^(\+1)?[\s.-]?\(?[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;

const step1ValidationSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().regex(canadianPhoneRegex, "Invalid Canadian phone number"),
  etransferEmail: z.string().email(),
  etransferAutoDepositConfirmed: z.literal(true, { 
    errorMap: () => ({ message: "Auto-deposit must be confirmed" })
  }),
});

const step2ValidationSchema = z.object({
  streetAddress: z.string().min(1),
  city: z.string().min(1),
  province: z.string().min(1),
  postalCode: z.string().min(1),
});

const step3ValidationSchema = z.object({
  vehicleMake: z.string().min(1),
  vehicleModel: z.string().min(1),
  vehicleYear: z.string().min(1),
  vehicleColor: z.string().min(1),
  licensePlate: z.string().min(1),
  vehiclePhotoUrl: z.string().min(1),
  licensePlatePhotoUrl: z.string().min(1),
});

const step4ValidationSchema = z.object({
  agreementSigned: z.literal(true),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getDriverProfile(userId);
      res.json(profile || null);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.post("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const existing = await storage.getDriverProfile(userId);
      if (existing) {
        return res.status(400).json({ message: "Profile already exists" });
      }

      const profileData = {
        userId,
        firstName: req.body.firstName || req.user.claims.first_name || "Driver",
        lastName: req.body.lastName || req.user.claims.last_name || "Partner",
        email: req.body.email || req.user.claims.email || "",
        etransferEmail: req.body.etransferEmail || req.body.email || req.user.claims.email || "",
        etransferAutoDepositConfirmed: req.body.etransferAutoDepositConfirmed || false,
        phone: req.body.phone || null,
        streetAddress: req.body.streetAddress || null,
        city: req.body.city || null,
        province: req.body.province || null,
        postalCode: req.body.postalCode || null,
        googlePlaceId: req.body.googlePlaceId || null,
        vehicleMake: req.body.vehicleMake || null,
        vehicleModel: req.body.vehicleModel || null,
        vehicleYear: req.body.vehicleYear || null,
        vehicleColor: req.body.vehicleColor || null,
        licensePlate: req.body.licensePlate || null,
        vehiclePhotoUrl: req.body.vehiclePhotoUrl || null,
        licensePlatePhotoUrl: req.body.licensePlatePhotoUrl || null,
        onboardingStep: req.body.onboardingStep || 1,
        onboardingCompleted: req.body.onboardingCompleted || false,
        agreementSigned: req.body.agreementSigned || false,
        agreementSignedAt: req.body.agreementSignedAt || null,
      };

      const profile = await storage.createDriverProfile(profileData);
      res.status(201).json(profile);
    } catch (error) {
      console.error("Error creating profile:", error);
      res.status(500).json({ message: "Failed to create profile" });
    }
  });

  app.patch("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      let profile = await storage.getDriverProfile(userId);
      
      if (!profile) {
        const createData = {
          userId,
          firstName: req.body.firstName || req.user.claims.first_name || "Driver",
          lastName: req.body.lastName || req.user.claims.last_name || "Partner",
          email: req.body.email || req.user.claims.email || "",
          etransferEmail: req.body.etransferEmail || req.body.email || req.user.claims.email || "",
          etransferAutoDepositConfirmed: req.body.etransferAutoDepositConfirmed || false,
          phone: req.body.phone || null,
          streetAddress: req.body.streetAddress || null,
          city: req.body.city || null,
          province: req.body.province || null,
          postalCode: req.body.postalCode || null,
          googlePlaceId: req.body.googlePlaceId || null,
          vehicleMake: req.body.vehicleMake || null,
          vehicleModel: req.body.vehicleModel || null,
          vehicleYear: req.body.vehicleYear || null,
          vehicleColor: req.body.vehicleColor || null,
          licensePlate: req.body.licensePlate || null,
          vehiclePhotoUrl: req.body.vehiclePhotoUrl || null,
          licensePlatePhotoUrl: req.body.licensePlatePhotoUrl || null,
          onboardingStep: req.body.onboardingStep || 1,
          onboardingCompleted: req.body.onboardingCompleted || false,
          agreementSigned: req.body.agreementSigned || false,
          agreementSignedAt: req.body.agreementSignedAt || null,
        };
        profile = await storage.createDriverProfile(createData);
        return res.json(profile);
      }

      const updateData = { ...req.body };
      if (updateData.agreementSignedAt && typeof updateData.agreementSignedAt === 'string') {
        updateData.agreementSignedAt = new Date(updateData.agreementSignedAt);
      }

      const targetStep = updateData.onboardingStep;
      if (targetStep === 2) {
        step1ValidationSchema.parse(updateData);
      } else if (targetStep === 3) {
        step2ValidationSchema.parse(updateData);
      } else if (targetStep === 4) {
        step3ValidationSchema.parse(updateData);
      } else if (targetStep === 5 && updateData.onboardingCompleted) {
        step4ValidationSchema.parse(updateData);
      }

      const validated = updateDriverProfileSchema.parse(updateData);
      let updatedProfile = await storage.updateDriverProfile(userId, validated);
      
      if (!updatedProfile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      // When onboarding completes, driver stays in "pending" approval status
      // Admin must approve before syncing to Onfleet
      if (updatedProfile.onboardingCompleted && !updatedProfile.approvalStatus) {
        updatedProfile = await storage.updateDriverProfile(userId, {
          approvalStatus: "pending",
        });
        console.log(`Driver ${userId} onboarding completed - pending admin approval`);
      }
      
      res.json(updatedProfile);
    } catch (error) {
      console.error("Error updating profile:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.get("/api/places/autocomplete", isAuthenticated, async (req: any, res) => {
    try {
      const { input } = req.query;
      if (!input) {
        return res.status(400).json({ message: "Input is required" });
      }

      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Google Places API key not configured" });
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=address&components=country:ca&key=${apiKey}`
      );
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching places:", error);
      res.status(500).json({ message: "Failed to fetch places" });
    }
  });

  app.get("/api/places/details", isAuthenticated, async (req: any, res) => {
    try {
      const { placeId } = req.query;
      if (!placeId) {
        return res.status(400).json({ message: "Place ID is required" });
      }

      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Google Places API key not configured" });
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=address_components,formatted_address&key=${apiKey}`
      );
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching place details:", error);
      res.status(500).json({ message: "Failed to fetch place details" });
    }
  });

  // Admin authorization
  const ADMIN_EMAILS = [
    "hello@trystarling.com",
    "sarah@trystarling.com",
    "katie@trystarling.com",
    "francesco@trystarling.com",
  ];

  const isAdmin = async (req: any, res: any, next: any) => {
    const userEmail = req.user?.claims?.email;
    if (!userEmail || !ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
      return res.status(403).json({ message: "Access denied. Admin privileges required." });
    }
    next();
  };

  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const usersWithProfiles = await storage.getAllUsersWithProfiles();
      res.json(usersWithProfiles);
    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin approval endpoints
  app.post("/api/admin/approve/:profileId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { profileId } = req.params;
      const adminUserId = req.user.claims.sub;
      
      const profile = await storage.getDriverProfileById(profileId);
      if (!profile) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      if (profile.approvalStatus === "approved") {
        return res.status(400).json({ message: "Driver already approved" });
      }
      
      // Update approval status and set identity verification to pending
      // Driver must complete identity verification before being synced to Onfleet
      const updatedProfile = await storage.updateDriverProfileById(profileId, {
        approvalStatus: "approved",
        approvedAt: new Date(),
        approvedBy: adminUserId,
        identityVerificationStatus: "pending",
      });
      
      console.log(`Driver ${profileId} approved - awaiting identity verification`);
      res.json(updatedProfile);
    } catch (error) {
      console.error("Error approving driver:", error);
      res.status(500).json({ message: "Failed to approve driver" });
    }
  });

  // Stripe Identity verification endpoints
  app.post("/api/identity/create-session", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getDriverProfile(userId);
      
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      
      if (profile.approvalStatus !== "approved") {
        return res.status(400).json({ message: "Account must be approved before identity verification" });
      }
      
      if (profile.identityVerificationStatus === "verified") {
        return res.status(400).json({ message: "Identity already verified" });
      }
      
      const stripe = await getUncachableStripeClient();
      
      // Create Stripe Identity verification session
      const verificationSession = await stripe.identity.verificationSessions.create({
        type: "document",
        metadata: {
          userId: userId,
          profileId: profile.id,
        },
        options: {
          document: {
            allowed_types: ["driving_license", "passport", "id_card"],
            require_matching_selfie: true,
          },
        },
      });
      
      // Store the session ID
      await storage.updateDriverProfile(userId, {
        identityVerificationSessionId: verificationSession.id,
        identityVerificationStatus: "requires_input",
      });
      
      res.json({ 
        clientSecret: verificationSession.client_secret,
        sessionId: verificationSession.id,
      });
    } catch (error) {
      console.error("Error creating identity verification session:", error);
      res.status(500).json({ message: "Failed to create verification session" });
    }
  });

  app.get("/api/identity/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getDriverProfile(userId);
      
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      
      // If we have a session ID, check the latest status from Stripe
      if (profile.identityVerificationSessionId) {
        const stripe = await getUncachableStripeClient();
        const session = await stripe.identity.verificationSessions.retrieve(
          profile.identityVerificationSessionId
        );
        
        // Update local status if changed
        // Map Stripe status to our local status
        let newStatus = profile.identityVerificationStatus;
        switch (session.status) {
          case "verified":
            newStatus = "verified";
            break;
          case "requires_input":
          case "requires_action":
            newStatus = "requires_input";
            break;
          case "canceled":
            newStatus = "failed";
            break;
          case "processing":
          case "requires_review":
            newStatus = "pending";
            break;
          default:
            // Keep current status for unknown states
            break;
        }
        
        if (newStatus !== profile.identityVerificationStatus) {
          await storage.updateDriverProfile(userId, {
            identityVerificationStatus: newStatus,
            ...(newStatus === "verified" ? { identityVerifiedAt: new Date() } : {}),
          });
          
          // If verified, sync to Onfleet
          if (newStatus === "verified" && profile.phone && !profile.onfleetId) {
            try {
              const syncResult = await syncDriverToOnfleet({
                firstName: profile.firstName,
                lastName: profile.lastName,
                phone: profile.phone,
                streetAddress: profile.streetAddress,
                city: profile.city,
                province: profile.province,
                postalCode: profile.postalCode,
                googlePlaceId: profile.googlePlaceId,
                vehicleMake: profile.vehicleMake,
                vehicleModel: profile.vehicleModel,
                vehicleYear: profile.vehicleYear,
                vehicleColor: profile.vehicleColor,
                licensePlate: profile.licensePlate,
              });

              if (syncResult.success && syncResult.onfleetId) {
                await storage.updateDriverProfile(userId, {
                  onfleetId: syncResult.onfleetId,
                  onfleetSyncedAt: new Date(),
                });
                console.log(`Driver ${userId} identity verified and synced to Onfleet: ${syncResult.onfleetId}`);
              }
            } catch (onfleetError) {
              console.error("Onfleet sync error after verification:", onfleetError);
            }
          }
        }
        
        return res.json({ 
          status: newStatus,
          stripeStatus: session.status,
        });
      }
      
      res.json({ 
        status: profile.identityVerificationStatus || null,
      });
    } catch (error) {
      console.error("Error checking identity status:", error);
      res.status(500).json({ message: "Failed to check verification status" });
    }
  });

  app.get("/api/stripe/publishable-key", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Error getting Stripe publishable key:", error);
      res.status(500).json({ message: "Failed to get Stripe configuration" });
    }
  });

  // Stripe Identity webhook handler
  // In production, STRIPE_WEBHOOK_SECRET is required for signature verification
  app.post("/api/webhooks/stripe-identity", express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
      const isProduction = process.env.NODE_ENV === "production";
      let event;
      
      // Require signature verification in production
      if (isProduction && !endpointSecret) {
        console.error("Webhook error: STRIPE_WEBHOOK_SECRET required in production");
        return res.status(500).json({ error: "Webhook not configured" });
      }
      
      // Verify webhook signature if secret is configured
      if (endpointSecret) {
        const sig = req.headers['stripe-signature'];
        if (!sig) {
          console.error("Webhook error: Missing stripe-signature header");
          return res.status(400).json({ error: "Missing signature" });
        }
        try {
          const stripe = await getUncachableStripeClient();
          event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } catch (err: any) {
          console.error("Webhook signature verification failed:", err.message);
          return res.status(400).json({ error: "Invalid signature" });
        }
      } else {
        // Development mode only - parse without verification
        console.warn("DEV MODE: STRIPE_WEBHOOK_SECRET not configured - signatures not verified");
        event = JSON.parse(req.body.toString());
      }
      
      // Handle all identity verification session events
      if (event.type.startsWith("identity.verification_session.")) {
        const session = event.data.object;
        const sessionId = session.id;
        
        // Find profile by session ID
        const profiles = await storage.getAllDriverProfiles();
        const profile = profiles.find(p => p.identityVerificationSessionId === sessionId);
        
        if (profile) {
          let newStatus: string;
          switch (session.status) {
            case "verified":
              newStatus = "verified";
              break;
            case "requires_input":
            case "requires_action":
              newStatus = "requires_input";
              break;
            case "canceled":
              newStatus = "failed";
              break;
            case "processing":
            case "requires_review":
              newStatus = "pending";
              break;
            default:
              newStatus = "pending";
          }
          
          await storage.updateDriverProfileById(profile.id, {
            identityVerificationStatus: newStatus,
            ...(newStatus === "verified" ? { identityVerifiedAt: new Date() } : {}),
          });
          
          // Sync to Onfleet if verified
          if (newStatus === "verified" && profile.phone && !profile.onfleetId) {
            try {
              const syncResult = await syncDriverToOnfleet({
                firstName: profile.firstName,
                lastName: profile.lastName,
                phone: profile.phone,
                streetAddress: profile.streetAddress,
                city: profile.city,
                province: profile.province,
                postalCode: profile.postalCode,
                googlePlaceId: profile.googlePlaceId,
                vehicleMake: profile.vehicleMake,
                vehicleModel: profile.vehicleModel,
                vehicleYear: profile.vehicleYear,
                vehicleColor: profile.vehicleColor,
                licensePlate: profile.licensePlate,
              });

              if (syncResult.success && syncResult.onfleetId) {
                await storage.updateDriverProfileById(profile.id, {
                  onfleetId: syncResult.onfleetId,
                  onfleetSyncedAt: new Date(),
                });
                console.log(`Webhook: Driver ${profile.id} verified and synced to Onfleet: ${syncResult.onfleetId}`);
              }
            } catch (onfleetError) {
              console.error("Webhook: Onfleet sync error:", onfleetError);
            }
          }
          
          console.log(`Webhook: Updated driver ${profile.id} verification status to ${newStatus}`);
        }
      }
      
      res.json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(400).json({ error: "Webhook processing failed" });
    }
  });

  app.post("/api/admin/reject/:profileId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { profileId } = req.params;
      const adminUserId = req.user.claims.sub;
      
      const profile = await storage.getDriverProfileById(profileId);
      if (!profile) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      const updatedProfile = await storage.updateDriverProfileById(profileId, {
        approvalStatus: "rejected",
        approvedAt: new Date(),
        approvedBy: adminUserId,
      });
      
      console.log(`Driver ${profileId} rejected by admin ${adminUserId}`);
      res.json(updatedProfile);
    } catch (error) {
      console.error("Error rejecting driver:", error);
      res.status(500).json({ message: "Failed to reject driver" });
    }
  });

  // Driver availability endpoints
  app.get("/api/availability", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getDriverProfile(userId);
      
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      
      const { startDate, endDate } = req.query;
      const availability = await storage.getDriverAvailability(
        profile.id,
        startDate as string,
        endDate as string
      );
      
      res.json(availability);
    } catch (error) {
      console.error("Error fetching availability:", error);
      res.status(500).json({ message: "Failed to fetch availability" });
    }
  });

  const availabilityInputSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
    status: z.enum(["available", "unavailable", "pending"]),
    notes: z.string().optional().nullable(),
    thermalBlanket: z.boolean().optional(),
    thermalBag: z.boolean().optional(),
    otherPackaging: z.boolean().optional(),
  });

  app.post("/api/availability", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getDriverProfile(userId);
      
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      
      const validated = availabilityInputSchema.parse(req.body);
      
      const availability = await storage.upsertDriverAvailability(profile.id, validated.date, {
        status: validated.status,
        notes: validated.notes,
        thermalBlanket: validated.thermalBlanket,
        thermalBag: validated.thermalBag,
        otherPackaging: validated.otherPackaging,
        respondedAt: new Date(),
      });
      
      res.json(availability);
    } catch (error) {
      console.error("Error updating availability:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update availability" });
    }
  });

  // External API for admin app to read driver availability
  const driverAppApiKey = process.env.DRIVER_APP_API_KEY;

  const validateApiKey = (req: any, res: any, next: any) => {
    const apiKey = req.headers["x-api-key"];
    if (!driverAppApiKey || apiKey !== driverAppApiKey) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  app.get("/api/external/availability/:onfleetId", validateApiKey, async (req, res) => {
    try {
      const { onfleetId } = req.params;
      const { startDate, endDate } = req.query;
      
      const profile = await storage.getDriverProfileByOnfleetId(onfleetId);
      if (!profile) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      const availability = await storage.getDriverAvailability(
        profile.id,
        startDate as string,
        endDate as string
      );
      
      res.json({
        driver: {
          id: profile.id,
          name: `${profile.firstName} ${profile.lastName}`,
          phone: profile.phone,
          onfleetId: profile.onfleetId,
        },
        availability,
      });
    } catch (error) {
      console.error("Error fetching external availability:", error);
      res.status(500).json({ message: "Failed to fetch availability" });
    }
  });

  app.get("/api/external/availability-by-phone/:phone", validateApiKey, async (req, res) => {
    try {
      const { phone } = req.params;
      const { startDate, endDate } = req.query;
      
      // Try multiple phone formats for lookup
      const normalizedPhone = phone.replace(/\D/g, "");
      const formattedPhone = normalizedPhone.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
      
      let profile = await storage.getDriverProfileByPhone(phone);
      if (!profile) {
        profile = await storage.getDriverProfileByPhone(normalizedPhone);
      }
      if (!profile) {
        profile = await storage.getDriverProfileByPhone(formattedPhone);
      }
      
      if (!profile) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      const availability = await storage.getDriverAvailability(
        profile.id,
        startDate as string,
        endDate as string
      );
      
      res.json({
        driver: {
          id: profile.id,
          name: `${profile.firstName} ${profile.lastName}`,
          phone: profile.phone,
          onfleetId: profile.onfleetId,
        },
        availability,
      });
    } catch (error) {
      console.error("Error fetching external availability by phone:", error);
      res.status(500).json({ message: "Failed to fetch availability" });
    }
  });

  // Availability response proxy routes
  const availabilityApiUrl = process.env.AVAILABILITY_API_URL;

  app.get("/api/availability-response/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      if (!availabilityApiUrl) {
        return res.status(500).json({ message: "Availability API not configured" });
      }

      const response = await fetch(`${availabilityApiUrl}/api/availability-response/${token}`);
      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      
      res.json(data);
    } catch (error) {
      console.error("Error fetching availability token:", error);
      res.status(500).json({ message: "Failed to fetch availability request" });
    }
  });

  app.post("/api/availability-response/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      if (!availabilityApiUrl) {
        return res.status(500).json({ message: "Availability API not configured" });
      }

      const response = await fetch(`${availabilityApiUrl}/api/availability-response/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      
      res.json(data);
    } catch (error) {
      console.error("Error submitting availability response:", error);
      res.status(500).json({ message: "Failed to submit availability response" });
    }
  });

  return httpServer;
}

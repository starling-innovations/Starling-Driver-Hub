import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { updateDriverProfileSchema } from "@shared/schema";
import { z } from "zod";
import { syncDriverToOnfleet } from "./onfleet";

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

      if (updateData.onboardingCompleted && !updatedProfile.onfleetId) {
        try {
          const syncResult = await syncDriverToOnfleet({
            firstName: updatedProfile.firstName,
            lastName: updatedProfile.lastName,
            phone: updatedProfile.phone!,
            streetAddress: updatedProfile.streetAddress,
            city: updatedProfile.city,
            province: updatedProfile.province,
            postalCode: updatedProfile.postalCode,
            googlePlaceId: updatedProfile.googlePlaceId,
            vehicleMake: updatedProfile.vehicleMake,
            vehicleModel: updatedProfile.vehicleModel,
            vehicleYear: updatedProfile.vehicleYear,
            vehicleColor: updatedProfile.vehicleColor,
            licensePlate: updatedProfile.licensePlate,
          });

          if (syncResult.success && syncResult.onfleetId) {
            updatedProfile = await storage.updateDriverProfile(userId, {
              onfleetId: syncResult.onfleetId,
              onfleetSyncedAt: new Date(),
            });
            console.log(
              `Driver ${userId} synced to Onfleet: ${syncResult.onfleetId} (${
                syncResult.isExisting ? "existing" : "new"
              } worker)`
            );
          } else {
            console.error(`Failed to sync driver ${userId} to Onfleet:`, syncResult.error);
          }
        } catch (onfleetError) {
          console.error("Onfleet sync error:", onfleetError);
        }
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

  return httpServer;
}

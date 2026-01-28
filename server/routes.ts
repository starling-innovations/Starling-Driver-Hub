import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { updateDriverProfileSchema } from "@shared/schema";
import { z } from "zod";

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
      const validated = updateDriverProfileSchema.parse(updateData);
      const updatedProfile = await storage.updateDriverProfile(userId, validated);
      
      if (!updatedProfile) {
        return res.status(404).json({ message: "Profile not found" });
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

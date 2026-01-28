import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export * from "./models/auth";

export const driverProfiles = pgTable("driver_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  streetAddress: text("street_address"),
  city: text("city"),
  province: text("province"),
  postalCode: text("postal_code"),
  googlePlaceId: text("google_place_id"),
  etransferEmail: text("etransfer_email").notNull(),
  etransferAutoDepositConfirmed: boolean("etransfer_auto_deposit_confirmed").default(false),
  vehicleMake: text("vehicle_make"),
  vehicleModel: text("vehicle_model"),
  vehicleYear: text("vehicle_year"),
  vehicleColor: text("vehicle_color"),
  licensePlate: text("license_plate"),
  vehiclePhotoUrl: text("vehicle_photo_url"),
  licensePlatePhotoUrl: text("license_plate_photo_url"),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  onboardingStep: integer("onboarding_step").default(1),
  agreementSigned: boolean("agreement_signed").default(false),
  agreementSignedAt: timestamp("agreement_signed_at"),
  onfleetId: text("onfleet_id"),
  onfleetSyncedAt: timestamp("onfleet_synced_at"),
  approvalStatus: varchar("approval_status"), // pending, approved, rejected (null until onboarding completes)
  approvedAt: timestamp("approved_at"),
  approvedBy: text("approved_by"),
  identityVerificationStatus: varchar("identity_verification_status"), // pending, verified, failed, requires_input (null until admin approves)
  identityVerificationSessionId: text("identity_verification_session_id"),
  identityVerifiedAt: timestamp("identity_verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const driverProfilesRelations = relations(driverProfiles, ({ many }) => ({
  availability: many(driverAvailability),
}));

export const driverAvailability = pgTable("driver_availability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverProfileId: varchar("driver_profile_id").notNull().references(() => driverProfiles.id),
  date: varchar("date").notNull(), // YYYY-MM-DD format
  status: varchar("status").notNull(), // "available", "unavailable", "pending"
  notes: text("notes"),
  thermalBlanket: boolean("thermal_blanket").default(false),
  thermalBag: boolean("thermal_bag").default(false),
  otherPackaging: boolean("other_packaging").default(false),
  responseToken: varchar("response_token"), // Link to external availability request
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const driverAvailabilityRelations = relations(driverAvailability, ({ one }) => ({
  driverProfile: one(driverProfiles, {
    fields: [driverAvailability.driverProfileId],
    references: [driverProfiles.id],
  }),
}));

export const insertDriverProfileSchema = createInsertSchema(driverProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateDriverProfileSchema = createInsertSchema(driverProfiles).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type InsertDriverProfile = z.infer<typeof insertDriverProfileSchema>;
export type UpdateDriverProfile = z.infer<typeof updateDriverProfileSchema>;
export type DriverProfile = typeof driverProfiles.$inferSelect;

export const insertDriverAvailabilitySchema = createInsertSchema(driverAvailability).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateDriverAvailabilitySchema = createInsertSchema(driverAvailability).omit({
  id: true,
  driverProfileId: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type InsertDriverAvailability = z.infer<typeof insertDriverAvailabilitySchema>;
export type UpdateDriverAvailability = z.infer<typeof updateDriverAvailabilitySchema>;
export type DriverAvailability = typeof driverAvailability.$inferSelect;

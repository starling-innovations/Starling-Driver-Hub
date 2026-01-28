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
  etransferEmail: text("etransfer_email").notNull(),
  vehicleMake: text("vehicle_make"),
  vehicleModel: text("vehicle_model"),
  vehicleYear: text("vehicle_year"),
  vehicleColor: text("vehicle_color"),
  licensePlate: text("license_plate"),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  onboardingStep: integer("onboarding_step").default(1),
  agreementSigned: boolean("agreement_signed").default(false),
  agreementSignedAt: timestamp("agreement_signed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const driverProfilesRelations = relations(driverProfiles, ({ one }) => ({
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

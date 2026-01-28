import { 
  driverProfiles, 
  type DriverProfile, 
  type InsertDriverProfile, 
  type UpdateDriverProfile 
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getDriverProfile(userId: string): Promise<DriverProfile | undefined>;
  createDriverProfile(profile: InsertDriverProfile): Promise<DriverProfile>;
  updateDriverProfile(userId: string, data: UpdateDriverProfile): Promise<DriverProfile | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getDriverProfile(userId: string): Promise<DriverProfile | undefined> {
    const [profile] = await db
      .select()
      .from(driverProfiles)
      .where(eq(driverProfiles.userId, userId));
    return profile || undefined;
  }

  async createDriverProfile(profile: InsertDriverProfile): Promise<DriverProfile> {
    const [newProfile] = await db
      .insert(driverProfiles)
      .values(profile)
      .returning();
    return newProfile;
  }

  async updateDriverProfile(userId: string, data: UpdateDriverProfile): Promise<DriverProfile | undefined> {
    const [updated] = await db
      .update(driverProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(driverProfiles.userId, userId))
      .returning();
    return updated || undefined;
  }
}

export const storage = new DatabaseStorage();

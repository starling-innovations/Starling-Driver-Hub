import { 
  driverProfiles, 
  driverAvailability,
  users,
  type DriverProfile, 
  type InsertDriverProfile, 
  type UpdateDriverProfile,
  type DriverAvailability,
  type InsertDriverAvailability,
  type UpdateDriverAvailability,
  type User
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte } from "drizzle-orm";

export interface UserWithProfile {
  user: User;
  profile: DriverProfile | null;
}

export interface IStorage {
  getDriverProfile(userId: string): Promise<DriverProfile | undefined>;
  getDriverProfileById(profileId: string): Promise<DriverProfile | undefined>;
  getDriverProfileByPhone(phone: string): Promise<DriverProfile | undefined>;
  getDriverProfileByOnfleetId(onfleetId: string): Promise<DriverProfile | undefined>;
  createDriverProfile(profile: InsertDriverProfile): Promise<DriverProfile>;
  updateDriverProfile(userId: string, data: UpdateDriverProfile): Promise<DriverProfile | undefined>;
  getAllUsersWithProfiles(): Promise<UserWithProfile[]>;
  updateUserLastLogin(userId: string): Promise<void>;
  
  // Availability methods
  getDriverAvailability(profileId: string, startDate?: string, endDate?: string): Promise<DriverAvailability[]>;
  getDriverAvailabilityByDate(profileId: string, date: string): Promise<DriverAvailability | undefined>;
  createDriverAvailability(data: InsertDriverAvailability): Promise<DriverAvailability>;
  updateDriverAvailability(id: string, data: UpdateDriverAvailability): Promise<DriverAvailability | undefined>;
  upsertDriverAvailability(profileId: string, date: string, data: Partial<InsertDriverAvailability>): Promise<DriverAvailability>;
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

  async getAllUsersWithProfiles(): Promise<UserWithProfile[]> {
    const allUsers = await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));

    const results: UserWithProfile[] = [];
    for (const user of allUsers) {
      const [profile] = await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.userId, user.id));
      results.push({ user, profile: profile || null });
    }
    return results;
  }

  async updateUserLastLogin(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async getDriverProfileById(profileId: string): Promise<DriverProfile | undefined> {
    const [profile] = await db
      .select()
      .from(driverProfiles)
      .where(eq(driverProfiles.id, profileId));
    return profile || undefined;
  }

  async getDriverProfileByPhone(phone: string): Promise<DriverProfile | undefined> {
    const [profile] = await db
      .select()
      .from(driverProfiles)
      .where(eq(driverProfiles.phone, phone));
    return profile || undefined;
  }

  async getDriverProfileByOnfleetId(onfleetId: string): Promise<DriverProfile | undefined> {
    const [profile] = await db
      .select()
      .from(driverProfiles)
      .where(eq(driverProfiles.onfleetId, onfleetId));
    return profile || undefined;
  }

  async getDriverAvailability(profileId: string, startDate?: string, endDate?: string): Promise<DriverAvailability[]> {
    let query = db
      .select()
      .from(driverAvailability)
      .where(eq(driverAvailability.driverProfileId, profileId));
    
    if (startDate && endDate) {
      query = db
        .select()
        .from(driverAvailability)
        .where(and(
          eq(driverAvailability.driverProfileId, profileId),
          gte(driverAvailability.date, startDate),
          lte(driverAvailability.date, endDate)
        ));
    }
    
    return query;
  }

  async getDriverAvailabilityByDate(profileId: string, date: string): Promise<DriverAvailability | undefined> {
    const [availability] = await db
      .select()
      .from(driverAvailability)
      .where(and(
        eq(driverAvailability.driverProfileId, profileId),
        eq(driverAvailability.date, date)
      ));
    return availability || undefined;
  }

  async createDriverAvailability(data: InsertDriverAvailability): Promise<DriverAvailability> {
    const [availability] = await db
      .insert(driverAvailability)
      .values(data)
      .returning();
    return availability;
  }

  async updateDriverAvailability(id: string, data: UpdateDriverAvailability): Promise<DriverAvailability | undefined> {
    const [updated] = await db
      .update(driverAvailability)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(driverAvailability.id, id))
      .returning();
    return updated || undefined;
  }

  async upsertDriverAvailability(profileId: string, date: string, data: Partial<InsertDriverAvailability>): Promise<DriverAvailability> {
    const existing = await this.getDriverAvailabilityByDate(profileId, date);
    
    if (existing) {
      const [updated] = await db
        .update(driverAvailability)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(driverAvailability.id, existing.id))
        .returning();
      return updated;
    }
    
    const [created] = await db
      .insert(driverAvailability)
      .values({
        driverProfileId: profileId,
        date,
        status: data.status || "available",
        ...data,
      })
      .returning();
    return created;
  }
}

export const storage = new DatabaseStorage();

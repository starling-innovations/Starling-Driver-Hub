import { 
  driverProfiles, 
  users,
  type DriverProfile, 
  type InsertDriverProfile, 
  type UpdateDriverProfile,
  type User
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface UserWithProfile {
  user: User;
  profile: DriverProfile | null;
}

export interface IStorage {
  getDriverProfile(userId: string): Promise<DriverProfile | undefined>;
  createDriverProfile(profile: InsertDriverProfile): Promise<DriverProfile>;
  updateDriverProfile(userId: string, data: UpdateDriverProfile): Promise<DriverProfile | undefined>;
  getAllUsersWithProfiles(): Promise<UserWithProfile[]>;
  updateUserLastLogin(userId: string): Promise<void>;
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
}

export const storage = new DatabaseStorage();

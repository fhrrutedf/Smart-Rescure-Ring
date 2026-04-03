import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { users, detections, type User, type InsertUser, type Detection, type InsertDetection } from "@shared/schema";

const { Pool } = pg;

// Create database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/smartrescuer",
});

const db = drizzle(pool);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  saveDetection(detection: InsertDetection): Promise<Detection>;
  getLatestDetections(limit?: number): Promise<Detection[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async saveDetection(detection: InsertDetection): Promise<Detection> {
    const result = await db.insert(detections).values(detection).returning();
    return result[0];
  }

  async getLatestDetections(limit: number = 50): Promise<Detection[]> {
    return await db
      .select()
      .from(detections)
      .orderBy(desc(detections.timestamp))
      .limit(limit);
  }
}

// Fallback to memory storage if no DATABASE_URL
export class MemStorage implements IStorage {
  private usersData: Map<string, User> = new Map();
  private detectionsData: Detection[] = [];
  private idCounter = 1;

  async getUser(id: string): Promise<User | undefined> {
    return this.usersData.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.usersData.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = String(this.idCounter++);
    const user: User = { ...insertUser, id };
    this.usersData.set(id, user);
    return user;
  }

  async saveDetection(detection: InsertDetection): Promise<Detection> {
    const id = String(this.idCounter++);
    const newDetection: Detection = {
      ...detection,
      id,
      timestamp: new Date().toISOString() as any,
    };
    this.detectionsData.unshift(newDetection);
    if (this.detectionsData.length > 50) this.detectionsData.pop();
    return newDetection;
  }

  async getLatestDetections(limit: number = 50): Promise<Detection[]> {
    return this.detectionsData.slice(0, limit);
  }
}

// Use DatabaseStorage if DATABASE_URL is set, otherwise MemStorage
export const storage: IStorage = process.env.DATABASE_URL 
  ? new DatabaseStorage() 
  : new MemStorage();

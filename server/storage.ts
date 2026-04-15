import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { users, detections, type User, type InsertUser, type Detection, type InsertDetection } from "../shared/schema";
import crypto from "crypto";

const { Pool } = pg;

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  saveDetection(detection: InsertDetection): Promise<Detection>;
  getLatestDetections(limit?: number): Promise<Detection[]>;
  saveLog(log: any): Promise<void>;
}

/**
 * Supabase/PostgreSQL Storage (Production)
 */
export class DatabaseStorage implements IStorage {
  private db;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL must be set to use DatabaseStorage");
    }
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    this.db = drizzle(pool);
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await this.db.insert(users).values(insertUser).returning();
    return user;
  }

  async saveDetection(insertDetection: InsertDetection): Promise<Detection> {
    const [detection] = await this.db.insert(detections).values({
      detections: insertDetection.detections,
      imagePreview: insertDetection.imagePreview ?? null,
    }).returning();
    return detection;
  }

  async getLatestDetections(limit: number = 50): Promise<Detection[]> {
    return await this.db.select().from(detections).orderBy(desc(detections.timestamp)).limit(limit);
  }

  async saveLog(log: any): Promise<void> {
    // Optional: Log to database if needed
    console.log("[Audit Log]:", log);
  }
}

/**
 * In-Memory Storage (Fallback/Development)
 */
export class MemStorage implements IStorage {
  private usersData: Map<string, User> = new Map();
  private detectionsData: Detection[] = [];
  private logs: any[] = [];
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
    const id = crypto.randomUUID();
    const user: User = { 
      id,
      username: insertUser.username,
      password: insertUser.password 
    };
    this.usersData.set(id, user);
    return user;
  }

  async saveDetection(insertDetection: InsertDetection): Promise<Detection> {
    const id = crypto.randomUUID();
    const newDetection: Detection = {
      id,
      detections: insertDetection.detections,
      imagePreview: insertDetection.imagePreview ?? null,
      timestamp: new Date(),
    };
    this.detectionsData.unshift(newDetection);
    if (this.detectionsData.length > 100) this.detectionsData.pop();
    return newDetection;
  }

  async getLatestDetections(limit: number = 50): Promise<Detection[]> {
    return this.detectionsData.slice(0, limit);
  }

  async saveLog(log: any): Promise<void> {
    this.logs.push({ ...log, timestamp: new Date() });
    if (this.logs.length > 100) this.logs.shift();
  }
}

// Export DatabaseStorage if DATABASE_URL is available, otherwise use MemStorage
export const storage: IStorage = process.env.DATABASE_URL 
  ? new DatabaseStorage() 
  : new MemStorage();

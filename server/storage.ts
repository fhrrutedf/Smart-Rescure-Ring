import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { users, detections, type User, type InsertUser, type Detection, type InsertDetection } from "@shared/schema";

const { Pool } = pg;

// Use MemStorage by default to avoid postgres connection issues during live demo
export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  saveDetection(detection: InsertDetection): Promise<Detection>;
  getLatestDetections(limit?: number): Promise<Detection[]>;
  saveLog(log: any): Promise<void>;
}

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

export const storage: IStorage = new MemStorage();

import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  saveDetection(detection: any): Promise<void>;
  getLatestDetections(): Promise<any[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private detections: any[] = [];

  constructor() {
    this.users = new Map();
  }

  async saveDetection(detection: any): Promise<void> {
    this.detections.unshift({ ...detection, timestamp: new Date().toISOString() });
    if (this.detections.length > 50) this.detections.pop();
  }

  async getLatestDetections(): Promise<any[]> {
    return this.detections;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
}

export const storage = new MemStorage();

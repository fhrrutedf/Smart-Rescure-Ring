import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, json } from "drizzle-orm/pg-core";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const detections = pgTable("detections", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  detections: json("detections").notNull(),
  imagePreview: text("image_preview"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Using manual Zod schemas to avoid Drizzle-Zod inference issues with newer TS versions
export const insertUserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});

export const insertDetectionSchema = z.object({
  detections: z.any(),
  imagePreview: z.string().optional().nullable(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertDetection = z.infer<typeof insertDetectionSchema>;
export type Detection = typeof detections.$inferSelect;

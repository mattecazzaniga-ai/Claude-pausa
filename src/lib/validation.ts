import { z } from "zod";

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores allowed"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

export const customizeSquareSchema = z.object({
  title: z.string().trim().max(60).optional().nullable(),
  description: z.string().trim().max(280).optional().nullable(),
  imageUrl: z.union([z.string().trim().url().max(2048), z.literal("")]).optional().nullable(),
  externalUrl: z.union([z.string().trim().url().max(2048), z.literal("")]).optional().nullable(),
  backgroundColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #6366f1")
    .optional()
    .nullable(),
});

export const createListingSchema = z.object({
  price: z.number().positive().max(100000),
});

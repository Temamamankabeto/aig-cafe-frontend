import { z } from "zod";
import type {
  CreateUserPayload,
  UpdateUserPayload,
  ResetUserPasswordPayload,
  AssignUserRolePayload,
} from "@/types/user-management/user.type";

export const userStatusSchema = z.enum(["active", "disabled"]);

/**
 * CREATE USER
 */
export const createUserSchema = z.object({
  name: z.string().min(2, "Name is required").max(100),
  email: z.string().email("Valid email is required").max(100),
  phone: z.string().min(3, "Phone is required").max(20),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(255)
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number")
    .regex(/[^A-Za-z0-9]/, "Password must contain a symbol"),
  role: z.string().min(1, "Role is required"),
  department_id: z.union([z.number().int().positive(), z.string().min(1, "Department is required")]),
}).strict() as z.ZodType<CreateUserPayload, z.ZodTypeDef, CreateUserPayload>;

/**
 * UPDATE USER
 */
export const updateUserSchema = z.object({
  name: z.string().min(2, "Name is required").max(100),
  email: z.string().email("Valid email is required").max(100),
  phone: z.string().min(3, "Phone is required").max(20),
  role: z.string().min(1, "Role is required"),
  department_id: z.union([z.number().int().positive(), z.string().min(1, "Department is required")]),
}).strict() as z.ZodType<UpdateUserPayload, z.ZodTypeDef, UpdateUserPayload>;

/**
 * RESET PASSWORD
 */
export const resetUserPasswordSchema = z.object({
  new_password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(255)
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number")
    .regex(/[^A-Za-z0-9]/, "Password must contain a symbol"),
}).strict() as z.ZodType<ResetUserPasswordPayload, z.ZodTypeDef, ResetUserPasswordPayload>;

/**
 * ASSIGN ROLE
 */
export const assignUserRoleSchema = z.object({
  role: z.string().min(1, "Role is required"),
}).strict() as z.ZodType<AssignUserRolePayload, z.ZodTypeDef, AssignUserRolePayload>;

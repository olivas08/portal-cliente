import { z } from "zod";

/** Non-empty identifier (cuid / uuid / opaque id) used by thin actions. */
export const idSchema = z.string().trim().min(1, "Identificador obrigatório.");

export const booleanSchema = z.boolean();

export const quoteDecisionSchema = z.enum(["accepted", "rejected"]);

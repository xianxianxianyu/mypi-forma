import { z } from 'zod';

const short = z.string().min(1).max(100);
const id = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);
export const metricSchema = z.object({
  id, label: short, value: short, change: short,
  caption: z.string().max(160), tone: z.enum(['lime', 'lavender', 'peach']),
});
export const chartSchema = z.object({
  id, title: short, subtitle: z.string().max(160),
  values: z.array(z.number().min(0).max(1_000_000)).min(3).max(12),
  labels: z.array(z.string().max(20)).min(3).max(12),
});
export const planSchema = z.object({
  id, title: short, price: short, description: z.string().max(160),
  features: z.array(short).min(1).max(5), buttonLabel: short,
});
export const preferencesSchema = z.object({
  id, title: short, description: z.string().max(160),
  options: z.array(short).min(1).max(4),
});
export const componentSchemas = {
  MetricCard: metricSchema, ActivityChart: chartSchema,
  PlanCard: planSchema, PreferenceCard: preferencesSchema,
};
export const chatTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().trim().min(1).max(2000),
}).strict();
export type ChatTurn = z.infer<typeof chatTurnSchema>;
export const requestSchema = z.object({
  backend: z.enum(['codex', 'pi']).optional(),
  prompt: z.string().trim().min(1).max(2000),
  currentProgram: z.string().max(18000).default(''),
  history: z.array(chatTurnSchema).max(16).default([]),
}).strict();
export type GenerateRequest = z.infer<typeof requestSchema>;

import { z } from 'zod'

export const MetricsHistoryQuerySchema = z.object({
  days: z.string().default('30').transform(Number),
})

export const DbSizeResponseSchema = z.object({
  totalSize: z.string(),
  totalSizeBytes: z.number(),
})

export const MetricsHistoryResponseSchema = z.object({
  history: z.array(
    z.object({
      time: z.string().or(z.date()),
      codeSizeKb: z.number().nullable(),
      dbSizeBytes: z.string().or(z.number()),
    })
  ),
  count: z.number(),
  periodDays: z.number(),
})

import {z} from 'zod';

export const ImpactCardSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const SegmentSchema = z.object({
  headline: z.string(),
  narration: z.string(),
  impact_cards: z.array(ImpactCardSchema).optional(),
  key_points: z.array(z.string()),
  background_image: z.string().optional(),
  source_article_id: z.string().optional(),
  display_seconds: z.number(),
  categories: z.array(z.string()).optional(),
});

export const BriefingSchema = z.object({
  audience: z.enum(['executive', 'soc', 'engineer']),
  date: z.string(),
  title: z.string(),
  intro: z.object({
    text: z.string(),
  }),
  segments: z.array(SegmentSchema),
  closing: z.object({
    text: z.string(),
  }),
  bgm_url: z.string().optional(),
});

export type BriefingProps = z.infer<typeof BriefingSchema>;
export type SegmentProps = z.infer<typeof SegmentSchema>;
export type ImpactCard = z.infer<typeof ImpactCardSchema>;

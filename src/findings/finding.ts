import { z } from "zod"

export const FINDING_ID_PATTERN = /^VIGIA-\d{3,}$/

const anchor = z.object({
  file: z.string().min(1),
  line: z.number().int().positive(),
  symbol: z.string().optional(),
})

const score = z.object({
  reachability: z.number().int().min(0).max(3),
  exposure: z.number().int().min(0).max(3),
  certainty: z.number().int().min(0).max(2),
  impact: z.number().int().min(0).max(2),
  rationale: z.string().min(1),
})

const poc = z.object({
  path: z.string().optional(),
  command: z.string().min(1),
  observed: z.string().min(1),
})

const fix = z.object({
  summary: z.string().min(1),
  patch: z.string().optional(),
  regressionTest: z.string().optional(),
})

export const findingInput = z
  .object({
    id: z.string().regex(FINDING_ID_PATTERN).optional(),
    title: z.string().min(1),
    status: z.enum(["hypothesis", "reproduced", "confirmed", "rejected"]),
    severity: z.enum(["critical", "high", "medium", "low", "info"]),
    cwe: z.string().regex(/^CWE-\d+$/),
    cvss: z.string().regex(/^CVSS:(3\.1|4\.0)\//).optional(),
    anchors: z.array(anchor).min(1),
    description: z.string().min(1),
    preconditions: z.string().optional(),
    score: score.optional(),
    poc: poc.optional(),
    fix: fix.optional(),
    rejectedReason: z.string().optional(),
  })
  .superRefine((finding, context) => {
    if ((finding.status === "reproduced" || finding.status === "confirmed") && !finding.poc) {
      context.addIssue({
        code: "custom",
        path: ["poc"],
        message: `A ${finding.status} finding needs a PoC with the command you ran and the output you observed.`,
      })
    }
    if (finding.status === "rejected" && !finding.rejectedReason) {
      context.addIssue({
        code: "custom",
        path: ["rejectedReason"],
        message: "A rejected finding needs a rejectedReason.",
      })
    }
  })

export type FindingInput = z.infer<typeof findingInput>
export type Finding = FindingInput & { id: string; priority?: Priority; updatedAt: string }
export type Priority = "P0" | "P1" | "P2" | "P3"

export function totalScore(value: NonNullable<FindingInput["score"]>): number {
  return value.reachability + value.exposure + value.certainty + value.impact
}

const PRIORITIES: Priority[] = ["P0", "P1", "P2", "P3"]

/** Impact caps the priority, so a bug that is easy to reach but has low impact cannot become P0. */
const HIGHEST_PRIORITY_FOR_IMPACT: Record<number, Priority> = { 2: "P0", 1: "P1", 0: "P2" }

export function priorityOf(value: FindingInput["score"]): Priority | undefined {
  if (!value) return undefined
  const total = totalScore(value)
  const byTotal: Priority = total >= 9 ? "P0" : total >= 7 ? "P1" : total >= 5 ? "P2" : "P3"
  const cap = HIGHEST_PRIORITY_FOR_IMPACT[value.impact]!
  return PRIORITIES[Math.max(PRIORITIES.indexOf(byTotal), PRIORITIES.indexOf(cap))]
}

import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * StatusPill — the single source of truth for operational state badges:
 * risk level, severity, and workflow status. Pass an explicit `tone`, or let
 * the component infer one from the label text. Colours come from the semantic
 * pill-* utilities in globals.css, so they read correctly in light and dark.
 */

export type PillTone = "ok" | "info" | "warning" | "critical" | "accent" | "neutral"

const TONE_CLASS: Record<PillTone, string> = {
  ok: "pill-ok",
  info: "pill-info",
  warning: "pill-warning",
  critical: "pill-critical",
  accent: "pill-accent",
  neutral: "pill-neutral",
}

/** Infer a tone from a free-text risk / severity / status label. */
export function inferTone(label: string | null | undefined): PillTone {
  const s = (label ?? "").toLowerCase().trim()
  if (!s) return "neutral"
  // critical / high risk / blocked / overdue
  if (/(critical|extreme|severe|very high|emergency|blocked|fail|overdue|breach|expired)/.test(s)) return "critical"
  // warning / medium / in progress / pending
  if (/(high|major|medium|moderate|minor|warning|watch|pending|in progress|review|due soon|draft|on hold)/.test(s)) return "warning"
  // ok / complete / low / approved
  if (/(complete|done|approved|signed|closed|resolved|valid|current|in date|up to date|low|negligible|pass|ok|active|live|published)/.test(s)) return "ok"
  return "neutral"
}

export function StatusPill({
  label,
  tone,
  icon: Icon,
  className,
  dot = false,
}: {
  label: string
  tone?: PillTone
  icon?: React.ElementType
  className?: string
  /** Show a leading status dot instead of an icon. */
  dot?: boolean
}) {
  const resolved = tone ?? inferTone(label)
  return (
    <span className={cn("pill-base", TONE_CLASS[resolved], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current opacity-80" />}
      {Icon && <Icon className="size-3" />}
      {label}
    </span>
  )
}

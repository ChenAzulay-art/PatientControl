/**
 * Calendar colors for treatment types. Each has a soft background and a
 * strong border/text color, chosen to stay readable (4.5:1 text contrast)
 * on the light calendar.
 */
export const treatmentColors = {
  teal: { background: "#ccfbf1", border: "#0f766e", text: "#134e4a" },
  blue: { background: "#dbeafe", border: "#1d4ed8", text: "#1e3a8a" },
  violet: { background: "#ede9fe", border: "#6d28d9", text: "#4c1d95" },
  rose: { background: "#ffe4e6", border: "#be123c", text: "#881337" },
  amber: { background: "#fef3c7", border: "#b45309", text: "#78350f" },
  green: { background: "#dcfce7", border: "#15803d", text: "#14532d" },
  orange: { background: "#ffedd5", border: "#c2410c", text: "#7c2d12" },
  slate: { background: "#e2e8f0", border: "#475569", text: "#1e293b" },
} as const;

export type TreatmentColor = keyof typeof treatmentColors;

export const treatmentColorNames = Object.keys(
  treatmentColors,
) as TreatmentColor[];

export function isTreatmentColor(value: unknown): value is TreatmentColor {
  return typeof value === "string" && value in treatmentColors;
}

/** Appointments without a treatment type use slate. */
export function colorOf(value: string | null | undefined) {
  return treatmentColors[isTreatmentColor(value) ? value : "slate"];
}

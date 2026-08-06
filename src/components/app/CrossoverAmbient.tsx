/**
 * Today's default, quiet state — a one-line subtitle reading the live plan's
 * mid-crossover year (planBand.ts), never a frozen checkpoint. Recomputed
 * fresh on every visit, so it moves the moment the live plan does.
 */
export function CrossoverAmbient({ crossoverYear }: { crossoverYear: number | null }) {
  return (
    <p className="text-[13px] text-muted-foreground">
      {crossoverYear
        ? `On your plan as it stands, growth overtakes what you put in from ${crossoverYear}.`
        : 'Add a bit more detail to your plan to see when growth starts doing the heavy lifting.'}
    </p>
  )
}

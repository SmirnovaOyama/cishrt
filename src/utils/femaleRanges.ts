/**
 * The estradiol bands the cis edition reads its estimate against, in pg/mL,
 * in place of the feminizing HRT target of 100–200: Mayo Clinic
 * Laboratories' adult female reference values, under 10 after menopause and
 * 15–350 before it (EEST, LC-MS/MS; no split by cycle phase).
 *
 * Menopause HRT has no target level. The British Menopause Society's 2025
 * tool for clinicians finds that no estradiol level marks the right dose, for
 * symptoms or for bone, so the band the chart shades is the premenopausal
 * range, there to compare with, not a level to aim for.
 */
export const POSTMENOPAUSAL_E2_MAX = 10;
export const PREMENOPAUSAL_E2 = { low: 15, high: 350 } as const;

/** The Overview's status line for an estimate, as useAppData's currentStatus shapes it. */
export function cisLevelStatus(conc: number) {
    const chip = { bg: 'bg-[var(--surface-muted)]', border: 'border-[var(--border)]' };
    if (conc > PREMENOPAUSAL_E2.high)
        return { label: 'status.level.cis_high', color: 'text-[var(--warning)]', ...chip };
    if (conc >= PREMENOPAUSAL_E2.low)
        return { label: 'status.level.cis_premenopausal', color: 'text-[var(--status-positive)]', ...chip };
    if (conc > POSTMENOPAUSAL_E2_MAX)
        return { label: 'status.level.cis_between', color: 'text-[var(--status-info)]', ...chip };
    return { label: 'status.level.cis_postmenopausal', color: 'text-[var(--status-neutral)]', ...chip };
}

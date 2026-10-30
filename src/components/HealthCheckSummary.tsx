import React from 'react';
import { fill } from '../utils/regimenText';
import {
    ANALYTES,
    Analyte,
    HealthCheck,
    HealthUnit,
    MENOPAUSAL_FSH_IU_L,
    RefRange,
    UNIT_LABEL,
    hasMenopausalFsh,
    inBaseUnit,
    refRange,
    standingOf,
} from '../utils/healthCheck';

// Up to three significant figures, no trailing zeros.
const fmt = (v: number) => {
    const s = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v.toFixed(3);
    return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
};

/** "Reference 2.9–14.6 IU/L", with the bounds in the unit the reading is in. */
export function rangeText(analyte: Analyte, range: RefRange, unit: HealthUnit, t: (k: string) => string): string {
    const perUnit = inBaseUnit(analyte, { value: 1, unit }) ?? 1;
    const at = (v: number) => fmt(v / perUnit);
    const span =
        range.low !== undefined && range.high !== undefined
            ? `${at(range.low)}–${at(range.high)}`
            : range.high !== undefined
              ? `≤ ${at(range.high)}`
              : `≥ ${at(range.low!)}`;
    return fill(t('hc.range'), { range: `${span} ${UNIT_LABEL[unit]}` });
}

const STANDING_TONE = {
    below: 'text-[var(--status-info)]',
    within: 'text-[var(--status-positive)]',
    above: 'text-[var(--warning)]',
} as const;

/**
 * A saved check's results, each against its range for the phase it was drawn
 * in, and under them what the panel says as a whole: only what a threshold in
 * the guidelines says, nothing that would need a doctor to read.
 */
const HealthCheckSummary: React.FC<{ check: HealthCheck; t: (k: string) => string }> = ({ check, t }) => {
    const rows = ANALYTES.filter(a => check.values[a]);
    const fsh = check.values.fsh ? inBaseUnit('fsh', check.values.fsh) : null;
    return (
        <div>
            {rows.map(a => {
                const v = check.values[a]!;
                const base = inBaseUnit(a, v);
                const range = refRange(a, check.phase);
                const standing = range && base !== null ? standingOf(base, range) : null;
                return (
                    <div
                        key={a}
                        className="flex items-baseline justify-between gap-3 py-2 border-b-(length:--hairline) border-[var(--border)] last:border-b-0"
                    >
                        <span className="min-w-0">
                            <span className="block text-sm text-[var(--text)]">{t(`hc.analyte.${a}`)}</span>
                            <span className="block text-xs text-[var(--text-muted)] tabular-nums mt-0.5">
                                {range ? rangeText(a, range, v.unit, t) : t('hc.range_needs_phase')}
                            </span>
                        </span>
                        <span className="shrink-0 text-end">
                            <span className="block text-sm font-medium text-[var(--text)] tabular-nums">
                                {v.value} {UNIT_LABEL[v.unit]}
                            </span>
                            {standing && (
                                <span className={`block text-xs mt-0.5 ${STANDING_TONE[standing]}`}>
                                    {t(`hc.standing.${standing}`)}
                                </span>
                            )}
                        </span>
                    </div>
                );
            })}
            {hasMenopausalFsh(check) && fsh !== null && (
                <p className="text-xs leading-relaxed text-[var(--text-muted)] pt-3">
                    {fill(t('hc.note.fsh_menopausal'), { fsh: fmt(fsh), limit: MENOPAUSAL_FSH_IU_L })}
                </p>
            )}
        </div>
    );
};

export default HealthCheckSummary;

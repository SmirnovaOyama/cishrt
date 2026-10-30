import { DoseEvent, isEstradiolEster } from '../../logic';

/**
 * A health check: one blood draw's sex hormone panel, the six a women's
 * check-up measures (in China, 性激素六项): estradiol, FSH, LH, progesterone,
 * prolactin and testosterone.
 *
 * The cis edition starts from it. The model behind the curve only knows the
 * doses; a cis woman also makes estradiol of her own, and after menopause
 * that is a steady few pg/mL that every level on HRT sits on. A check drawn
 * before HRT measures it, so the app adds it under the doses' curve (see
 * ownEstradiol and endogenousE2 in logic.ts) instead of assuming it is zero.
 * Before menopause it rises and falls through the cycle, and one draw is not
 * a level to add all month, so then it is shown but not added.
 *
 * Reference intervals are Mayo Clinic Laboratories' adult female ones, the
 * prolactin interval Roche's (the assay most clinics run). A lab's own range,
 * printed beside the result, is the one that applies to it: these are for
 * comparison only.
 */

export const ANALYTES = ['e2', 'fsh', 'lh', 'p4', 'prl', 't'] as const;
export type Analyte = (typeof ANALYTES)[number];

/** Where in the cycle the blood was drawn, or after menopause. */
export const PHASES = ['follicular', 'midcycle', 'luteal', 'postmenopausal', 'unknown'] as const;
export type Phase = (typeof PHASES)[number];

export type HealthUnit = 'pg/ml' | 'pmol/l' | 'iu/l' | 'ng/ml' | 'nmol/l' | 'miu/l' | 'ng/dl';

export interface HealthValue {
    value: number;
    unit: HealthUnit;
}

export interface HealthCheck {
    id: string;
    /** When the blood was drawn, hours since 1970. */
    timeH: number;
    phase: Phase;
    /** Drawn before the person started estradiol: the estradiol in it is their own. */
    beforeHrt: boolean;
    values: Partial<Record<Analyte, HealthValue>>;
    /** Epoch ms of the last edit, as on doses and labs. */
    updatedAt?: number;
}

/** The units each hormone is reported in; the first is the one the ranges are in. */
export const ANALYTE_UNITS: Record<Analyte, readonly HealthUnit[]> = {
    e2: ['pg/ml', 'pmol/l'],
    fsh: ['iu/l'],
    lh: ['iu/l'],
    p4: ['ng/ml', 'nmol/l'],
    prl: ['ng/ml', 'miu/l'],
    t: ['ng/dl', 'nmol/l', 'ng/ml'],
};

// Into each hormone's first unit. Estradiol uses the factor the rest of the
// app does (convertToPgMl); progesterone 1 ng/mL = 3.18 nmol/L (M 314.5);
// prolactin 1 ng/mL = 21.2 mIU/L (WHO 3rd IS 84/500); testosterone
// 1 nmol/L = 28.842 ng/dL, as convertToNgDl. FSH and LH have one unit:
// IU/L and mIU/mL are the same number.
const TO_BASE: Record<Analyte, Partial<Record<HealthUnit, number>>> = {
    e2: { 'pg/ml': 1, 'pmol/l': 1 / 3.671 },
    fsh: { 'iu/l': 1 },
    lh: { 'iu/l': 1 },
    p4: { 'ng/ml': 1, 'nmol/l': 1 / 3.18 },
    prl: { 'ng/ml': 1, 'miu/l': 1 / 21.2 },
    t: { 'ng/dl': 1, 'nmol/l': 28.842, 'ng/ml': 100 },
};

/** A reading in its hormone's first unit, or null for a unit that hormone isn't reported in. */
export function inBaseUnit(analyte: Analyte, v: HealthValue): number | null {
    const k = TO_BASE[analyte][v.unit];
    return k === undefined ? null : v.value * k;
}

/** How a unit is written on a report. */
export const UNIT_LABEL: Record<HealthUnit, string> = {
    'pg/ml': 'pg/mL',
    'pmol/l': 'pmol/L',
    'iu/l': 'IU/L',
    'ng/ml': 'ng/mL',
    'nmol/l': 'nmol/L',
    'miu/l': 'mIU/L',
    'ng/dl': 'ng/dL',
};

export interface RefRange {
    /** Inclusive bounds in the hormone's first unit; a missing one is open. */
    low?: number;
    high?: number;
}

// Mayo Clinic Laboratories, adult female reference values: estradiol (EEST,
// LC-MS/MS) premenopausal 15–350 pg/mL with no split by phase, postmenopausal
// under 10; FSH and LH by phase in IU/L; progesterone (PGSN) by phase in
// ng/mL; total testosterone 8–60 ng/dL from 19 years. Prolactin: Roche
// Elecsys Prolactin II, 4.8–23.3 ng/mL for women.
const PREMENOPAUSAL_E2: RefRange = { low: 15, high: 350 };
const RANGES: Record<Analyte, Record<Exclude<Phase, 'unknown'>, RefRange>> = {
    e2: {
        follicular: PREMENOPAUSAL_E2,
        midcycle: PREMENOPAUSAL_E2,
        luteal: PREMENOPAUSAL_E2,
        postmenopausal: { high: 10 },
    },
    fsh: {
        follicular: { low: 2.9, high: 14.6 },
        midcycle: { low: 4.7, high: 23.2 },
        luteal: { low: 1.4, high: 8.9 },
        postmenopausal: { low: 16, high: 157 },
    },
    lh: {
        follicular: { low: 1.9, high: 14.6 },
        midcycle: { low: 12.2, high: 118 },
        luteal: { low: 0.7, high: 12.9 },
        postmenopausal: { low: 5.3, high: 65.4 },
    },
    p4: {
        follicular: { high: 0.89 },
        midcycle: { high: 12 },
        luteal: { low: 1.8, high: 24 },
        postmenopausal: { high: 0.2 },
    },
    prl: {
        follicular: { low: 4.8, high: 23.3 },
        midcycle: { low: 4.8, high: 23.3 },
        luteal: { low: 4.8, high: 23.3 },
        postmenopausal: { low: 4.8, high: 23.3 },
    },
    t: {
        follicular: { low: 8, high: 60 },
        midcycle: { low: 8, high: 60 },
        luteal: { low: 8, high: 60 },
        postmenopausal: { low: 8, high: 60 },
    },
};

/**
 * The interval a reading is read against. With the phase not known, only a
 * hormone whose range doesn't depend on it has one, and estradiol takes the
 * premenopausal range, the wider of its two.
 */
export function refRange(analyte: Analyte, phase: Phase): RefRange | null {
    if (phase !== 'unknown') return RANGES[analyte][phase];
    if (analyte === 'e2') return PREMENOPAUSAL_E2;
    if (analyte === 'prl' || analyte === 't') return RANGES[analyte].follicular;
    return null;
}

export type Standing = 'below' | 'within' | 'above';

export function standingOf(value: number, range: RefRange): Standing {
    if (range.low !== undefined && value < range.low) return 'below';
    if (range.high !== undefined && value > range.high) return 'above';
    return 'within';
}

/**
 * FSH from this level up is how the late menopause transition is marked
 * (STRAW+10), and, before 40 and on two draws four weeks apart, premature
 * ovarian insufficiency (ESHRE 2016).
 */
export const MENOPAUSAL_FSH_IU_L = 25;

export function hasMenopausalFsh(check: HealthCheck): boolean {
    const fsh = check.values.fsh;
    if (!fsh) return false;
    const v = inBaseUnit('fsh', fsh);
    return v !== null && v >= MENOPAUSAL_FSH_IU_L;
}

/** After menopause, by the person's word or, when they weren't sure, by FSH. */
export function isPostmenopausal(check: HealthCheck): boolean {
    return check.phase === 'postmenopausal' || (check.phase === 'unknown' && hasMenopausalFsh(check));
}

export interface OwnEstradiol {
    /** pg/mL. */
    value: number;
    /** The check it comes from. */
    check: HealthCheck;
    /** Whether it is steady enough to add under the curve: only after menopause. */
    added: boolean;
}

/**
 * The person's own estradiol: the one in the latest check drawn before HRT.
 * Only added under the curve after menopause, when it holds still; before,
 * the same draw is a moment in a cycle that spans 15 to 350 pg/mL.
 */
export function ownEstradiol(checks: HealthCheck[]): OwnEstradiol | null {
    const latest = checks.filter(c => c.beforeHrt && c.values.e2).sort((a, b) => b.timeH - a.timeH)[0];
    if (!latest) return null;
    const value = inBaseUnit('e2', latest.values.e2!);
    if (value === null || !Number.isFinite(value) || value <= 0) return null;
    return { value, check: latest, added: isPostmenopausal(latest) };
}

/** What the model adds under its curve, pg/mL: see ownEstradiol. */
export function ownEstradiolAdded(checks: HealthCheck[]): number {
    const own = ownEstradiol(checks);
    return own?.added ? own.value : 0;
}

/**
 * A new check starts as "before HRT" when no estradiol dose was logged before
 * it was drawn. Someone entering an old check-up from before they started
 * gets the right answer without being asked; the switch is still there.
 */
export function drawnBeforeHrt(timeH: number, events: DoseEvent[]): boolean {
    return !events.some(e => isEstradiolEster(e.ester) && e.timeH <= timeH);
}

// --- Reading a report ---------------------------------------------------

// How each hormone is named on a report: Chinese, English and the short
// codes, as printed on 性激素六项 and Western panels alike. The single
// letters only as whole words, so T3/T4 and PRL don't count as T or P.
const NAMES: Record<Analyte, RegExp> = {
    e2: /雌二醇|o?estradiol|\bE2\b/i,
    fsh: /促卵泡(?:生成|成熟)?(?:激)?素|卵泡刺激素|follicle[\s-]*stimulating\s*hormone|\bFSH\b/i,
    lh: /促黄体(?:生成)?(?:激)?素|黄体生成素|luteini[sz]ing\s*hormone|\bLH\b/i,
    p4: /孕酮|黄体酮|progesterone|\bPROG?\b|\bP4?\b/i,
    prl: /泌乳素|催乳素|prolactin|\bPRL\b/i,
    t: /睾酮|testosterone|\bTESTO?\b|\bT\b/i,
};

// Units as reports print them, to the ones above. µIU/mL and mIU/L are the
// same number, as are mIU/mL and IU/L.
const UNIT_WORDS: [RegExp, HealthUnit][] = [
    [/^pg\s*\/\s*ml/i, 'pg/ml'],
    [/^pmol\s*\/\s*l/i, 'pmol/l'],
    [/^m\s*iu\s*\/\s*ml/i, 'iu/l'],
    [/^iu\s*\/\s*l/i, 'iu/l'],
    [/^u\s*iu\s*\/\s*ml/i, 'miu/l'],
    [/^m\s*iu\s*\/\s*l/i, 'miu/l'],
    [/^ng\s*\/\s*ml/i, 'ng/ml'],
    [/^ng\s*\/\s*dl/i, 'ng/dl'],
    [/^nmol\s*\/\s*l/i, 'nmol/l'],
];

/** Full-width digits and letters, as OCR and some PDFs give them, to plain ones. */
const halfWidth = (s: string) =>
    s
        .replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
        .replace(/\u3000/g, ' ')
        .replace(/[µμ]/g, 'u');

// A result: an optional comparison sign, then the number. A comma is a
// thousands separator before three digits (1,234 pmol/L) and a decimal point
// otherwise (45,3).
const NUMBER = /([<>≤≥])?\s*(\d{1,3}(?:,\d{3})+(?![\d,])|\d+(?:[.,]\d+)?)/;
const toNumber = (s: string) => parseFloat(/^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.'));

/**
 * Pick a panel's values out of text copied from a report, a PDF or a photo
 * (Live Text). Each hormone takes the first number after its name, which is
 * the result: the reference range comes after it. A copied table can give
 * each cell a line of its own, so a name with no number after it on its line
 * takes one that starts one of the next two. A unit right after the number,
 * or starting the line after it, is kept when it is one that hormone is
 * reported in; otherwise the hormone's first unit stands, for the person to
 * check. A value with a "<" keeps its number.
 */
export function parseHealthCheckText(text: string): Partial<Record<Analyte, HealthValue>> {
    const out: Partial<Record<Analyte, HealthValue>> = {};
    const lines = halfWidth(text).split(/\r?\n/);
    lines.forEach((line, lineNo) => {
        // Several hormones on one line, as a pasted table row gives them:
        // each name's stretch runs up to the next name.
        const hits: { analyte: Analyte; at: number; end: number }[] = [];
        for (const analyte of ANALYTES) {
            const m = NAMES[analyte].exec(line);
            if (m) hits.push({ analyte, at: m.index, end: m.index + m[0].length });
        }
        hits.sort((a, b) => a.at - b.at);
        hits.forEach((h, i) => {
            if (out[h.analyte]) return;
            const last = i + 1 === hits.length;
            // The name's other spelling in brackets, as in "雌二醇(E2)", is
            // not part of the result, and its digits are not the value.
            let stretch = line.slice(h.end, last ? undefined : hits[i + 1].at).replace(/^\s*\([^)]*\)/, '');
            let num = NUMBER.exec(stretch);
            let numLine = lineNo;
            if (!num && last) {
                for (let j = lineNo + 1; j < Math.min(lines.length, lineNo + 3); j++) {
                    const m = new RegExp(`^\\s*${NUMBER.source}`).exec(lines[j]);
                    if (m) {
                        stretch = lines[j];
                        num = m;
                        numLine = j;
                        break;
                    }
                    if (lines[j].trim()) break;
                }
            }
            if (!num) return;
            const value = toNumber(num[2]);
            if (!Number.isFinite(value) || value <= 0) return;
            const rest = stretch.slice(num.index + num[0].length).trimStart();
            const after = rest || (last ? (lines[numLine + 1] ?? '').trimStart() : '');
            const unit = UNIT_WORDS.find(([re]) => re.test(after))?.[1];
            out[h.analyte] = {
                value,
                unit: unit && ANALYTE_UNITS[h.analyte].includes(unit) ? unit : ANALYTE_UNITS[h.analyte][0],
            };
        });
    });
    return out;
}

// --- Stored records -----------------------------------------------------

const isPhase = (v: unknown): v is Phase => typeof v === 'string' && (PHASES as readonly string[]).includes(v);

/** A stored or imported check, or null when it can't be one. Unknown hormones and units are dropped. */
export function sanitizeHealthCheck(raw: unknown): HealthCheck | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || !r.id || typeof r.timeH !== 'number' || !Number.isFinite(r.timeH)) return null;
    const values: Partial<Record<Analyte, HealthValue>> = {};
    const rawValues = r.values && typeof r.values === 'object' ? (r.values as Record<string, unknown>) : {};
    for (const analyte of ANALYTES) {
        const v = rawValues[analyte] as Record<string, unknown> | undefined;
        if (!v || typeof v.value !== 'number' || !Number.isFinite(v.value) || v.value <= 0) continue;
        if (typeof v.unit !== 'string' || !(ANALYTE_UNITS[analyte] as readonly string[]).includes(v.unit)) continue;
        values[analyte] = { value: v.value, unit: v.unit as HealthUnit };
    }
    return {
        id: r.id,
        timeH: r.timeH,
        phase: isPhase(r.phase) ? r.phase : 'unknown',
        beforeHrt: r.beforeHrt === true,
        values,
        ...(typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? { updatedAt: r.updatedAt } : {}),
    };
}

export function sanitizeHealthChecks(raw: unknown): HealthCheck[] {
    return Array.isArray(raw) ? raw.map(sanitizeHealthCheck).filter((c): c is HealthCheck => !!c) : [];
}

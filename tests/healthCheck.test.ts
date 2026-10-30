import { describe, expect, it } from 'vitest';
import {
    HealthCheck,
    drawnBeforeHrt,
    inBaseUnit,
    ownEstradiol,
    ownEstradiolAdded,
    parseHealthCheckText,
    refRange,
    sanitizeHealthChecks,
    standingOf,
} from '../src/utils/healthCheck';
import {
    DoseEvent,
    Ester,
    LabResult,
    Route,
    computeCalibration,
    computeCalibrationPoints,
    endogenousE2,
    rawModelAtLab,
    runSimulation,
} from '../logic';

const check = (over: Partial<HealthCheck> = {}): HealthCheck => ({
    id: 'c1',
    timeH: 480_000,
    phase: 'postmenopausal',
    beforeHrt: true,
    values: { e2: { value: 8, unit: 'pg/ml' } },
    ...over,
});

describe('reading a report', () => {
    it('takes a 性激素六项 panel as a Chinese report prints it', () => {
        const text = [
            '项目名称 结果 单位 参考范围',
            '促卵泡生成素(FSH) 68.2 mIU/mL 绝经期 25.8-134.8',
            '促黄体生成素(LH) 35.1 mIU/mL',
            '雌二醇(E2) <5.00 pg/mL 绝经期 <5.0-54.7',
            '孕酮(P) 0.21 ng/mL',
            '睾酮(T) 0.25 ng/mL',
            '泌乳素(PRL) 245 uIU/mL',
        ].join('\n');
        expect(parseHealthCheckText(text)).toEqual({
            fsh: { value: 68.2, unit: 'iu/l' },
            lh: { value: 35.1, unit: 'iu/l' },
            e2: { value: 5, unit: 'pg/ml' },
            p4: { value: 0.21, unit: 'ng/ml' },
            t: { value: 0.25, unit: 'ng/ml' },
            prl: { value: 245, unit: 'miu/l' },
        });
    });

    it('reads English names, full-width digits and one cell per line', () => {
        const text = 'Estradiol\n１２３．４\npmol/L\nFSH 6.1 IU/L\nProlactin 12 ng/mL\nTestosterone 1,2 nmol/L';
        expect(parseHealthCheckText(text)).toEqual({
            e2: { value: 123.4, unit: 'pmol/l' },
            fsh: { value: 6.1, unit: 'iu/l' },
            prl: { value: 12, unit: 'ng/ml' },
            t: { value: 1.2, unit: 'nmol/l' },
        });
    });

    it('does not read T3, T4 or the digit in "(E2)" as a result', () => {
        expect(parseHealthCheckText('T3 1.8 nmol/L\nT4 98 nmol/L\n雌二醇(E2) 1,234 pmol/L')).toEqual({
            e2: { value: 1234, unit: 'pmol/l' },
        });
    });

    it('falls back to the first unit when the report gives none or a foreign one', () => {
        expect(parseHealthCheckText('E2 40\nLH 5 pg/mL')).toEqual({
            e2: { value: 40, unit: 'pg/ml' },
            lh: { value: 5, unit: 'iu/l' },
        });
    });
});

describe('reference ranges', () => {
    it('reads each hormone against its phase', () => {
        expect(standingOf(68.2, refRange('fsh', 'postmenopausal')!)).toBe('within');
        expect(standingOf(68.2, refRange('fsh', 'follicular')!)).toBe('above');
        expect(standingOf(0.5, refRange('p4', 'luteal')!)).toBe('below');
        expect(standingOf(12, refRange('e2', 'postmenopausal')!)).toBe('above');
        expect(refRange('fsh', 'unknown')).toBeNull();
        expect(refRange('prl', 'unknown')).toEqual({ low: 4.8, high: 23.3 });
    });

    it('converts into the units the ranges are in', () => {
        expect(inBaseUnit('e2', { value: 367.1, unit: 'pmol/l' })).toBeCloseTo(100, 6);
        expect(inBaseUnit('t', { value: 0.25, unit: 'ng/ml' })).toBeCloseTo(25, 6);
        expect(inBaseUnit('prl', { value: 212, unit: 'miu/l' })).toBeCloseTo(10, 6);
        expect(inBaseUnit('p4', { value: 3.18, unit: 'nmol/l' })).toBeCloseTo(1, 6);
    });
});

describe('the person’s own estradiol', () => {
    it('comes from the latest check before HRT and is added only after menopause', () => {
        const older = check({ id: 'old', timeH: 100, values: { e2: { value: 20, unit: 'pg/ml' } } });
        const later = check({ id: 'new', timeH: 200, values: { e2: { value: 29.4, unit: 'pmol/l' } } });
        const onHrt = check({ id: 'hrt', timeH: 300, beforeHrt: false, values: { e2: { value: 90, unit: 'pg/ml' } } });
        const own = ownEstradiol([older, later, onHrt]);
        expect(own?.check.id).toBe('new');
        expect(own?.value).toBeCloseTo(8.01, 2);
        expect(own?.added).toBe(true);
        expect(ownEstradiolAdded([check({ phase: 'luteal', values: { e2: { value: 150, unit: 'pg/ml' } } })])).toBe(0);
        // Not sure of the phase, but FSH says after menopause.
        expect(
            ownEstradiolAdded([
                check({
                    phase: 'unknown',
                    values: { e2: { value: 9, unit: 'pg/ml' }, fsh: { value: 70, unit: 'iu/l' } },
                }),
            ]),
        ).toBe(9);
        expect(ownEstradiolAdded([])).toBe(0);
    });

    it('counts a check as before HRT when no estradiol was logged before it', () => {
        const dose: DoseEvent = { id: 'd', route: Route.gel, timeH: 1000, doseMG: 1.5, ester: Ester.E2, extras: {} };
        expect(drawnBeforeHrt(999, [dose])).toBe(true);
        expect(drawnBeforeHrt(1001, [dose])).toBe(false);
    });

    it('sanitizes stored checks', () => {
        const out = sanitizeHealthChecks([
            {
                id: 'a',
                timeH: 5,
                phase: 'nope',
                beforeHrt: 'yes',
                values: { e2: { value: 3, unit: 'iu/l' }, fsh: { value: 40, unit: 'iu/l' } },
            },
            { id: '', timeH: 5 },
            'junk',
        ]);
        expect(out).toEqual([
            { id: 'a', timeH: 5, phase: 'unknown', beforeHrt: false, values: { fsh: { value: 40, unit: 'iu/l' } } },
        ]);
    });
});

describe('the model with the person’s own estradiol', () => {
    const now = Date.now() / 3600000;
    const doses: DoseEvent[] = Array.from({ length: 30 }, (_, i) => ({
        id: `g${i}`,
        route: Route.gel,
        timeH: now - 24 * (30 - i),
        doseMG: 1.5,
        ester: Ester.E2,
        extras: {},
    }));

    it('records it on the run without adding it to the curve', () => {
        const plain = runSimulation(doses, 65)!;
        const withOwn = runSimulation(doses, 65, null, 8)!;
        expect(endogenousE2(plain)).toBe(0);
        expect(endogenousE2(withOwn)).toBe(8);
        expect(withOwn.concPGmL_E2).toEqual(plain.concPGmL_E2);
    });

    it('calibrates the doses’ share of a lab and shows the lab as a level', () => {
        const sim = runSimulation(doses, 65, null, 8)!;
        const labTime = now - 12;
        const lab: LabResult = { id: 'l', timeH: labTime, concValue: 0, unit: 'pg/ml' };
        const model = rawModelAtLab(runSimulation(doses, 65)!, lab)!;
        // A lab exactly twice the doses' share, plus the person's own.
        const labs = [{ ...lab, concValue: 2 * model + 8 }];
        const [pt] = computeCalibrationPoints(sim, labs);
        expect(pt.obs).toBeCloseTo(2 * model, 6);
        expect(pt.endo).toBe(8);
        expect(pt.ratio).toBeCloseTo(2, 2);
        expect(rawModelAtLab(sim, lab)).toBeCloseTo(model + 8, 6);
        const cal = computeCalibration(sim, doses, 65, labs, 'ou_kalman', 'retrospective');
        expect(cal.factorFn(labTime)).toBeGreaterThan(1.5);
        // A lab at or under the person's own says nothing about the doses.
        expect(computeCalibrationPoints(sim, [{ ...lab, concValue: 8.5 }])).toEqual([]);
    });
});

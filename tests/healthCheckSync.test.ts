import { describe, expect, it } from 'vitest';
import { Ester, Route, isUnmodelledDrug, runSimulation } from '../logic';
import {
    applySyncedStateToStorage,
    buildExportPayloadFromStorage,
    modeKeyFor,
    type ActiveBackupState,
} from '../src/utils/backupState';
import { fingerprintState, mergeSyncStates, normalizeSyncState } from '../src/utils/syncMerge';
import type { HealthCheck } from '../src/utils/healthCheck';
import { forEdition } from '../src/utils/cisDrugs';
import { PLAN_DRUGS, usualFor } from '../src/utils/plan';
import { MemoryStorage } from './memoryStorage';

/** Synthetic values only. */
const OWNER = 'local';
const NOW = Date.UTC(2030, 0, 2);
const CHECKS = modeKeyFor(OWNER, 'transfem', 'health-checks');
const DELETIONS = modeKeyFor(OWNER, 'transfem', 'health-check-deletions');

const check = (id: string, over: Partial<HealthCheck> = {}): HealthCheck => ({
    id,
    timeH: 500_000,
    phase: 'postmenopausal',
    beforeHrt: true,
    values: { e2: { value: 8, unit: 'pg/ml' } },
    updatedAt: NOW - 60_000,
    ...over,
});

const active = (): ActiveBackupState => ({
    events: [],
    labResults: [],
    doseTemplates: [],
    weight: 70,
    birthYear: null,
    pkParams: null,
});

/** The payload a device would upload, read back the way the merge reads it. */
const stateOf = (storage: MemoryStorage) =>
    normalizeSyncState(buildExportPayloadFromStorage(storage, OWNER, 'transfem', active(), '2030-01-01T00:00:00Z'));

const device = (checks?: HealthCheck[], deletions?: Record<string, number>) => {
    const storage = new MemoryStorage();
    if (checks) storage.setItem(CHECKS, JSON.stringify(checks));
    if (deletions) storage.setItem(DELETIONS, JSON.stringify(deletions));
    return storage;
};

describe('health checks in cloud sync', () => {
    it('reach a device that has none', () => {
        const result = mergeSyncStates(stateOf(device()), stateOf(device([check('a')])));
        expect(result.merged.modes.transfem.healthChecks).toEqual([check('a')]);
        expect(result.localChanged).toBe(true);

        const target = device();
        const applied = applySyncedStateToStorage(target, OWNER, 'transfem', result.merged, NOW);
        expect(applied.active.healthChecks).toEqual([check('a')]);
        expect(JSON.parse(target.getItem(CHECKS)!)).toEqual([check('a')]);
    });

    it('keep the newer edit of the same check', () => {
        const newer = check('a', { values: { e2: { value: 9, unit: 'pg/ml' } }, updatedAt: NOW - 1_000 });
        const merged = mergeSyncStates(stateOf(device([check('a')])), stateOf(device([newer]))).merged;
        expect(merged.modes.transfem.healthChecks).toEqual([newer]);
    });

    it('stay deleted once one device deletes them', () => {
        const deleter = device([], { a: NOW - 1_000 });
        const result = mergeSyncStates(stateOf(device([check('a')])), stateOf(deleter));
        expect(result.merged.modes.transfem.healthChecks).toEqual([]);
        expect(result.stats.removed).toBe(1);

        const target = device([check('a')]);
        applySyncedStateToStorage(target, OWNER, 'transfem', result.merged, NOW);
        expect(JSON.parse(target.getItem(CHECKS)!)).toEqual([]);
        expect(Object.keys(JSON.parse(target.getItem(DELETIONS)!))).toEqual(['a']);
    });

    it('leave a payload that never held any exactly as it was', () => {
        const plain = stateOf(device());
        expect(plain.modes.transfem).not.toHaveProperty('healthChecks');
        const result = mergeSyncStates(plain, stateOf(device()));
        expect(result.merged.modes.transfem).not.toHaveProperty('healthChecks');
        expect(fingerprintState(result.merged)).not.toContain('healthChecks');

        // Nothing is written for them either.
        const target = device();
        applySyncedStateToStorage(target, OWNER, 'transfem', result.merged, NOW);
        expect(target.getItem(CHECKS)).toBeNull();
    });
});

describe('menopause progestogens', () => {
    it('are logged as doses with no curve and no estradiol', () => {
        for (const ester of [Ester.P4, Ester.DYD]) {
            expect(isUnmodelledDrug(ester)).toBe(true);
            expect(
                runSimulation([{ id: 'p', route: Route.oral, timeH: 400_000, doseMG: 100, ester, extras: {} }], 65),
            ).toBeNull();
        }
    });

    it('are left out of the trans edition’s menus, which stay as they were', () => {
        expect(forEdition([Ester.E2, Ester.P4, Ester.DYD, Ester.CPA])).toEqual([Ester.E2, Ester.CPA]);
        expect(PLAN_DRUGS.transfem[Route.oral]).not.toContain(Ester.P4);
        expect(usualFor(Route.oral, Ester.P4)).toEqual({ dose: '100', freq: 'd1' });
        expect(usualFor(Route.oral, Ester.DYD)).toEqual({ dose: '10', freq: 'd1' });
    });
});

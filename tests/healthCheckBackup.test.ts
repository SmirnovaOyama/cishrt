import { describe, expect, it } from 'vitest';
import {
    buildCompleteBackupBundleFromStorage,
    inspectCompleteBackupBundle,
    mergeCompleteBackupBundleToStorage,
    replaceCompleteBackupBundleToStorage,
    type CompleteBackupActive,
    type CompleteBackupContext,
} from '../src/utils/backupBundle';
import { modeKeyFor } from '../src/utils/backupState';
import type { HealthCheck } from '../src/utils/healthCheck';
import { MemoryStorage } from './memoryStorage';

/** Synthetic values only. */
const OWNER = 'local';
const CREATED_AT = '2030-01-01T00:00:00.000Z';
const NOW = Date.UTC(2030, 0, 2);
const KEY = modeKeyFor(OWNER, 'transfem', 'health-checks');

const check = (id: string, over: Partial<HealthCheck> = {}): HealthCheck => ({
    id,
    timeH: 500_000,
    phase: 'postmenopausal',
    beforeHrt: true,
    values: { e2: { value: 8, unit: 'pg/ml' }, fsh: { value: 70, unit: 'iu/l' } },
    updatedAt: NOW - 60_000,
    ...over,
});

/** A device holding only these health checks, or none ever. */
const device = (checks?: HealthCheck[]) => {
    const storage = new MemoryStorage();
    if (checks) storage.setItem(KEY, JSON.stringify(checks));
    return storage;
};

const stored = (storage: MemoryStorage): HealthCheck[] | null => {
    const raw = storage.getItem(KEY);
    return raw === null ? null : (JSON.parse(raw) as HealthCheck[]);
};

const active = (storage: MemoryStorage): CompleteBackupActive => ({
    events: [],
    labResults: [],
    doseTemplates: [],
    quickDoses: [],
    supplies: [],
    plan: [],
    healthChecks: stored(storage) ?? undefined,
    weight: 70,
    pkParams: null,
    calibrationMethod: 'mipd',
    calibrationHistoryMode: 'retrospective',
});

const context = (storage: MemoryStorage): CompleteBackupContext => ({
    storage,
    owner: OWNER,
    mode: 'transfem',
    active: active(storage),
    now: NOW,
});

const build = (storage: MemoryStorage) =>
    buildCompleteBackupBundleFromStorage(storage, OWNER, 'transfem', active(storage), CREATED_AT, NOW);

describe('health checks in the complete backup', () => {
    it('travel in the file and merge into another device', () => {
        const bundle = build(device([check('a')]));
        expect(bundle.modes.transfem.healthChecks).toEqual([check('a')]);

        const target = device();
        const result = mergeCompleteBackupBundleToStorage(bundle, context(target));
        expect(result.modes.transfem?.healthChecks).toEqual([check('a')]);
        expect(stored(target)).toEqual([check('a')]);
    });

    it('merge the same check by its newer edit', () => {
        const newer = check('a', { values: { e2: { value: 9, unit: 'pg/ml' } }, updatedAt: NOW - 1_000 });
        const target = device([check('a')]);
        mergeCompleteBackupBundleToStorage(build(device([newer])), context(target));
        expect(stored(target)).toEqual([newer]);

        // An older copy coming back changes nothing.
        mergeCompleteBackupBundleToStorage(build(device([check('a')])), context(target));
        expect(stored(target)).toEqual([newer]);
    });

    it('stay out of a file from a device that never kept any, which still restores', () => {
        const bundle = build(device());
        expect(bundle.modes.transfem).not.toHaveProperty('healthChecks');

        const target = device([check('kept')]);
        expect(inspectCompleteBackupBundle(bundle, context(target)).missing).not.toContain('transfem.healthChecks');
        // A file that says nothing about health checks leaves the device's own alone.
        replaceCompleteBackupBundleToStorage(bundle, context(target));
        expect(stored(target)).toEqual([check('kept')]);
    });

    it('replace the device’s own when the file has them, even none', () => {
        const target = device([check('old')]);
        replaceCompleteBackupBundleToStorage(build(device([check('new')])), context(target));
        expect(stored(target)).toEqual([check('new')]);

        // Every check deleted is still a group the device keeps: the file says "none".
        replaceCompleteBackupBundleToStorage(build(device([])), context(target));
        expect(stored(target)).toEqual([]);
    });

    it('refuse a check with no usable result', () => {
        const bundle = build(device([check('a')]));
        const broken = {
            ...bundle,
            modes: {
                ...bundle.modes,
                transfem: {
                    ...bundle.modes.transfem,
                    healthChecks: [{ ...check('b'), values: { e2: { value: -1 } } }],
                },
            },
        };
        expect(inspectCompleteBackupBundle(broken, context(device())).blocked).toContain('transfem.healthChecks');
    });
});

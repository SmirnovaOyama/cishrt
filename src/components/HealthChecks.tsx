import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DoseEvent, LabResult } from '../../logic';
import { useTranslation } from '../contexts/LanguageContext';
import { formatDate } from '../utils/helpers';
import { fill } from '../utils/regimenText';
import { inertWhen } from '../utils/inert';
import { HealthCheck, ownEstradiol } from '../utils/healthCheck';
import HealthCheckForm from './HealthCheckForm';
import HealthCheckSummary from './HealthCheckSummary';
import { AddCancelLabel } from './StableLabel';
import { headerActionAccent } from './PageHeader';

interface HealthChecksProps {
    checks: HealthCheck[];
    events: DoseEvent[];
    labResults: LabResult[];
    onSave: (check: HealthCheck) => void;
    onDelete: (id: string) => void;
    onAddLab: (lab: LabResult) => void;
}

const divider = 'border-b-(length:--hairline) border-[var(--border)]';
const muted = 'text-[var(--text-muted)]';

/**
 * The cis edition's first section of the Lab page, above the blood tests:
 * health checks, and what the latest one before HRT does to the estimate.
 * Rows open in place, like the lab rows below them; the form opens where
 * Add was pressed. No pop-ups.
 */
const HealthChecks: React.FC<HealthChecksProps> = ({ checks, events, labResults, onSave, onDelete, onAddLab }) => {
    const { t, lang } = useTranslation();
    const [adding, setAdding] = useState(false);
    const [openId, setOpenId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const own = ownEstradiol(checks);
    const sorted = checks.slice().sort((a, b) => b.timeH - a.timeH);

    // A check drawn on HRT measured a level, which is what calibration wants;
    // its estradiol can go in as a lab result unless one is already there.
    const asLab = (c: HealthCheck): LabResult | null => {
        const e2 = c.values.e2;
        if (c.beforeHrt || !e2) return null;
        const unit = e2.unit === 'pmol/l' ? 'pmol/l' : 'pg/ml';
        const dup = labResults.some(
            l => Math.abs(l.timeH - c.timeH) < 24 && l.unit === unit && Math.abs(l.concValue - e2.value) < 1e-9,
        );
        return dup ? null : { id: uuidv4(), timeH: c.timeH, concValue: e2.value, unit };
    };

    return (
        <section className="pb-6">
            <div className="flex items-center justify-between gap-3">
                <h2 className="group-heading mb-1">{t('hc.title')}</h2>
                {checks.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setAdding(v => !v)}
                        className={`${headerActionAccent} -me-2.5`}
                    >
                        <AddCancelLabel open={adding} add={t('hc.add')} cancel={t('btn.cancel')} />
                    </button>
                )}
            </div>

            {checks.length === 0 && !adding && (
                <div className={`py-4 ${divider}`}>
                    <p className="text-sm font-semibold text-[var(--text)]">{t('hc.empty_title')}</p>
                    <p className={`text-sm ${muted} mt-1 max-w-prose`}>{t('hc.empty_desc')}</p>
                    <button type="button" onClick={() => setAdding(true)} className="btn-primary mt-4">
                        {t('hc.add')}
                    </button>
                </div>
            )}

            <div className="disclosure" data-open={adding} {...inertWhen(!adding)}>
                <div className="disclosure-inner">
                    {adding && (
                        <div className={`pb-4 ${divider}`}>
                            <HealthCheckForm
                                events={events}
                                onSave={c => {
                                    onSave(c);
                                    setAdding(false);
                                    setOpenId(c.id);
                                }}
                                onCancel={() => setAdding(false)}
                            />
                        </div>
                    )}
                </div>
            </div>

            {sorted.map(c => {
                const isOpen = openId === c.id;
                const isEditing = editingId === c.id;
                const isOwn = own?.check.id === c.id;
                const lab = isOpen ? asLab(c) : null;
                const count = Object.keys(c.values).length;
                return (
                    <div key={c.id} className={divider}>
                        <button
                            type="button"
                            aria-expanded={isOpen}
                            onClick={() => {
                                setOpenId(isOpen ? null : c.id);
                                setEditingId(null);
                            }}
                            className={`w-[calc(100%+1rem)] -mx-2 px-2 py-3.5 flex items-start gap-3 text-start rounded-md hover:bg-[var(--surface-hover)] ${isOpen ? 'bg-[var(--surface-hover)]' : ''}`}
                        >
                            <span
                                className={`mt-[7px] w-1.5 h-1.5 rounded-full shrink-0 ${isOwn && own?.added ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'}`}
                            />
                            <span className="flex-1 min-w-0">
                                <span className="flex items-center justify-between gap-3">
                                    <span className="text-sm font-medium text-[var(--text)] tabular-nums">
                                        {formatDate(new Date(c.timeH * 3600000), lang)}
                                    </span>
                                    <span className={`text-xs ${muted} shrink-0`}>
                                        {fill(t('hc.count'), { n: count })}
                                    </span>
                                </span>
                                <span className={`block text-xs ${muted} mt-1`}>
                                    {t(`hc.phase.${c.phase}`)}
                                    {t('list.sep')}
                                    {t(c.beforeHrt ? 'hc.before_hrt_short' : 'hc.on_hrt_short')}
                                </span>
                            </span>
                        </button>

                        <div
                            className={`grid ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                            {...inertWhen(!isOpen)}
                        >
                            <div className="overflow-hidden">
                                <div className="pb-4 pt-1">
                                    {isEditing ? (
                                        <HealthCheckForm
                                            checkToEdit={c}
                                            events={events}
                                            onSave={next => {
                                                onSave(next);
                                                setEditingId(null);
                                            }}
                                            onCancel={() => setEditingId(null)}
                                            onDelete={id => {
                                                onDelete(id);
                                                setEditingId(null);
                                                setOpenId(null);
                                            }}
                                        />
                                    ) : (
                                        <>
                                            <HealthCheckSummary check={c} t={t} />
                                            {isOwn && own && (
                                                <p className={`text-xs leading-relaxed ${muted} pt-3`}>
                                                    {fill(t(own.added ? 'hc.own_added' : 'hc.own_not_added'), {
                                                        value:
                                                            own.value >= 10
                                                                ? own.value.toFixed(0)
                                                                : own.value.toFixed(1),
                                                    })}
                                                </p>
                                            )}
                                            {!c.beforeHrt && c.values.e2 && (
                                                <p className={`text-xs leading-relaxed ${muted} pt-3`}>
                                                    {t('hc.on_hrt_note')}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-4 pt-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingId(c.id)}
                                                    className="tap-target text-sm font-medium text-[var(--accent-ink)]"
                                                >
                                                    {t('hc.edit')}
                                                </button>
                                                {lab && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onAddLab(lab)}
                                                        className="tap-target text-sm font-medium text-[var(--accent-ink)]"
                                                    >
                                                        {fill(t('hc.add_as_lab'), {
                                                            value: `${c.values.e2!.value} ${c.values.e2!.unit === 'pmol/l' ? 'pmol/L' : 'pg/mL'}`,
                                                        })}
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* What the person's own estradiol does to the estimate, while its row is shut. */}
            {own && openId !== own.check.id && (
                <p className={`text-xs leading-relaxed ${muted} pt-3`}>
                    {fill(t(own.added ? 'hc.own_added' : 'hc.own_not_added'), {
                        value: own.value >= 10 ? own.value.toFixed(0) : own.value.toFixed(1),
                    })}
                </p>
            )}
        </section>
    );
};

export default HealthChecks;

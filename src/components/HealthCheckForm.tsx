import React, { useId, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useTranslation } from '../contexts/LanguageContext';
import { useDialog } from '../contexts/DialogContext';
import { DoseEvent } from '../../logic';
import { Check, Trash } from './icons';
import DateTimePicker from './DateTimePicker';
import { SelectChevron } from './CustomSelect';
import Segmented from './Segmented';
import Switch from './Switch';
import Tick from './Tick';
import { LOCALE_MAP } from '../utils/helpers';
import { fill } from '../utils/regimenText';
import {
    ANALYTES,
    ANALYTE_UNITS,
    Analyte,
    HealthCheck,
    HealthUnit,
    PHASES,
    Phase,
    UNIT_LABEL,
    drawnBeforeHrt,
    parseHealthCheckText,
    refRange,
} from '../utils/healthCheck';
import { rangeText } from './HealthCheckSummary';

interface HealthCheckFormProps {
    checkToEdit?: HealthCheck | null;
    /** The dose log, to tell whether a new check was drawn before HRT. */
    events: DoseEvent[];
    onSave: (check: HealthCheck) => void;
    onCancel?: () => void;
    onDelete?: (id: string) => void;
    /** Save as the screen's one primary action, or quieter where the screen has its own (the intro's Next). */
    quietSave?: boolean;
}

const divider = 'border-b-(length:--hairline) border-[var(--border)]';

// A value worth saving: a real number above zero, as on the lab form.
const parseValue = (s: string): number | null => {
    const n = parseFloat(s.replace(',', '.'));
    return s.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
};

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

type Draft = Record<Analyte, { value: string; unit: HealthUnit }>;

const draftOf = (check: HealthCheck | null | undefined): Draft =>
    Object.fromEntries(
        ANALYTES.map(a => {
            const v = check?.values[a];
            return [a, { value: v ? String(v.value) : '', unit: v?.unit ?? ANALYTE_UNITS[a][0] }];
        }),
    ) as Draft;

/**
 * One health check, typed or pasted. Pasting the report's text fills in every
 * hormone it can find, so the six numbers don't have to be copied by hand;
 * each field stays editable, since a report is read, not trusted. The phase
 * is asked because every range but prolactin's and testosterone's depends on
 * it, and "before HRT" because only then is the estradiol the person's own.
 */
const HealthCheckForm: React.FC<HealthCheckFormProps> = ({
    checkToEdit,
    events,
    onSave,
    onCancel,
    onDelete,
    quietSave = false,
}) => {
    const { t, lang } = useTranslation();
    const { showDialog } = useDialog();
    const ids = useId();

    const [dateStr, setDateStr] = useState(() =>
        toLocalInput(checkToEdit ? new Date(checkToEdit.timeH * 3600000) : new Date()),
    );
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [phase, setPhase] = useState<Phase>(checkToEdit?.phase ?? 'unknown');
    // A new check counts as before HRT while no estradiol was logged before
    // its date; the switch, once touched, is the person's answer instead.
    const [beforeHrtSet, setBeforeHrtSet] = useState<boolean | null>(checkToEdit ? checkToEdit.beforeHrt : null);
    const timeH = new Date(dateStr).getTime() / 3600000;
    const beforeHrt = beforeHrtSet ?? (Number.isFinite(timeH) && drawnBeforeHrt(timeH, events));
    const [draft, setDraft] = useState<Draft>(() => draftOf(checkToEdit));
    const [pasted, setPasted] = useState('');
    const found = useMemo(() => (pasted.trim() ? parseHealthCheckText(pasted) : {}), [pasted]);
    const foundCount = Object.keys(found).length;

    const paste = (text: string) => {
        setPasted(text);
        const values = text.trim() ? parseHealthCheckText(text) : {};
        if (!Object.keys(values).length) return;
        setDraft(prev => {
            const next = { ...prev };
            for (const a of ANALYTES) {
                const v = values[a];
                if (v) next[a] = { value: String(v.value), unit: v.unit };
            }
            return next;
        });
    };

    const parsed = ANALYTES.map(a => ({ a, n: parseValue(draft[a].value), raw: draft[a].value }));
    const fieldsOk = parsed.every(p => p.raw.trim() === '' || p.n !== null);
    const canSave = fieldsOk && parsed.some(p => p.n !== null) && Number.isFinite(timeH);

    const save = () => {
        if (!canSave) return;
        const values: HealthCheck['values'] = {};
        for (const { a, n } of parsed) if (n !== null) values[a] = { value: n, unit: draft[a].unit };
        onSave({ id: checkToEdit?.id ?? uuidv4(), timeH, phase, beforeHrt, values });
    };

    const formatDay = (d: Date) =>
        d.toLocaleDateString(LOCALE_MAP[lang] || 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <div className="flex flex-col">
            {/* Paste from the report. Fills in what it finds and says how much. */}
            <div className={`py-[18px] ${divider}`}>
                <label htmlFor={`${ids}-paste`} className="block text-sm text-[var(--text)] mb-3">
                    {t('hc.paste')}
                </label>
                <textarea
                    id={`${ids}-paste`}
                    rows={3}
                    value={pasted}
                    onChange={e => paste(e.target.value)}
                    placeholder={t('hc.paste_placeholder')}
                    className="input-base w-full resize-y text-[var(--text)] placeholder:text-[var(--text-muted)]"
                    style={{ fontSize: '16px' }}
                />
                <p className="text-xs text-[var(--text-muted)] pt-2">
                    {pasted.trim()
                        ? foundCount
                            ? fill(t('hc.paste_found'), { n: foundCount, total: ANALYTES.length })
                            : t('hc.paste_none')
                        : t('hc.paste_hint')}
                </p>
            </div>

            {/* Date */}
            <button
                type="button"
                onClick={() => setIsDatePickerOpen(v => !v)}
                className={`w-full flex items-center justify-between py-[18px] ${divider} text-start`}
            >
                <span className="text-sm text-[var(--text)]">{t('hc.date')}</span>
                <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                    <span className="text-sm tabular-nums">{dateStr ? formatDay(new Date(dateStr)) : '—'}</span>
                    <SelectChevron />
                </span>
            </button>
            <DateTimePicker
                isOpen={isDatePickerOpen}
                inline
                onClose={() => setIsDatePickerOpen(false)}
                onConfirm={date => setDateStr(toLocalInput(date))}
                initialDate={dateStr ? new Date(dateStr) : new Date()}
                mode="date"
                title={t('hc.date')}
            />

            {/* Where in the cycle */}
            <div className={`pt-[18px] pb-2 ${divider}`}>
                <p className="text-sm text-[var(--text)]">{t('hc.phase')}</p>
                <div className="mt-1" role="radiogroup" aria-label={t('hc.phase')}>
                    {PHASES.map(p => (
                        <button
                            key={p}
                            type="button"
                            role="radio"
                            aria-checked={phase === p}
                            onClick={() => setPhase(p)}
                            className="w-full flex items-center justify-between gap-4 py-2.5 text-start"
                        >
                            <span className="min-w-0">
                                <span
                                    className={`block text-sm text-[var(--text)] ${phase === p ? 'font-semibold' : ''}`}
                                >
                                    {t(`hc.phase.${p}`)}
                                </span>
                                <span className="block text-xs text-[var(--text-muted)] mt-0.5">
                                    {t(`hc.phase_desc.${p}`)}
                                </span>
                            </span>
                            <Tick on={phase === p} />
                        </button>
                    ))}
                </div>
            </div>

            {/* Before HRT */}
            <div className={`py-[18px] ${divider} flex items-center justify-between gap-4`}>
                <label htmlFor={`${ids}-before`} className="cursor-pointer min-w-0">
                    <span className="block text-sm text-[var(--text)]">{t('hc.before_hrt')}</span>
                    <span id={`${ids}-before-desc`} className="block text-xs text-[var(--text-muted)] mt-0.5">
                        {t('hc.before_hrt_desc')}
                    </span>
                </label>
                <Switch
                    id={`${ids}-before`}
                    checked={beforeHrt}
                    onChange={setBeforeHrtSet}
                    describedBy={`${ids}-before-desc`}
                />
            </div>

            {/* The six results */}
            {ANALYTES.map(a => {
                const units = ANALYTE_UNITS[a];
                const field = draft[a];
                const n = parseValue(field.value);
                const range = refRange(a, phase);
                const id = `${ids}-${a}`;
                return (
                    <div key={a} className={`py-[18px] ${divider}`}>
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <label htmlFor={id} className="text-sm text-[var(--text)]">
                                {t(`hc.analyte.${a}`)}
                            </label>
                            {units.length > 1 ? (
                                <Segmented<HealthUnit>
                                    options={units.map(u => ({ id: u, label: UNIT_LABEL[u] }))}
                                    value={field.unit}
                                    onChange={u => setDraft(prev => ({ ...prev, [a]: { ...prev[a], unit: u } }))}
                                    aria-label={t(`hc.analyte.${a}`)}
                                />
                            ) : (
                                <span className="text-sm text-[var(--text-muted)]">{UNIT_LABEL[units[0]]}</span>
                            )}
                        </div>
                        <input
                            id={id}
                            type="text"
                            inputMode="decimal"
                            placeholder="—"
                            value={field.value}
                            onChange={e => setDraft(prev => ({ ...prev, [a]: { ...prev[a], value: e.target.value } }))}
                            aria-invalid={field.value.trim() !== '' && n === null}
                            className="input-base w-full text-[var(--text)] placeholder:text-[var(--text-muted)] tabular-nums"
                            style={{ fontSize: '16px' }}
                        />
                        {/* The range this phase is read against, in the unit the person is typing in. */}
                        <p className="text-xs text-[var(--text-muted)] pt-2 tabular-nums">
                            {range ? rangeText(a, range, field.unit, t) : t('hc.range_needs_phase')}
                        </p>
                    </div>
                );
            })}
            <p className="text-xs text-[var(--text-muted)] pt-2">{t('hc.range_source')}</p>

            {/* Footer */}
            <div className="pt-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    {checkToEdit && onDelete && (
                        <button
                            onClick={() =>
                                showDialog(
                                    'confirm',
                                    formatDay(new Date(checkToEdit.timeH * 3600000)),
                                    () => onDelete(checkToEdit.id),
                                    { danger: true, title: t('hc.delete_confirm'), confirmLabel: t('btn.delete') },
                                )
                            }
                            className="tap-target p-2 text-[var(--text-muted)] hover:text-[var(--danger)] rounded"
                            title={t('btn.delete')}
                            aria-label={t('btn.delete')}
                        >
                            <Trash size={16} />
                        </button>
                    )}
                </div>
                <div className="flex gap-2 ml-auto">
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="min-w-[88px] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-hover)] rounded-md flex items-center justify-center"
                        >
                            {t('btn.cancel')}
                        </button>
                    )}
                    <button
                        onClick={save}
                        disabled={!canSave}
                        className={`${quietSave ? 'btn-secondary' : 'btn-primary'} min-w-[88px]`}
                    >
                        <Check size={14} />
                        {t('btn.save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HealthCheckForm;

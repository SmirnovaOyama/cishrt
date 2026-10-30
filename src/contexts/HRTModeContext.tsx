import React, { createContext, useContext, useEffect, useState } from 'react';
import { HRTMode } from '../../logic';
import { IS_CIS } from '../edition';

interface HRTModeContextValue {
    mode: HRTMode;
    setMode: (m: HRTMode) => void;
    isTransmasc: boolean;
}

const HRTModeContext = createContext<HRTModeContextValue | null>(null);

export const useHRTMode = (): HRTModeContextValue => {
    const ctx = useContext(HRTModeContext);
    if (!ctx) throw new Error('useHRTMode must be used within HRTModeProvider');
    return ctx;
};

const STORAGE_KEY = 'hrt-mode';

export const HRTModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // The cis edition is estradiol only: its records live under 'transfem',
    // the estradiol mode's keys, and nothing can switch it away.
    const [mode, setModeState] = useState<HRTMode>(() => {
        if (IS_CIS) return 'transfem';
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved === 'transmasc' || saved === 'transfem' ? saved : 'transfem';
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, mode);
    }, [mode]);

    const setMode = (m: HRTMode) => {
        if (!IS_CIS) setModeState(m);
    };

    return (
        <HRTModeContext.Provider value={{ mode, setMode, isTransmasc: mode === 'transmasc' }}>
            {children}
        </HRTModeContext.Provider>
    );
};

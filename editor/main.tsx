import React from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import Editor from './Editor';

// The app's light and dark palettes, following the system like the app's default.
const dark = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => document.documentElement.classList.toggle('dark', dark.matches);
applyTheme();
dark.addEventListener('change', applyTheme);

createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Editor />
    </React.StrictMode>,
);

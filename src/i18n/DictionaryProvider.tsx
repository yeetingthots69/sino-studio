'use client';

import {createContext, useContext} from 'react';
import type {Locale} from './config';
import type {Dictionary} from './get-dictionary';

interface I18nContextValue {
    locale: Locale;
    dictionary: Dictionary;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
    locale,
    dictionary,
    children,
}: {
    locale: Locale;
    dictionary: Dictionary;
    children: React.ReactNode;
}) {
    return (
        <I18nContext.Provider value={{locale, dictionary}}>
            {children}
        </I18nContext.Provider>
    );
}

export function useLocale(): Locale {
    const ctx = useContext(I18nContext);
    if (!ctx) throw new Error('useLocale must be used within I18nProvider');
    return ctx.locale;
}

export function useDictionary(): Dictionary {
    const ctx = useContext(I18nContext);
    if (!ctx) throw new Error('useDictionary must be used within I18nProvider');
    return ctx.dictionary;
}

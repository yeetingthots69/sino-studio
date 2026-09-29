'use client';

import Navbar from '@/components/navbar/Navbar';
import Footer from '@/components/footer/Footer';
import NotFoundView from '@/components/not-found/NotFoundView';
import {useDictionary, useLocale} from '@/i18n/DictionaryProvider';

export default function LocaleNotFound() {
    const locale = useLocale();
    const dict = useDictionary();

    return (
        <>
            <title>404 | Sino Studio</title>
            <Navbar/>
            <NotFoundView
                title={dict.common.pageNotFound}
                body={dict.common.pageNotFoundDescription}
                href={`/${locale}`}
                cta={dict.common.backHome}
            />
            <Footer/>
        </>
    );
}

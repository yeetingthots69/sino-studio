'use client';

import Navbar from '@/components/navbar/Navbar';
import Footer from '@/components/footer/Footer';
import NotFoundView from '@/components/not-found/NotFoundView';
import {useDictionary, useLocale} from '@/i18n/DictionaryProvider';

export default function ProjectNotFound() {
    const locale = useLocale();
    const dict = useDictionary();

    return (
        <>
            <title>404 | Sino Studio</title>
            <Navbar/>
            <NotFoundView
                title={dict.common.projectNotFound}
                body={dict.common.projectNotFoundDescription}
                href={`/${locale}/projects`}
                cta={dict.common.backToProjects}
            />
            <Footer/>
        </>
    );
}

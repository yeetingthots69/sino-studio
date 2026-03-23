import {SITE_URL, SITE_NAME} from './seo';

export function organizationJsonLd() {
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/sino-studio-full.png`,
        description: 'Vietnamese Animation Studio',
        sameAs: [
            'https://www.facebook.com/profile.php?id=100069323215001',
            'https://www.tiktok.com/@sino.studio',
            'https://www.youtube.com/@SiNoStudio',
        ],
    };
}

export function webSiteJsonLd(locale: string) {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_URL,
        inLanguage: locale === 'vi' ? 'vi' : 'en',
    };
}

export function creativeWorkJsonLd(project: {
    title: string;
    description: string;
    id: string;
}, locale: string) {
    return {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: project.title,
        description: project.description,
        image: `${SITE_URL}/images/projects/${project.id}/hero.webp`,
        creator: {
            '@type': 'Organization',
            name: SITE_NAME,
        },
        inLanguage: locale === 'vi' ? 'vi' : 'en',
    };
}

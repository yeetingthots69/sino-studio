import type {MetadataRoute} from 'next';
import {LOCALES} from '@/i18n/config';
import {SITE_URL} from '@/lib/seo';
import {PROJECTS} from '@/data/project-data';

const staticRoutes = [
    {path: '', priority: 1.0},
    {path: '/about', priority: 0.8},
    {path: '/services', priority: 0.8},
    {path: '/brand-equity', priority: 0.8},
    {path: '/projects', priority: 0.8},
    {path: '/contact-us', priority: 0.7},
];

export default function sitemap(): MetadataRoute.Sitemap {
    const entries: MetadataRoute.Sitemap = [];

    for (const route of staticRoutes) {
        for (const locale of LOCALES) {
            entries.push({
                url: `${SITE_URL}/${locale}${route.path}`,
                lastModified: new Date(),
                changeFrequency: 'monthly',
                priority: route.priority,
                alternates: {
                    languages: Object.fromEntries(
                        LOCALES.map((l) => [l, `${SITE_URL}/${l}${route.path}`])
                    ),
                },
            });
        }
    }

    for (const id of Object.keys(PROJECTS)) {
        for (const locale of LOCALES) {
            entries.push({
                url: `${SITE_URL}/${locale}/projects/${id}`,
                lastModified: new Date(),
                changeFrequency: 'monthly',
                priority: 0.7,
                alternates: {
                    languages: Object.fromEntries(
                        LOCALES.map((l) => [l, `${SITE_URL}/${l}/projects/${id}`])
                    ),
                },
            });
        }
    }

    return entries;
}

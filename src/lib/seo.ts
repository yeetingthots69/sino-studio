import type {Locale} from '@/i18n/config';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sinostudio.vn';
export const SITE_NAME = 'Sino Studio';

export const DEFAULT_DESCRIPTION: Record<Locale, string> = {
    vi: 'Sino Studio - Studio hoạt hình Việt Nam. Chuyên sản xuất phim hoạt hình, MV hoạt hình và thiết kế nhân vật.',
    en: 'Sino Studio - Vietnamese Animation Studio. Specializing in animated films, animated MVs, and character design.',
};

/**
 * Static OG images per route. Place 1200×630 PNG files at these paths.
 * Falls back to the studio logo until route-specific images are created.
 */
export const OG_IMAGES = {
    home: '/images/og/og-home.png',
    about: '/images/og/og-home.png',
    services: '/images/og/og-home.png',
    brandEquity: '/images/og/og-home.png',
    projects: '/images/og/og-home.png',
    /** Used as fallback when no route-specific OG image exists */
    default: '/sino-studio-full.png',
} as const;

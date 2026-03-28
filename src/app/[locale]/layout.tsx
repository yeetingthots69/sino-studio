import type {Metadata, Viewport} from 'next';
import {Montserrat} from 'next/font/google';
import {MantineProvider, createTheme, ColorSchemeScript} from '@mantine/core';
import Script from 'next/script';
import '@mantine/core/styles.css';
import '../globals.css';
import MusicPlayer from '@/components/music-player/MusicPlayer';
import ProgressBar from '@/components/progress/ProgressBar';
import {LOCALES, type Locale} from '@/i18n/config';
import {getDictionary} from '@/i18n/get-dictionary';
import {I18nProvider} from '@/i18n/DictionaryProvider';
import {SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION, OG_IMAGES} from '@/lib/seo';
import {organizationJsonLd, webSiteJsonLd} from '@/lib/json-ld';

const montserrat = Montserrat({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700', '800', '900'],
    variable: '--font-heading',
    display: 'swap',
});

const theme = createTheme({
    primaryColor: 'red',
    colors: {
        red: [
            '#ffe8ea',
            '#ffb3b8',
            '#ff8088',
            '#ff4d57',
            '#e8192c',
            '#c91526',
            '#a81120',
            '#870d1a',
            '#660913',
            '#45050d',
        ],
    },
    fontFamily: 'Inter, sans-serif',
    headings: {fontFamily: '"Montserrat", sans-serif'},
    defaultRadius: 0,
});

export async function generateStaticParams() {
    return LOCALES.map((locale) => ({locale}));
}

interface LayoutProps {
    children: React.ReactNode;
    params: Promise<{locale: string}>;
}

export async function generateMetadata({params}: LayoutProps): Promise<Metadata> {
    const {locale} = await params;

    return {
        metadataBase: new URL(SITE_URL),
        title: {
            default: SITE_NAME,
            template: `%s | ${SITE_NAME}`,
        },
        description: DEFAULT_DESCRIPTION[locale as Locale] || DEFAULT_DESCRIPTION.vi,
        openGraph: {
            type: 'website',
            locale: locale === 'vi' ? 'vi_VN' : 'en_US',
            siteName: SITE_NAME,
            images: [{url: OG_IMAGES.favicon, width: 1200, height: 630, alt: SITE_NAME}],
        },
        twitter: {
            card: 'summary_large_image',
        },
        robots: {index: true, follow: true},
        alternates: {
            languages: {
                en: '/en',
                vi: '/vi',
            },
        },
    };
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
};

export default async function LocaleLayout({children, params}: LayoutProps) {
    const {locale} = await params;
    const dictionary = await getDictionary(locale as Locale);

    return (
        <html lang={locale} suppressHydrationWarning className={montserrat.variable}>
        <head>
            <ColorSchemeScript defaultColorScheme="dark"/>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify([
                        organizationJsonLd(),
                        webSiteJsonLd(locale),
                    ]),
                }}
            />
        </head>
        <body>
        <MantineProvider theme={theme} defaultColorScheme="dark">
            <I18nProvider locale={locale as Locale} dictionary={dictionary}>
                {children}
            </I18nProvider>
            <MusicPlayer/>
            <ProgressBar/>
        </MantineProvider>
        <Script src="https://www.youtube.com/iframe_api" strategy="afterInteractive"/>
        </body>
        </html>
    );
}

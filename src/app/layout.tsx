import type {Metadata, Viewport} from "next";
import {Montserrat} from "next/font/google";
import {MantineProvider, createTheme, ColorSchemeScript} from "@mantine/core";
import "@mantine/core/styles.css";
import "./globals.css";
import MusicPlayer from "@/components/music-player/MusicPlayer";
import ProgressBar from "@/components/progress/ProgressBar";

const montserrat = Montserrat({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700', '800', '900'],
    variable: '--font-heading',
    display: 'swap',
});

const theme = createTheme({
    primaryColor: "red",
    colors: {
        red: [
            "#ffe8ea",
            "#ffb3b8",
            "#ff8088",
            "#ff4d57",
            "#e8192c",
            "#c91526",
            "#a81120",
            "#870d1a",
            "#660913",
            "#45050d",
        ],
    },
    fontFamily: "Inter, sans-serif",
    headings: {fontFamily: '"Montserrat", sans-serif'},
    defaultRadius: 0,
});

export const metadata: Metadata = {
    title: "Sino Studio",
    description: "Vietnamese Animation Studio",
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning className={montserrat.variable}>
        <head>
            <ColorSchemeScript defaultColorScheme="dark"/>
        </head>
        <body>
        <MantineProvider theme={theme} defaultColorScheme="dark">
            {children}
            <MusicPlayer />
            <ProgressBar />
        </MantineProvider>
        </body>
        </html>
    );
}

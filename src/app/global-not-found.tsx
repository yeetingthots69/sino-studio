import './globals.css';
import type {Metadata} from 'next';
import {Montserrat} from 'next/font/google';
import NotFoundView from '@/components/not-found/NotFoundView';

const montserrat = Montserrat({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700', '800', '900'],
    variable: '--font-heading',
    display: 'swap',
});

export const metadata: Metadata = {
    title: '404 | Sino Studio',
    robots: {index: false},
};

// Bypasses all layouts (no dictionary provider), so the copy is bilingual. "/" redirects to the visitor's locale.
export default function GlobalNotFound() {
    return (
        <html lang="en" className={montserrat.variable}>
        <body style={{backgroundColor: 'var(--color-black)'}}>
        <NotFoundView
            title="Page not found · Không tìm thấy trang"
            body="The page you're looking for doesn't exist or has been moved. Trang bạn tìm không tồn tại hoặc đã bị di chuyển."
            href="/"
            cta="Home · Trang chủ"
        />
        </body>
        </html>
    );
}

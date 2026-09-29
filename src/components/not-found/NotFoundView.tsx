import Link from 'next/link';
import styles from './NotFoundView.module.css';

interface NotFoundViewProps {
    title: string;
    body: string;
    href: string;
    cta: string;
}

export default function NotFoundView({title, body, href, cta}: NotFoundViewProps) {
    return (
        <main className={styles.wrapper}>
            <div className={styles.inner}>
                <span className={styles.code}>404</span>
                <h1 className={styles.heading}>{title}</h1>
                <p className={styles.body}>{body}</p>
                <Link href={href} className={styles.btn}>
                    {cta}
                </Link>
            </div>
        </main>
    );
}

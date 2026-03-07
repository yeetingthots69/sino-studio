import Link from 'next/link';
import Navbar from '@/components/navbar/Navbar';
import Footer from '@/components/footer/Footer';
import styles from './not-found.module.css';

export default function ProjectNotFound() {
    return (
        <>
            <Navbar/>
            <main className={styles.wrapper}>
                <div className={styles.inner}>
                    <span className={styles.code}>404</span>
                    <h1 className={styles.heading}>Project Not Found</h1>
                    <p className={styles.body}>
                        The project you&apos;re looking for doesn&apos;t exist or hasn&apos;t been added yet.
                    </p>
                    <Link href="/projects" className={styles.btn}>
                        ← Back to Projects
                    </Link>
                </div>
            </main>
            <Footer/>
        </>
    );
}


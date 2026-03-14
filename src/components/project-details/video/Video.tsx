'use client';

import {useEffect, useRef, useState, useCallback} from 'react';
import {motion} from 'framer-motion';
import {type ProjectMetaData} from '@/data/project-data';
import styles from './Video.module.css';

interface Props {
    project: ProjectMetaData;
}

export default function Video({project}: Props) {
    if (!project.youtubeId) return null;

    const hasSynced = Boolean(project.syncedLyrics?.length);
    const hasStatic = Boolean(project.lyrics);
    const hasLyrics = hasSynced || hasStatic;
    const hasStats  = Boolean(project.videoStats?.length);

    return (
        <section id="video" className={styles.section}>
            <motion.div
                className={styles.banner}
                initial={{opacity: 0}}
                whileInView={{opacity: 1}}
                viewport={{once: true}}
                transition={{duration: 0.5}}
            >
                <h2 className={styles.bannerTitle}>VIDEO</h2>
            </motion.div>

            <div className={`${styles.content} ${hasLyrics ? styles.contentWithLyrics : ''}`}>

                {/* ── Left column: player + stats ── */}
                <motion.div
                    className={styles.videoColumn}
                    initial={{opacity: 0, y: 30}}
                    whileInView={{opacity: 1, y: 0}}
                    viewport={{once: true, amount: 0.1}}
                    transition={{duration: 0.6}}
                >
                    <div className={styles.iframeContainer}>
                        <YouTubePlayer project={project} hasSynced={hasSynced}/>
                    </div>
                    {hasStats && <VideoStats project={project}/>}
                </motion.div>

                {/* ── Right column: lyrics ── */}
                {hasLyrics && (
                    <motion.div
                        /* lyricsColumn is on the motion.div — the direct flex child —
                           so desktop flex sizing targets the right element */
                        className={styles.lyricsColumn}
                        initial={{opacity: 0, y: 30}}
                        whileInView={{opacity: 1, y: 0}}
                        viewport={{once: true, amount: 0.1}}
                        transition={{duration: 0.6, delay: 0.15}}
                    >
                        <h3 className={styles.lyricsTitle}>LYRICS</h3>
                        <div className={styles.lyricsScrollContainer}>
                            {hasSynced
                                ? <SyncedLyrics project={project}/>
                                : <pre className={styles.lyricsText}>{project.lyrics}</pre>
                            }
                        </div>
                    </motion.div>
                )}
            </div>
        </section>
    );
}

/* ─────────────────────────────────────────────────────────────────────────
   VideoStats
───────────────────────────────────────────────────────────────────────── */

function VideoStats({project}: {project: ProjectMetaData}) {
    const stats = project.videoStats!;
    return (
        <motion.div
            className={styles.statsRow}
            initial={{opacity: 0, y: 16}}
            whileInView={{opacity: 1, y: 0}}
            viewport={{once: true, amount: 0.1}}
            transition={{duration: 0.5, delay: 0.2}}
        >
            {stats.map((s) => (
                <div key={s.label} className={styles.statBlock}>
                    <span className={styles.statValue} style={{color: s.color || 'var(--color-white)'}}>
                        {s.value}
                    </span>
                    <span className={styles.statLabel}>{s.label}</span>
                </div>
            ))}
        </motion.div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────
   YouTubePlayer
   Sets sharedPlayer only inside onReady so it is truly usable when
   SyncedLyrics starts polling.
───────────────────────────────────────────────────────────────────────── */

let sharedPlayer: YT.Player | null = null;

interface PlayerProps {
    project: ProjectMetaData;
    hasSynced: boolean;
}

function YouTubePlayer({project, hasSynced}: PlayerProps) {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let player: YT.Player;

        const init = () => {
            if (!mountRef.current) return;
            player = new window.YT.Player(mountRef.current, {
                videoId: project.youtubeId,
                playerVars: {rel: 0, modestbranding: 1},
                events: {
                    onReady: () => {
                        // Only expose to SyncedLyrics after the player is truly ready
                        if (hasSynced) sharedPlayer = player;
                    },
                },
            });
        };

        if (window.YT?.Player) {
            init();
        } else {
            const prev = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                prev?.();
                init();
            };
        }

        return () => {
            player?.destroy();
            if (hasSynced) sharedPlayer = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project.youtubeId]);

    return <div ref={mountRef} className={styles.playerMount}/>;
}

/* ─────────────────────────────────────────────────────────────────────────
   SyncedLyrics
   rAF loop + click-to-seek. Uses sharedPlayer which is set only after
   the YT player fires onReady.
───────────────────────────────────────────────────────────────────────── */

function SyncedLyrics({project}: {project: ProjectMetaData}) {
    const lines        = project.syncedLyrics!;
    const [active, setActive] = useState(-1);
    const activeRef    = useRef(-1);
    const rafRef       = useRef<number>(0);
    const tickRef      = useRef<() => void>(() => {});
    const lineRefs     = useRef<(HTMLSpanElement | null)[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    const tick = useCallback(() => {
        const t = sharedPlayer?.getCurrentTime() ?? 0;

        // Binary search: last entry where entry.t <= t
        let lo = 0, hi = lines.length - 1, idx = 0;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (lines[mid].t <= t) { idx = mid; lo = mid + 1; }
            else hi = mid - 1;
        }

        if (idx !== activeRef.current) {
            activeRef.current = idx;
            setActive(idx);

            const el  = lineRefs.current[idx];
            const box = containerRef.current;
            if (el && box) {
                box.scrollTo({
                    top: el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2,
                    behavior: 'smooth',
                });
            }
        }

        rafRef.current = requestAnimationFrame(tickRef.current);
    }, [lines]);

    useEffect(() => { tickRef.current = tick; }, [tick]);

    useEffect(() => {
        const start = () => { rafRef.current = requestAnimationFrame(tickRef.current); };
        const stop  = () => cancelAnimationFrame(rafRef.current);

        // Poll until sharedPlayer is set (i.e. YT onReady has fired)
        const pollId = setInterval(() => {
            if (!sharedPlayer) return;
            clearInterval(pollId);

            (sharedPlayer as unknown as {
                addEventListener: (e: string, cb: (ev: {data: YT.PlayerState}) => void) => void;
            }).addEventListener('onStateChange', (ev) => {
                if (ev.data === YT.PlayerState.PLAYING)  start();
                if (ev.data === YT.PlayerState.PAUSED    ||
                    ev.data === YT.PlayerState.ENDED      ||
                    ev.data === YT.PlayerState.BUFFERING) stop();
            });
        }, 100);

        return () => {
            clearInterval(pollId);
            cancelAnimationFrame(rafRef.current);
        };
    }, [tick]);

    // Click a line → seek the video to that timestamp
    const seekTo = useCallback((t: number) => {
        if (!sharedPlayer) return;
        sharedPlayer.seekTo(t, true);
    }, []);

    return (
        <div ref={containerRef} className={styles.syncedScroll}>
            {lines.map((entry, i) => (
                <span
                    key={i}
                    ref={(el) => { lineRefs.current[i] = el; }}
                    className={`${styles.lyricLine} ${i === active ? styles.lyricLineActive : ''}`}
                    onClick={() => seekTo(entry.t)}
                >
                    {entry.line || '\u00A0'}
                </span>
            ))}
        </div>
    );
}

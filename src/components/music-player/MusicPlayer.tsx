'use client';

import {useState, useRef, useEffect, useCallback, useMemo} from 'react';
import Image from 'next/image';
import {Slider} from '@mantine/core';
import {
    IconPlayerPlay,
    IconPlayerPause,
    IconPlayerSkipBack,
    IconPlayerSkipForward,
    IconVolume,
    IconVolumeOff,
    IconMusic,
    IconChevronDown,
} from '@tabler/icons-react';
import {PLAYLIST, type MusicMetadata} from '@/data/playlist';
import styles from './MusicPlayer.module.css';

/* ── Helpers ───────────────────────────────────────────────────── */
function shuffleAfterFirst(arr: MusicMetadata[]): MusicMetadata[] {
    if (arr.length <= 1) return arr;
    const [first, ...rest] = arr;
    for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    return [first, ...rest];
}

function fmt(seconds: number): string {
    if (!isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ── Component ─────────────────────────────────────────────────── */
export default function MusicPlayer() {
    const tracks = useMemo(
        () => shuffleAfterFirst(Object.values(PLAYLIST)),
        [], // shuffle once on mount
    );

    const audioRef = useRef<HTMLAudioElement>(null);

    const [trackIdx, setTrackIdx] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [volume, setVolume] = useState(0.7);
    const [muted, setMuted] = useState(false);
    const [progress, setProgress] = useState(0);   // 0-100
    const [duration, setDuration] = useState(0);
    const [current, setCurrent] = useState(0);
    const [collapsed, setCollapsed] = useState(true);

    const track = tracks[trackIdx];
    const audioSrc = `/music/${track.id}.webm`;
    const thumbSrc = `/images/music-thumbnails/${track.id}.webp`;

    /* ── Sync audio src when track changes ── */
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.src = audioSrc;
        audio.volume = muted ? 0 : volume;
        if (playing) audio.play().catch(() => setPlaying(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trackIdx]);

    /* ── Volume / mute sync ── */
    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
    }, [volume, muted]);

    /* ── Audio event listeners ── */
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onTimeUpdate = () => {
            setCurrent(audio.currentTime);
            if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
        };
        const onLoadedMetadata = () => setDuration(audio.duration);
        const onEnded = () => handleNext();

        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('loadedmetadata', onLoadedMetadata);
        audio.addEventListener('ended', onEnded);
        return () => {
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            audio.removeEventListener('ended', onEnded);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trackIdx]);

    /* ── Controls ── */
    const togglePlay = useCallback(async () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (playing) {
            audio.pause();
            setPlaying(false);
        } else {
            try {
                await audio.play();
                setPlaying(true);
            }
            catch {
                setPlaying(false);
            }
        }
    }, [playing]);

    const handlePrev = useCallback(() => {
        setTrackIdx((i) => (i - 1 + tracks.length) % tracks.length);
        setProgress(0);
        setCurrent(0);
    }, [tracks.length]);

    const handleNext = useCallback(() => {
        setTrackIdx((i) => (i + 1) % tracks.length);
        setProgress(0);
        setCurrent(0);
    }, [tracks.length]);

    const handleSeek = useCallback((val: number) => {
        const audio = audioRef.current;
        if (!audio || !audio.duration) return;
        audio.currentTime = (val / 100) * audio.duration;
        setProgress(val);
    }, []);

    const toggleMute = useCallback(() => setMuted((m) => !m), []);

    /* ── Render ── */
    return (
        <div className={`${styles.player} ${collapsed ? styles.collapsed : ''}`}>
            <audio ref={audioRef} preload="metadata"/>

            {/* ── Collapse toggle ── */}
            <button
                className={styles.collapseBtn}
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? 'Expand music player' : 'Collapse music player'}
            >
                {collapsed
                    ? <IconMusic size={16}/>
                    : <IconChevronDown size={16}/>
                }
            </button>

            {!collapsed && (
                <>
                    {/* ── Top row: thumbnail + info ── */}
                    <div className={styles.trackRow}>
                        <div className={styles.thumb}>
                            <Image
                                src={thumbSrc}
                                alt={track.title}
                                fill
                                sizes="48px"
                                style={{objectFit: 'cover'}}
                            />
                        </div>
                        <div className={styles.trackInfo}>
                            <span className={styles.trackTitle}>{track.title}</span>
                            <span className={styles.trackArtist}>{track.artist.join(', ')}</span>
                        </div>
                    </div>

                    {/* ── Progress bar ── */}
                    <div className={styles.progressRow}>
                        <span className={styles.time}>{fmt(current)}</span>
                        <Slider
                            className={styles.seekSlider}
                            value={progress}
                            onChange={handleSeek}
                            min={0} max={100} step={0.1}
                            size="xs"
                            thumbSize={10}
                            color="red"
                            label={null}
                        />
                        <span className={styles.time}>{fmt(duration)}</span>
                    </div>

                    {/* ── Controls row ── */}
                    <div className={styles.controlsRow}>
                        {/* Prev */}
                        <button className={styles.ctrl} onClick={handlePrev} aria-label="Previous track">
                            <IconPlayerSkipBack size={18}/>
                        </button>

                        {/* Play / Pause */}
                        <button className={`${styles.ctrl} ${styles.playBtn}`} onClick={togglePlay}
                                aria-label={playing ? 'Pause' : 'Play'}>
                            {playing
                                ? <IconPlayerPause size={20}/>
                                : <IconPlayerPlay size={20}/>
                            }
                        </button>

                        {/* Next */}
                        <button className={styles.ctrl} onClick={handleNext} aria-label="Next track">
                            <IconPlayerSkipForward size={18}/>
                        </button>

                        {/* Volume */}
                        <button className={styles.ctrl} onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
                            {muted || volume === 0
                                ? <IconVolumeOff size={16}/>
                                : <IconVolume size={16}/>
                            }
                        </button>
                        <Slider
                            className={styles.volSlider}
                            value={muted ? 0 : volume * 100}
                            onChange={(v) => {
                                setVolume(v / 100);
                                setMuted(false);
                            }}
                            min={0} max={100} step={1}
                            size="xs"
                            thumbSize={10}
                            color="red"
                            label={null}
                        />
                    </div>
                </>
            )}
        </div>
    );
}


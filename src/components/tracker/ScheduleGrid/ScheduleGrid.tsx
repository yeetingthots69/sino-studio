// Read-only month schedule for public share pages (server component, no client state).
import type {CSSProperties} from 'react';
import Link from 'next/link';
import {addDays, assignLanes, clampToMonth, isWeekend, monthRange} from '@/components/tracker/dates';
import {dateRange, FIX_STRIPE, type ShareDto, type ShareLink} from '@/lib/tracker/shareShape';
import styles from './ScheduleGrid.module.css';

type Labels = {member: string; details: string; noTasks: string; links: string; prevMonth: string; nextMonth: string; fix: string};

const LANE_H = 28;

function Links({links}: {links: ShareLink[]}) {
    return links.map((l, i) => (
        <a key={i} href={l.url} target="_blank" rel="noreferrer noopener" className={styles.link}>{l.label}</a>
    ));
}

export default function ScheduleGrid({dto, labels, monthLabel, prevHref, nextHref}: {
    dto: ShareDto; labels: Labels; monthLabel: string; prevHref: string; nextHref: string;
}) {
    const {start, days} = monthRange(dto.month);
    const dates = Array.from({length: days}, (_, i) => addDays(start, i));
    const types = new Map(dto.types.map((t) => [t.id, t]));
    const cuts = new Map(dto.cuts.map((c) => [c.id, c]));
    const name = (t: ShareDto['tasks'][number]) => `${cuts.get(t.cut_id)?.code ?? ''} · ${types.get(t.work_type_id)?.code ?? ''}${t.is_fix ? ` · ${labels.fix}` : ''}`;
    const cols = {'--days': days} as CSSProperties;

    return (
        <div className={styles.wrap}>
            <nav className={styles.monthNav}>
                <Link href={prevHref} rel="noreferrer" aria-label={labels.prevMonth}>‹</Link>
                <span>{monthLabel}</span>
                <Link href={nextHref} rel="noreferrer" aria-label={labels.nextMonth}>›</Link>
            </nav>

            <ul className={styles.legend}>
                {dto.types.map((t) => (
                    <li key={t.id}><span className={styles.dot} style={{background: t.color}}/>{t.code} · {t.label}</li>
                ))}
            </ul>

            <div className={styles.scroll}>
                <div className={styles.grid} style={cols}>
                    <div className={styles.row}>
                        <div className={styles.name}>{labels.member}</div>
                        <div className={styles.days}>
                            {dates.map((d) => (
                                <span key={d} className={isWeekend(d) ? styles.weekend : undefined}>{Number(d.slice(8))}</span>
                            ))}
                        </div>
                    </div>
                    {dto.staff.map((s) => {
                        const tasks = dto.tasks.filter((t) => t.staff_id === s.id);
                        const lanes = assignLanes(tasks);
                        const laneCount = Math.max(1, ...[...lanes.values()].map((l) => l + 1));
                        return (
                            <div key={s.id} className={styles.row}>
                                <div className={styles.name}>{s.name}</div>
                                <div className={styles.track} style={{height: laneCount * LANE_H + 8}}>
                                    {tasks.map((t) => {
                                        const {colStart, colEnd} = clampToMonth(t, dto.month);
                                        const color = types.get(t.work_type_id)?.color ?? '#888888';
                                        const label = `${name(t)} · ${dateRange(t.start_date, t.end_date)} · ${t.progress}%`;
                                        return (
                                            <div
                                                key={t.id}
                                                className={styles.bar}
                                                title={label}
                                                style={{
                                                    left: `${((colStart - 1) / days) * 100}%`,
                                                    width: `${((colEnd - colStart + 1) / days) * 100}%`,
                                                    top: (lanes.get(t) ?? 0) * LANE_H + 4,
                                                    background: `${t.is_fix ? `${FIX_STRIPE}, ` : ''}linear-gradient(90deg, ${color} ${t.progress}%, ${color}55 ${t.progress}%)`,
                                                }}
                                            >
                                                {name(t)}{t.progress === 100 ? ' ✓' : ''}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <section className={styles.details}>
                <h2>{labels.details}</h2>
                {dto.tasks.length === 0 && <p className={styles.dim}>{labels.noTasks}</p>}
                {dto.staff.map((s) => {
                    const tasks = dto.tasks.filter((t) => t.staff_id === s.id);
                    if (!tasks.length) return null;
                    return (
                        <div key={s.id} className={styles.member}>
                            <h3>{s.name}</h3>
                            <ul>
                                {tasks.map((t) => {
                                    const cutLinks = cuts.get(t.cut_id)?.links ?? [];
                                    return (
                                        <li key={t.id}>
                                            <span className={styles.dot} style={{background: types.get(t.work_type_id)?.color}}/>
                                            <strong>{name(t)}</strong>
                                            <span>{dateRange(t.start_date, t.end_date)}</span>
                                            <span>{t.progress}%</span>
                                            {(t.links.length > 0 || cutLinks.length > 0) && (
                                                <span className={styles.links}>
                                                    {labels.links}: <Links links={[...cutLinks, ...t.links]}/>
                                                </span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    );
                })}
            </section>
        </div>
    );
}

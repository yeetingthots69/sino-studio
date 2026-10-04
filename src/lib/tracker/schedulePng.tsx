import 'server-only';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {ImageResponse} from 'next/og';
import {addDays, assignLanes, clampToMonth, isWeekend, monthRange} from '@/components/tracker/dates';
import {fixSuffix, FIX_STRIPE, type ShareDto} from './shareShape';

// Be Vietnam Pro (OFL, fonts/OFL.txt): Vietnamese coverage. Traced via outputFileTracingIncludes.
// Loaded on first render and memoised; a failed read is not cached, so the next request retries.
let font: Promise<Buffer> | null = null;
function loadFont(): Promise<Buffer> {
    font ??= readFile(join(process.cwd(), 'src/lib/tracker/fonts/BeVietnamPro-Regular.ttf')).catch((e: unknown) => {
        font = null;
        throw e;
    });
    return font;
}

const NAME_W = 220;
const DAY_W = 32;
const HEAD_H = 90;
const LANE_H = 26;
const MAX_LANES = 20;   // per member; overlapping tasks beyond this are left out
const MAX_H = 4000;     // total image height; members that do not fit are left out

/** Month schedule PNG (flexbox only — Satori). Rows = share members (≤ 50 by the DB check). */
export async function renderSchedulePng(dto: ShareDto): Promise<ImageResponse> {
    const {start, days} = monthRange(dto.month);
    const dates = Array.from({length: days}, (_, i) => addDays(start, i));
    const types = new Map(dto.types.map((t) => [t.id, t]));
    const cuts = new Map(dto.cuts.map((c) => [c.id, c]));
    const rows = [];
    let height = HEAD_H + 28 + 16;
    for (const s of dto.staff.slice(0, 50)) {
        const lanes = assignLanes(dto.tasks.filter((t) => t.staff_id === s.id));
        const tasks = [...lanes.keys()].filter((t) => lanes.get(t)! < MAX_LANES);
        const count = Math.max(1, ...tasks.map((t) => lanes.get(t)! + 1));
        const h = count * LANE_H + 8;
        if (height + h > MAX_H) break;
        height += h;
        rows.push({s, tasks, lanes, height: h});
    }
    const width = NAME_W + days * DAY_W;

    return new ImageResponse(
        (
            <div style={{display: 'flex', flexDirection: 'column', width, height, background: '#111111', color: '#ffffff', fontFamily: 'BeVietnamPro', fontSize: 13}}>
                <div style={{display: 'flex', flexDirection: 'column', padding: '16px 16px 0', height: HEAD_H}}>
                    <div style={{display: 'flex', fontSize: 24}}>{dto.project.name}</div>
                    <div style={{display: 'flex', gap: 16, marginTop: 8, color: '#bbbbbb'}}>
                        <span>{`${dto.month.slice(5)}/${dto.month.slice(0, 4)}`}</span>
                        {dto.types.map((t) => (
                            <div key={t.id} style={{display: 'flex', alignItems: 'center', gap: 6}}>
                                <div style={{width: 10, height: 10, borderRadius: 5, background: t.color}}/>
                                <span>{`${t.code} · ${t.label}`}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div style={{display: 'flex', height: 28, borderBottom: '1px solid #333333'}}>
                    <div style={{display: 'flex', width: NAME_W}}/>
                    {dates.map((d) => (
                        <div key={d} style={{display: 'flex', width: DAY_W, justifyContent: 'center', alignItems: 'center', color: isWeekend(d) ? '#666666' : '#cccccc', fontSize: 11}}>
                            {String(Number(d.slice(8)))}
                        </div>
                    ))}
                </div>
                {rows.map(({s, tasks, lanes, height: h}) => (
                    <div key={s.id} style={{display: 'flex', height: h, borderBottom: '1px solid #262626'}}>
                        <div style={{display: 'flex', width: NAME_W, padding: '6px 12px', overflow: 'hidden'}}>{s.name}</div>
                        <div style={{display: 'flex', position: 'relative', width: days * DAY_W, height: h}}>
                            {tasks.map((t) => {
                                const {colStart, colEnd} = clampToMonth(t, dto.month);
                                const color = types.get(t.work_type_id)?.color ?? '#888888';
                                const label = `${cuts.get(t.cut_id)?.code ?? ''} · ${types.get(t.work_type_id)?.code ?? ''}${fixSuffix(t)}${t.progress === 100 ? ' · 100%' : ''}`;
                                return (
                                    <div
                                        key={t.id}
                                        style={{
                                            display: 'flex',
                                            position: 'absolute',
                                            left: (colStart - 1) * DAY_W + 1,
                                            top: (lanes.get(t) ?? 0) * LANE_H + 4,
                                            width: (colEnd - colStart + 1) * DAY_W - 2,
                                            height: LANE_H - 4,
                                            alignItems: 'center',
                                            padding: '0 6px',
                                            borderRadius: 3,
                                            overflow: 'hidden',
                                            fontSize: 11,
                                            background: `${t.is_fix ? `${FIX_STRIPE}, ` : ''}linear-gradient(90deg, ${color} ${t.progress}%, ${color}55 ${t.progress}%)`,
                                        }}
                                    >
                                        {label}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        ),
        {
            width,
            height,
            fonts: [{name: 'BeVietnamPro', data: await loadFont(), weight: 400, style: 'normal'}],
            headers: {'Cache-Control': 'private, no-store'},
        },
    );
}

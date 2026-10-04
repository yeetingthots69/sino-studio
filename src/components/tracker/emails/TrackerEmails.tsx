// Tracker email templates (plan §3.7): plain JSX, inline styles, Vietnamese only.
import type {CSSProperties, ReactElement, ReactNode} from 'react';
import {fixSuffix, type ShareLink as Link} from '@/lib/tracker/shareShape';
import type {MailTask, RemovedMailTask} from '@/lib/tracker/mailPlan';

export type Mail = {subject: string; element: ReactElement};

const RED = '#e03131';
const dmy = (d: string) => d.split('-').reverse().join('/');
const range = (a: string, b: string) => (a === b ? dmy(a) : `${dmy(a)} – ${dmy(b)}`);
/** "LO · Layout", a fix "LO · Fix · Layout". */
const stage = (t: {type_code: string; type_label: string; is_fix: boolean}) => `${t.type_code}${fixSuffix(t)} · ${t.type_label}`;

const s = {
    page: {fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", backgroundColor: '#f4f4f4', padding: '32px 16px', margin: 0},
    card: {maxWidth: '640px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '8px', overflow: 'hidden'},
    head: {backgroundColor: '#111111', padding: '24px 32px', borderBottom: `3px solid ${RED}`},
    brand: {margin: 0, color: '#ffffff', fontSize: '18px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase'},
    sub: {margin: '4px 0 0', color: '#888888', fontSize: '12px'},
    body: {padding: '32px', color: '#222222', fontSize: '15px', lineHeight: '1.6'},
    h: {margin: '24px 0 8px', fontSize: '13px', fontWeight: 700, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.06em'},
    table: {width: '100%', borderCollapse: 'collapse', fontSize: '14px'},
    th: {textAlign: 'left', padding: '8px', borderBottom: '2px solid #e8e8e8', color: '#888888', fontSize: '12px', fontWeight: 600},
    td: {padding: '8px', borderBottom: '1px solid #eeeeee', verticalAlign: 'top'},
    link: {color: RED},
    button: {display: 'inline-block', padding: '10px 18px', backgroundColor: RED, color: '#ffffff', textDecoration: 'none', borderRadius: '4px', fontWeight: 600},
    foot: {padding: '16px 32px', backgroundColor: '#111111', color: '#666666', fontSize: '12px', textAlign: 'center'},
} satisfies Record<string, CSSProperties>;

function Layout({title, children}: {title: string; children: ReactNode}) {
    return (
        <div style={s.page}>
            <div style={s.card}>
                <div style={s.head}>
                    <p style={s.brand}>Sino Studio</p>
                    <p style={s.sub}>{title}</p>
                </div>
                <div style={s.body}>{children}</div>
                <div style={s.foot}>Email tự động từ hệ thống quản lý sản xuất Sino Studio.</div>
            </div>
        </div>
    );
}

function Links({title, links}: {title: string; links: Link[]}) {
    if (!links.length) return null;
    return (
        <>
            <p style={s.h}>{title}</p>
            <ul style={{margin: 0, paddingLeft: '20px'}}>
                {links.map((l) => (
                    <li key={l.url}><a href={l.url} style={s.link}>{l.label}</a></li>
                ))}
            </ul>
        </>
    );
}

function TaskTable({tasks, project = true}: {tasks: MailTask[]; project?: boolean}) {
    return (
        <table style={s.table}>
            <thead>
                <tr>
                    {project && <th style={s.th}>Dự án</th>}
                    <th style={s.th}>Cut</th>
                    <th style={s.th}>Công đoạn</th>
                    <th style={s.th}>Thời gian</th>
                    <th style={s.th}>Tiến độ</th>
                </tr>
            </thead>
            <tbody>
                {tasks.map((t) => (
                    <tr key={t.id}>
                        {project && <td style={s.td}>{t.project_name}</td>}
                        <td style={s.td}><b>{t.cut_code}</b></td>
                        <td style={s.td}>{stage(t)}</td>
                        <td style={s.td}>{range(t.start_date, t.end_date)}</td>
                        <td style={s.td}>{t.progress}%</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

const Hello = ({name}: {name: string}) => <p style={{margin: '0 0 16px'}}>Xin chào <b>{name}</b>,</p>;

/* ── Resources ─────────────────────────────────────────────────── */

export type ResourcesProps = {
    staffName: string;
    projectName: string;
    cutCode: string;
    stages: {id: string; type_code: string; type_label: string; is_fix: boolean; start_date: string; end_date: string; links: Link[]}[];
    cutLinks: Link[];
    projectLinks: Link[];
};

export function resourcesMail(p: ResourcesProps): Mail {
    return {
        subject: `Tài liệu ${p.cutCode} · ${p.projectName}`,
        element: (
            <Layout title="Tài liệu công việc">
                <Hello name={p.staffName}/>
                <p style={{margin: 0}}>Tài liệu cho <b>{p.cutCode}</b> — dự án <b>{p.projectName}</b>:</p>
                {p.stages.map((st) => (
                    <div key={st.id}>
                        <p style={s.h}>{stage(st)} — {range(st.start_date, st.end_date)}</p>
                        {st.links.length ? (
                            <ul style={{margin: 0, paddingLeft: '20px'}}>
                                {st.links.map((l) => <li key={l.url}><a href={l.url} style={s.link}>{l.label}</a></li>)}
                            </ul>
                        ) : null}
                    </div>
                ))}
                <Links title={`Tài liệu cut ${p.cutCode}`} links={p.cutLinks}/>
                <Links title="Tài liệu dự án" links={p.projectLinks}/>
            </Layout>
        ),
    };
}

/* ── Schedule ──────────────────────────────────────────────────── */

export type ScheduleProps = {
    staffName: string;
    projectName: string;
    month: string; // YYYY-MM
    tasks: MailTask[];
    shareUrl: string;
    calendarUrl: string;
};

export function scheduleMail(p: ScheduleProps): Mail {
    const label = `${Number(p.month.slice(5))}/${p.month.slice(0, 4)}`;
    return {
        subject: `Lịch làm việc tháng ${label} · ${p.projectName}`,
        element: (
            <Layout title={`Lịch làm việc tháng ${label}`}>
                <Hello name={p.staffName}/>
                <p style={{margin: '0 0 16px'}}>Lịch của bạn trong dự án <b>{p.projectName}</b>, tháng {label}:</p>
                {p.tasks.length ? <TaskTable tasks={p.tasks} project={false}/> : <p>Không có công việc trong tháng này.</p>}
                <p style={{margin: '24px 0 8px'}}><a href={p.shareUrl} style={s.button}>Xem lịch trực tuyến</a></p>
                <p style={s.h}>Lịch cá nhân (Google Calendar)</p>
                <p style={{margin: 0, fontSize: '13px'}}>
                    Thêm URL này vào Google Calendar (Thêm lịch → Từ URL): <br/>
                    <a href={p.calendarUrl} style={s.link}>{p.calendarUrl}</a>
                </p>
            </Layout>
        ),
    };
}

/* ── Assignment digest ─────────────────────────────────────────── */

function RemovedTable({tasks}: {tasks: RemovedMailTask[]}) {
    return (
        <table style={s.table}>
            <thead>
                <tr>
                    <th style={s.th}>Dự án</th>
                    <th style={s.th}>Cut</th>
                    <th style={s.th}>Công đoạn</th>
                    <th style={s.th}>Thời gian</th>
                </tr>
            </thead>
            <tbody>
                {tasks.map((t) => (
                    <tr key={t.task_id}>
                        <td style={s.td}>{t.project_name}</td>
                        <td style={s.td}><b>{t.cut_code}</b></td>
                        <td style={s.td}>{stage(t)}</td>
                        <td style={s.td}>{range(t.start_date, t.end_date)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export function assignmentMail(p: {staffName: string; changed: MailTask[]; others: MailTask[]; removed: RemovedMailTask[]}): Mail {
    return {
        subject: 'Cập nhật công việc được giao',
        element: (
            <Layout title="Cập nhật công việc">
                <Hello name={p.staffName}/>
                <p style={{margin: 0}}>
                    {p.changed.length ? 'Công việc của bạn vừa được giao mới hoặc thay đổi:' : 'Công việc của bạn vừa có thay đổi:'}
                </p>
                {p.changed.length > 0 && (
                    <>
                        <p style={s.h}>Vừa thay đổi</p>
                        <TaskTable tasks={p.changed}/>
                    </>
                )}
                {p.removed.length > 0 && (
                    <>
                        <p style={s.h}>Đã chuyển khỏi bạn</p>
                        <RemovedTable tasks={p.removed}/>
                    </>
                )}
                {p.others.length > 0 && (
                    <>
                        <p style={s.h}>Các công việc khác đang mở</p>
                        <TaskTable tasks={p.others}/>
                    </>
                )}
            </Layout>
        ),
    };
}

/* ── Reminder ──────────────────────────────────────────────────── */

export function reminderMail(p: {staffName: string; date: string; tasks: MailTask[]}): Mail {
    return {
        subject: `Nhắc hạn: ${p.tasks.length} công việc kết thúc ngày ${dmy(p.date)}`,
        element: (
            <Layout title="Nhắc hạn công việc">
                <Hello name={p.staffName}/>
                <p style={{margin: '0 0 16px'}}>Các công việc sau kết thúc vào <b>ngày mai ({dmy(p.date)})</b> và chưa hoàn thành:</p>
                <TaskTable tasks={p.tasks}/>
            </Layout>
        ),
    };
}

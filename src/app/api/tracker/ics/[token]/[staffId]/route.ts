import {buildIcs} from '@/components/tracker/ics';
import {loadShareMember} from '@/lib/tracker/shareData';
import {icsSummary} from '@/lib/tracker/shareShape';

const NO_STORE = {'Cache-Control': 'private, no-store'};

export async function GET(_req: Request, ctx: {params: Promise<{token: string; staffId: string}>}) {
    const {token, staffId} = await ctx.params;
    const data = await loadShareMember(token, staffId);
    if (!data) return new Response('Not found', {status: 404, headers: NO_STORE});

    const ics = buildIcs(`${data.project.name} — ${data.staff.name}`, data.tasks.map((t) => ({
        uid: `${t.id}@sinostudio.vn`,
        start: t.start_date,
        endInclusive: t.end_date,
        summary: icsSummary(t),
        description: t.links.map((l) => `${l.label}: ${l.url}`).join('\n') || undefined,
        sequence: t.version,
        stamp: t.updated_at,
    })));
    return new Response(ics, {headers: {...NO_STORE, 'Content-Type': 'text/calendar; charset=utf-8'}});
}

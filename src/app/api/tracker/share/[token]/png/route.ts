import {defaultMonth, isValidMonth} from '@/components/tracker/dates';
import {loadShare} from '@/lib/tracker/shareData';
import {renderSchedulePng} from '@/lib/tracker/schedulePng';

const NO_STORE = 'private, no-store';

export async function GET(req: Request, ctx: {params: Promise<{token: string}>}) {
    const {token} = await ctx.params;
    const m = new URL(req.url).searchParams.get('m');
    const month = isValidMonth(m) ? m : defaultMonth();
    const dto = await loadShare(token, month);
    if (!dto) return new Response('Not found', {status: 404, headers: {'Cache-Control': NO_STORE}});

    let png: Response;
    try {
        png = await renderSchedulePng(dto);
    } catch {
        console.error('share png: render failed'); // never log the token
        return new Response('Error', {status: 500, headers: {'Cache-Control': NO_STORE}});
    }
    // ImageResponse defaults to public caching; force no-store and a download name.
    png.headers.set('Cache-Control', NO_STORE);
    png.headers.set('Content-Disposition', `attachment; filename="schedule-${month}.png"`);
    return png;
}

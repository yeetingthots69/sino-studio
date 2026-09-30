import {EarningsListView} from '@/components/tracker/Earnings/views';
import RealtimeRefresh from '@/components/tracker/RealtimeRefresh';

interface Props {
    params: Promise<{locale: string}>;
    searchParams: Promise<{m?: string | string[]}>;
}

export default async function StudioEarningsPage({params, searchParams}: Props) {
    const [{locale}, {m}] = await Promise.all([params, searchParams]);
    return (
        <>
            <RealtimeRefresh tables={['tracker_projects', 'tracker_tasks', 'tracker_cuts', 'tracker_work_types', 'tracker_pay_adjustments']}/>
            <EarningsListView locale={locale} rawMonth={m}/>
        </>
    );
}

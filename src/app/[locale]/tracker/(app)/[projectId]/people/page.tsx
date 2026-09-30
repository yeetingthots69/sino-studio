import {EarningsListView} from '@/components/tracker/Earnings/views';
import RealtimeRefresh from '@/components/tracker/RealtimeRefresh';

interface Props {
    params: Promise<{locale: string; projectId: string}>;
    searchParams: Promise<{m?: string | string[]}>;
}

export default async function ProjectEarningsPage({params, searchParams}: Props) {
    const [{locale, projectId}, {m}] = await Promise.all([params, searchParams]);
    return (
        <>
            <RealtimeRefresh tables={['tracker_projects', 'tracker_tasks', 'tracker_cuts', 'tracker_work_types', 'tracker_pay_adjustments']}/>
            <EarningsListView locale={locale} projectId={projectId} rawMonth={m}/>
        </>
    );
}

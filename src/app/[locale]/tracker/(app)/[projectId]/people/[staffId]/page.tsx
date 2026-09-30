import {StaffProfileView} from '@/components/tracker/Earnings/views';
import RealtimeRefresh from '@/components/tracker/RealtimeRefresh';

interface Props {
    params: Promise<{locale: string; projectId: string; staffId: string}>;
    searchParams: Promise<{m?: string | string[]}>;
}

export default async function ProjectStaffEarningsPage({params, searchParams}: Props) {
    const [{locale, projectId, staffId}, {m}] = await Promise.all([params, searchParams]);
    return (
        <>
            <RealtimeRefresh tables={['tracker_projects', 'tracker_tasks', 'tracker_cuts', 'tracker_work_types', 'tracker_pay_adjustments']}/>
            <StaffProfileView locale={locale} projectId={projectId} staffId={staffId} rawMonth={m}/>
        </>
    );
}

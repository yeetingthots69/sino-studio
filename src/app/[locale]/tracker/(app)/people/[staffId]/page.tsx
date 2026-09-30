import {StaffProfileView} from '@/components/tracker/Earnings/views';
import RealtimeRefresh from '@/components/tracker/RealtimeRefresh';

interface Props {
    params: Promise<{locale: string; staffId: string}>;
    searchParams: Promise<{m?: string | string[]}>;
}

export default async function StudioStaffEarningsPage({params, searchParams}: Props) {
    const [{locale, staffId}, {m}] = await Promise.all([params, searchParams]);
    return (
        <>
            <RealtimeRefresh tables={['tracker_projects', 'tracker_tasks', 'tracker_cuts', 'tracker_work_types', 'tracker_pay_adjustments']}/>
            <StaffProfileView locale={locale} staffId={staffId} rawMonth={m}/>
        </>
    );
}

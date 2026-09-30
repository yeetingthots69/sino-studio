import createClient from '@/utils/supabase/server';
import StaffTable from '@/components/tracker/StaffTable/StaffTable';
import RealtimeRefresh from '@/components/tracker/RealtimeRefresh';

export default async function StaffPage() {
    const supabase = await createClient();
    const [staff, strengths] = await Promise.all([
        supabase
            .from('tracker_staff')
            .select('*, tracker_staff_strengths(strength_id)')
            .order('sort_order')
            .order('name'),
        supabase.from('tracker_strengths').select('*').order('sort_order').order('label'),
    ]);
    if (staff.error) throw staff.error;
    if (strengths.error) throw strengths.error;
    const rows = staff.data.map(({tracker_staff_strengths, ...s}) => ({
        ...s,
        strength_ids: tracker_staff_strengths.map((x) => x.strength_id),
    }));

    return (
        <>
            <RealtimeRefresh tables={['tracker_projects', 'tracker_staff', 'tracker_strengths', 'tracker_staff_strengths']}/>
            <StaffTable staff={rows} strengths={strengths.data}/>
        </>
    );
}

import createClient from '@/utils/supabase/server';
import StaffTable from '@/components/tracker/StaffTable/StaffTable';

export default async function StaffPage() {
    const supabase = await createClient();
    const {data} = await supabase
        .from('tracker_staff')
        .select('*')
        .order('sort_order')
        .order('name');

    return <StaffTable staff={data ?? []}/>;
}

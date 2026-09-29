import createClient from '@/utils/supabase/server';
import WorkTypesTable from '@/components/tracker/WorkTypesTable/WorkTypesTable';

export default async function WorkTypesPage() {
    const supabase = await createClient();
    const {data} = await supabase
        .from('tracker_work_types')
        .select('*')
        .order('sort_order')
        .order('code');

    return <WorkTypesTable workTypes={data ?? []}/>;
}

'use client';

import {Select} from '@mantine/core';
import {useParams, useRouter} from 'next/navigation';
import {useDictionary} from '@/i18n/DictionaryProvider';

export interface ShellProject {
    id: string;
    name: string;
    color: string;
}

export default function ProjectSwitcher({projects, locale}: {projects: ShellProject[]; locale: string}) {
    const t = useDictionary().tracker.shell;
    const {projectId} = useParams<{projectId?: string}>();
    const router = useRouter();

    return (
        <Select
            size="xs"
            w={{base: 120, lg: 200}}
            miw={120}
            style={{flexShrink: 0}}
            aria-label={t.selectProject}
            placeholder={t.selectProject}
            data={projects.map((p) => ({value: p.id, label: p.name}))}
            value={projectId ?? null}
            onChange={(id) => {
                if (id) router.push(`/${locale}/tracker/${id}`);
            }}
            allowDeselect={false}
            searchable
        />
    );
}

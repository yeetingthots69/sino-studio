'use client';

import {ActionIcon} from '@mantine/core';
import {IconPlus} from '@tabler/icons-react';

// Opens the create popover on this staff row (GanttBoard.openAdd).
export default function AddTaskButton({label, onClick}: {label: string; onClick: () => void}) {
    return (
        <ActionIcon variant="subtle" color="gray" size="sm" aria-label={label} title={label} onClick={onClick}>
            <IconPlus size={14}/>
        </ActionIcon>
    );
}

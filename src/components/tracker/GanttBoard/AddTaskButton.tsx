'use client';

import {ActionIcon} from '@mantine/core';
import {IconPlus} from '@tabler/icons-react';

// The createTask call lives in GanttBoard.add() so it goes through the shared optimistic commit.
export default function AddTaskButton({label, onClick}: {label: string; onClick: () => void}) {
    return (
        <ActionIcon variant="subtle" color="gray" size="sm" aria-label={label} title={label} onClick={onClick}>
            <IconPlus size={14}/>
        </ActionIcon>
    );
}

'use client';

import {useDictionary} from '@/i18n/DictionaryProvider';
import {DONE_COLOR, type WorkType} from './GanttBoard';
import styles from './GanttBoard.module.css';

export default function Legend({workTypes}: {workTypes: WorkType[]}) {
    const t = useDictionary().tracker.board;
    const items = [
        ...workTypes.map((w) => ({key: w.id, color: w.color, label: w.code})),
        {key: 'done', color: DONE_COLOR, label: t.done},
    ];
    return (
        <ul className={styles.legend}>
            {items.map((i) => (
                <li key={i.key}><span className={styles.dot} style={{background: i.color}}/>{i.label}</li>
            ))}
        </ul>
    );
}

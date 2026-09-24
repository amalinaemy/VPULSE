import { useMemo, useState } from 'react';
import type { Pole } from '../services/api';

const stateName = (pole: Pole) => pole.state?.trim().toUpperCase() || 'UNSPECIFIED';

export function useStateFilter(allPoles: Pole[]) {
    const [selection, setSelection] = useState<string[] | null>(null);
    const states = useMemo(() => [...new Set(allPoles.map(stateName))].sort(), [allPoles]);
    const poles = useMemo(() => selection === null ? allPoles
        : allPoles.filter(pole => selection.includes(stateName(pole))), [allPoles, selection]);
    return { poles, states, selection, setSelection };
}


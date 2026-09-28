import './StateFilter.css';

export function StateFilter({ states, selection, onChange, count }: {
    states: string[]; selection: string[] | null;
    onChange: (value: string[] | null) => void; count: number;
}) {
    return <fieldset className="page-state-filter">
        <legend>Filter by state</legend>
        <div className="state-filter-actions">
            <span>{count.toLocaleString()} poles</span>
            <button type="button" onClick={() => onChange(null)}>Select all</button>
            <button type="button" onClick={() => onChange([])}>Clear all</button>
        </div>
        <div className="state-filter-options">
            {states.map(state => <label key={state}>
                <input type="checkbox" checked={selection === null || selection.includes(state)}
                    onChange={event => {
                        const current = selection ?? states;
                        onChange(event.target.checked ? [...current, state] : current.filter(value => value !== state));
                    }} />
                {state === 'UNSPECIFIED' ? 'State not provided' : state}
            </label>)}
        </div>
    </fieldset>;
}

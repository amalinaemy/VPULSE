export function matchesSelection(selected: readonly string[], value: string): boolean {
    return selected.length === 0 || selected.includes(value);
}

# Substation map selection notes

The shared component is `src/components/GeospatialAnalysis.tsx`. Both Engineer
and Field Team views use it. Search for the function or variable names below
rather than relying on line numbers, which move as the file is edited.

## What happens when a user clicks a substation

1. The ranking button calls `setSelectedFeeder` with the clicked group ID.
   Clicking the selected entry again sets it to `null`. It also closes pole details.
2. `activeFeeder` checks that the selection is still present in the current ranking
   and that the ranking panel is enabled. Otherwise the map shows all groups.
3. `mapPoles` keeps only poles with valid coordinates that match the selected
   substation and the current risk filter.
4. Markers render from `mapPoles`. `FitMapToPoles` receives the same array and
   calls Leaflet's `map.fitBounds` whenever it changes.
5. The selection banner shows the substation name and mapped-pole count.
   **Show all substations** clears the selection and pole details but retains
   the risk filter. The map then fits the remaining visible poles.

If no poles match, an empty-state message is shown instead of a map.

## Where to edit

| Behavior | Code to find |
| --- | --- |
| Group identity | `substationName(pole)` |
| Ranking groups and order | `rankFeeders(poles)` |
| Selected group | `selectedFeeder` / `activeFeeder` |
| Click to select or clear | Ranking button `onClick` with `setSelectedFeeder` |
| Which poles appear | `mapPoles` |
| Zoom and edge spacing | `FitMapToPoles` / `map.fitBounds` |
| Reset action | Button text `Show all substations` |
| Critical poles beneath the ranking | `urgentFeederPoles` |
| Selection banner styling | `.map-substation-selection` in `src/App.css` |

## Grouping and zoom details

`substationName` uses the trimmed `pole.substation`, then trimmed `pole.feederId`,
then `Unassigned feeder`. The same key is used for ranking, filtering and urgent
poles. Matching is case-sensitive after trimming.

`fitBounds` currently uses `padding: [28, 28]`, `maxZoom: 16`, and
`animate: false`. Change these options to adjust spacing, maximum zoom, or animation.
A ResizeObserver calls `invalidateSize` when the map container changes size,
including fullscreen changes.

The ranking shows five groups. Its current sort uses critical-pole count,
then average risk score. The heading says highest risk score, and the badge
shows the group's maximum score; this is an existing wording/implementation
mismatch, not a change made by these notes.

## Field Team scope

`src/pages/FieldTeamPage.tsx` passes `priorityPoles` to the shared component,
so its map and ranking cover Critical and High poles in the current parent
scope. The map selection does not filter the separate Field Work Pack list.
The work-pack search, risk filter and trimming filter remain independent.

## Quick manual check

- Select a ranked substation: other substations disappear and the map fits its poles.
- Change the map risk filter: only matching poles in that substation remain.
- Click the same ranking entry or **Show all substations**: all groups return,
  subject to the risk filter.
- Try a group with one coordinate and a filter with no matching coordinates.
- Enter and exit fullscreen: the map should resize correctly.

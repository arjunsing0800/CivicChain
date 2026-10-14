/**
 * Regional deployment constants: the single source of truth for the city the
 * platform operates in. Used by the map components and dashboard map labels so
 * the displayed location is never a hardcoded duplicate string.
 *
 * Coordinates: Meerut, Uttar Pradesh (regional default, [lng, lat]).
 */
export const REGION_CITY = {
  label: 'Meerut, Uttar Pradesh',
  center: [77.7, 28.98] as [number, number],
};
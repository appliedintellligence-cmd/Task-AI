export const JURISDICTIONS = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'] as const;
export type Jurisdiction = typeof JURISDICTIONS[number];

export const JURISDICTION_LABELS: Record<Jurisdiction, string> = {
  ACT: 'Australian Capital Territory', NSW: 'New South Wales', NT: 'Northern Territory',
  QLD: 'Queensland', SA: 'South Australia', TAS: 'Tasmania', VIC: 'Victoria', WA: 'Western Australia',
};

export function isJurisdiction(value: unknown): value is Jurisdiction {
  return typeof value === 'string' && JURISDICTIONS.includes(value as Jurisdiction);
}

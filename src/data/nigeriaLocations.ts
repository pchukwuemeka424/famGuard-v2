import rawData from './nigeria-states-lga.json';

export interface NigeriaState {
  state: string;
  alias: string;
  isoCode: string;
  lgas: string[];
}

const NIGERIA_STATES = rawData as NigeriaState[];

export const getNigeriaStates = (): NigeriaState[] => NIGERIA_STATES;

export const getStateNames = (): string[] => NIGERIA_STATES.map((entry) => entry.state);

export const getLgasForState = (stateName: string): string[] => {
  const match = NIGERIA_STATES.find(
    (entry) => entry.state.toLowerCase() === stateName.toLowerCase(),
  );
  return match?.lgas ?? [];
};

export const searchStates = (query: string): string[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return getStateNames();
  return getStateNames().filter((name) => name.toLowerCase().includes(normalized));
};

export const searchLgas = (stateName: string, query: string): string[] => {
  const lgas = getLgasForState(stateName);
  const normalized = query.trim().toLowerCase();
  if (!normalized) return lgas;
  return lgas.filter((lga) => lga.toLowerCase().includes(normalized));
};

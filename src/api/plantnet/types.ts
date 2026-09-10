export interface PlantNetSpecies {
  scientificNameWithoutAuthor: string;
  scientificNameAuthorship: string;
  scientificName: string;
  commonNames: string[];
}

export interface PlantNetResult {
  score: number;
  species: PlantNetSpecies;
  gbif?: { id: string };
}

export interface PlantNetResponse {
  bestMatch?: string;
  results: PlantNetResult[];
  remainingIdentificationRequests?: number;
}

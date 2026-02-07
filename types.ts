
export interface MountainInfo {
  name: string;
  elevation: string;
  significance: string;
  difficulty: string;
  weatherForecast?: string;
  description: string;
}

export interface VillageInfo {
  name: string;
  region: string;
  altitude: string;
  culture: string;
  highlights: string[];
}

export interface TrekPoint {
  day: number;
  altitude: number;
  label: string;
  lat: number;
  lng: number;
}


export enum ThemeMode {
  NIGHT = 'NIGHT',
  SUNRISE = 'SUNRISE',
  RAIN = 'RAIN',
  FIRE = 'FIRE',
  EARTH = 'EARTH'
}

export interface UserCapability {
  experience: number; // 0-100
  fitness: number; // 0-100
  packWeight: number; // kg
  groupSize: number;
  startTime: string; // HH:mm
}

export interface WeatherData {
  temp: number;
  condition: string;
  windSpeed: number;
  windDir: string;
  humidity: number;
  precipProb: number;
  visibility: number;
  sunset: string;
  lastUpdated: string;
  elevation: number;
  confidence: number; // 0-100
  locationName: string;
}

export interface HazardLevel {
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  score: number; // 0-100
  label: string;
  description: string;
}

export interface TerrainAnalysis {
  type: string;
  exposure: string;
  hazards: string[];
  rangerNote: string;
}

export interface Assessment {
  thunderstorm: HazardLevel;
  heat: HazardLevel;
  cold: HazardLevel;
  fire: HazardLevel;
  flood: HazardLevel;
  safetyScore: number; // 0-100 (100 is perfectly safe)
  fireDetails?: {
    dangerRating: string;
    windEffect: string;
    dryingTrend: string;
    fuelDryness: string;
    aiInterpretation: string;
  };
}

export interface GuidanceResponse {
  status: 'GO' | 'CAUTION' | 'MODIFY' | 'NOGO';
  reasoning: string;
  packingHints: string[];
  aiSummary: string;
  safetyIndex: number; // 0-100
}

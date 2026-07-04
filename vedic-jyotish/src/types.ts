export type Gender = 'male' | 'female' | 'other';
export type Language = 'en' | 'hi' | 'sa';

export interface BirthDetails {
  fullName: string;
  gender: Gender;
  dateOfBirth: string; // YYYY-MM-DD
  timeOfBirth: string; // HH:MM
  placeOfBirth: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  language: Language;
  contactNumber?: string;
  profilePicture?: string;
}

export interface PlanetPosition {
  name: string;
  rashi: string;
  rashiLord: string;
  degree: number;
  house: number;
  nakshatra: string;
  nakshatraLord: string;
  pada: number;
  isRetrograde: boolean;
}

export interface HouseDetail {
  houseNumber: number;
  rashi: string;
  rashiLord: string;
  planets: string[];
  significance: string;
}

export interface YogaDetail {
  name: string;
  description: string;
  present: boolean;
  significance: string;
}

export interface DoshaDetail {
  name: string; // e.g., 'Manglik', 'Kaal Sarp', 'Pitra'
  present: boolean;
  severity: 'low' | 'medium' | 'high' | 'none';
  description: string;
  remedies: string[];
}

export interface DashaPeriod {
  planet: string;
  startDate: string;
  endDate: string;
  subPeriods?: {
    planet: string;
    startDate: string;
    endDate: string;
  }[];
}

export interface PanchangData {
  date: string;
  tithi: string;
  tithiLord: string;
  vara: string; // Weekday
  nakshatra: string;
  nakshatraLord: string;
  yoga: string;
  karana: string;
  sunRise: string;
  sunSet: string;
  moonRise: string;
  moonSet: string;
  rahuKalam: string;
  gulikaKalam: string;
  yamaganda: string;
  abhijitMuhurta: string;
}

export interface FestivalDetail {
  name: string;
  date: string;
  description: string;
  significance: string;
  rituals: string[];
}

export interface KundliMatchingInput {
  boyDetails: BirthDetails;
  girlDetails: BirthDetails;
}

export interface GunaParam {
  name: string; // Varna, Vashya, Tara, Yoni, Maitri, Gana, Bhakoot, Nadi
  maxPoints: number;
  obtainedPoints: number;
  boyValue: string;
  girlValue: string;
  description: string;
}

export interface KundliMatchingResult {
  boyName: string;
  girlName: string;
  gunaScore: number; // out of 36
  gunaBreakdown: GunaParam[];
  manglikMatch: {
    boyManglik: boolean;
    girlManglik: boolean;
    compatible: boolean;
    description: string;
  };
  overallCompatibility: 'excellent' | 'good' | 'average' | 'poor';
  summary: string;
}

export interface HoroscopePrediction {
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  rashi: string;
  date: string;
  career: string;
  education: string;
  marriage: string;
  health: string;
  finance: string;
  business: string;
  travel: string;
}

export interface AstrologicalProfile {
  birthDetails: BirthDetails;
  rashi: string;
  rashiLord: string;
  nakshatra: string;
  nakshatraLord: string;
  pada: number;
  luckyNumber: number;
  luckyColor: string;
  luckyGemstone: string;
  planetaryPositions: PlanetPosition[];
  houses: HouseDetail[];
  yogas: YogaDetail[];
  doshas: DoshaDetail[];
  mahadasha: DashaPeriod[];
  remedies: string[];
}

export interface SavedKundli {
  id: string;
  userId: string;
  name: string;
  birthDetails: BirthDetails;
  createdAt: string;
}

export interface Bookmark {
  id: string;
  userId: string;
  title: string;
  type: 'horoscope' | 'remedy' | 'article' | 'matching';
  data: any;
  createdAt: string;
}

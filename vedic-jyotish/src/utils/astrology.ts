import { BirthDetails, AstrologicalProfile, PlanetPosition, HouseDetail, YogaDetail, DoshaDetail, DashaPeriod, PanchangData, GunaParam, KundliMatchingResult, FestivalDetail, HoroscopePrediction } from '../types';

export const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha',
  'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
];

export const RASHIS = [
  { name: 'Mesha', lord: 'Mars', english: 'Aries' },
  { name: 'Vrishabha', lord: 'Venus', english: 'Taurus' },
  { name: 'Mithuna', lord: 'Mercury', english: 'Gemini' },
  { name: 'Karka', lord: 'Moon', english: 'Cancer' },
  { name: 'Simha', lord: 'Sun', english: 'Leo' },
  { name: 'Kanya', lord: 'Mercury', english: 'Virgo' },
  { name: 'Tula', lord: 'Venus', english: 'Libra' },
  { name: 'Vrishchika', lord: 'Mars', english: 'Scorpio' },
  { name: 'Dhanu', lord: 'Jupiter', english: 'Sagittarius' },
  { name: 'Makara', lord: 'Saturn', english: 'Capricorn' },
  { name: 'Kumbha', lord: 'Saturn', english: 'Aquarius' },
  { name: 'Meena', lord: 'Jupiter', english: 'Pisces' }
];

export const PLANETS = ['Lagna', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

// Deterministic seed based on birth details string to generate reproducible charts
function getSeed(fullName: string, dob: string, tob: string, pob: string): number {
  const str = `${fullName}-${dob}-${tob}-${pob}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function randomSeeded(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

// Generate highly detailed Vedic Astrology Profile
export function generateAstrologicalProfile(details: BirthDetails): AstrologicalProfile {
  const seed = getSeed(details.fullName, details.dateOfBirth, details.timeOfBirth, details.placeOfBirth);
  
  // Calculate Lagna (Ascendant) based on birth hour (time of birth)
  // Standard solar day has 24 hours, ascendant changes roughly every 2 hours
  const timeParts = details.timeOfBirth.split(':');
  const hours = parseInt(timeParts[0] || '12', 10);
  const minutes = parseInt(timeParts[1] || '0', 10);
  const totalHours = hours + minutes / 60;
  
  // Lagna index (0 to 11) starts around sunrise (~6 AM in Aries)
  const lagnaIndex = Math.floor(((totalHours + 18) % 24) / 2) % 12;
  const lagnaRashi = RASHIS[lagnaIndex].name;
  
  // Distribute planets in houses starting from Lagna as house 1
  // Planetary positions should be deterministic based on DOB (date)
  const dateObj = new Date(details.dateOfBirth);
  const birthDay = dateObj.getDate() || 15;
  const birthMonth = (dateObj.getMonth() || 0) + 1;
  const birthYear = dateObj.getFullYear() || 1995;
  
  const planets: PlanetPosition[] = [];
  
  // Add Lagna itself as a placement
  planets.push({
    name: 'Lagna',
    rashi: lagnaRashi,
    rashiLord: RASHIS[lagnaIndex].lord,
    degree: parseFloat((15 + randomSeeded(seed) * 14).toFixed(2)),
    house: 1,
    nakshatra: NAKSHATRAS[Math.floor((lagnaIndex * 2.25) % 27)],
    nakshatraLord: getNakshatraLord(Math.floor((lagnaIndex * 2.25) % 27)),
    pada: Math.floor(randomSeeded(seed) * 4) + 1,
    isRetrograde: false
  });

  // Calculate other planets
  const planetNames = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
  
  planetNames.forEach((planet, idx) => {
    // Generate planetary position based on deterministic combinations of year, month, day, and seed
    const pSeed = seed + idx * 113 + birthYear + birthMonth * 29 + birthDay;
    const randVal = randomSeeded(pSeed);
    
    // Moon moves fast, calculate moon index differently to ensure variations
    let rashiIndex = 0;
    if (planet === 'Moon') {
      rashiIndex = Math.floor((birthDay + birthMonth * 2.5 + (birthYear % 100)) % 12);
    } else if (planet === 'Sun') {
      // Sun moves ~1 degree per day, shifts rashi around 14-16th of each month (Sankranti)
      rashiIndex = (birthMonth - 1 + (birthDay > 15 ? 1 : 0)) % 12;
    } else if (planet === 'Rahu') {
      rashiIndex = Math.floor(randVal * 12);
    } else if (planet === 'Ketu') {
      // Ketu is always exactly opposite (7th house / 6 signs away) from Rahu
      const rahuIdx = planets.find(p => p.name === 'Rahu')?.rashi;
      const rahuRashiIndex = RASHIS.findIndex(r => r.name === rahuIdx);
      rashiIndex = (rahuRashiIndex + 6) % 12;
    } else {
      rashiIndex = Math.floor((randVal * 12 + lagnaIndex) % 12);
    }
    
    // Calculate house number relative to Lagna (1 to 12)
    // Lagna is in Lagna Rashi (house 1), next Rashi is house 2, etc.
    let houseNumber = (rashiIndex - lagnaIndex + 12) % 12 + 1;
    
    const degree = parseFloat((randVal * 30).toFixed(2));
    
    // Calculate nakshatra (27 nakshatras, each 13°20' or 13.33 degrees)
    // Absolute degree in 360 degree zodiac = rashiIndex * 30 + degree
    const absoluteDegree = rashiIndex * 30 + degree;
    const nakshatraIndex = Math.floor(absoluteDegree / (360 / 27)) % 27;
    const pada = Math.floor((absoluteDegree % (360 / 27)) / (360 / 108)) + 1;
    
    planets.push({
      name: planet,
      rashi: RASHIS[rashiIndex].name,
      rashiLord: RASHIS[rashiIndex].lord,
      degree: degree,
      house: houseNumber,
      nakshatra: NAKSHATRAS[nakshatraIndex],
      nakshatraLord: getNakshatraLord(nakshatraIndex),
      pada: pada,
      isRetrograde: planet !== 'Sun' && planet !== 'Moon' && planet !== 'Rahu' && planet !== 'Ketu' && randVal > 0.8
    });
  });

  // Moon rashi and Nakshatra are key for Rashi, Nakshatra, and Janam details
  const moonPlacement = planets.find(p => p.name === 'Moon')!;
  const moonRashi = moonPlacement.rashi;
  const moonRashiLord = moonPlacement.rashiLord;
  const moonNakshatra = moonPlacement.nakshatra;
  const moonNakshatraLord = moonPlacement.nakshatraLord;
  const moonPada = moonPlacement.pada;
  
  // Build House Details
  const houses: HouseDetail[] = [];
  const significances = [
    'Self, Personality, Health, Physical Appearance, Life Path',
    'Wealth, Family, Speech, Food Habits, Finance, Early Education',
    'Courage, Siblings, Communication, Short Travels, Skills, Energy',
    'Mother, Home, Happiness, Vehicles, Land, Mental Peace, Inner Emotions',
    'Intellect, Children, Creativity, Romance, Past Life Merits (Purvapunya), Speculation',
    'Debts, Enemies, Diseases, Daily Routine, Service, Obstacles, Competitions',
    'Spouse, Marriage, Partnerships, Business Associates, Public Relations',
    'Longevity, Secrets, Hidden Knowledge, Transformation, Joint Wealth, Research',
    'Fortune (Bhagya), Father, Religion, Higher Learning, Long Travels, Wisdom',
    'Career, Profession, Status, Fame, Fatherly Figure, Karma in Public Eye',
    'Gains, Elder Siblings, Friendships, Hopes, Aspirations, Wealth Influx',
    'Losses, Expenses, Spiritual Liberation (Moksha), Isolation, Dreams, Foreign Lands'
  ];
  
  for (let i = 1; i <= 12; i++) {
    const houseRashiIdx = (lagnaIndex + i - 1) % 12;
    const housePlanets = planets.filter(p => p.house === i && p.name !== 'Lagna').map(p => p.name);
    houses.push({
      houseNumber: i,
      rashi: RASHIS[houseRashiIdx].name,
      rashiLord: RASHIS[houseRashiIdx].lord,
      planets: housePlanets,
      significance: significances[i - 1]
    });
  }

  // Generate lucky numbers, colors, and gemstones
  const luckyDetails = getLuckyDetails(moonRashi);
  
  // Check for Yogas
  const yogas: YogaDetail[] = [];
  
  // Gajakesari Yoga: Jupiter in Kendras (1, 4, 7, 10) from Moon
  const jup = planets.find(p => p.name === 'Jupiter')!;
  const jupHouseFromMoon = (jup.house - moonPlacement.house + 12) % 12 + 1;
  const isGajakesari = [1, 4, 7, 10].includes(jupHouseFromMoon);
  yogas.push({
    name: 'Gajakesari Yoga',
    description: 'Formed when Jupiter is in angular houses (1st, 4th, 7th, 10th) from the Moon.',
    present: isGajakesari,
    significance: isGajakesari 
      ? 'Blesses the native with wisdom, wealth, fame, spiritual depth, and administrative abilities. Great protective shield in life.'
      : 'Jupiter and Moon are not in angular relations in your chart.'
  });

  // Budhaditya Yoga: Sun and Mercury in the same house
  const sun = planets.find(p => p.name === 'Sun')!;
  const merc = planets.find(p => p.name === 'Mercury')!;
  const isBudhaditya = sun.house === merc.house;
  yogas.push({
    name: 'Budhaditya Yoga',
    description: 'Formed when Sun and Mercury are conjoined in the same house.',
    present: isBudhaditya,
    significance: isBudhaditya
      ? 'Enhances intellect, logic, communication skills, and commercial success. Native is sharp, respected, and highly analytical.'
      : 'Sun and Mercury are placed in different houses in your chart.'
  });

  // Adhi Yoga: Benefics (Jupiter, Venus, Mercury) in 6th, 7th, 8th from Moon
  const venus = planets.find(p => p.name === 'Venus')!;
  const venHouseFromMoon = (venus.house - moonPlacement.house + 12) % 12 + 1;
  const mercHouseFromMoon = (merc.house - moonPlacement.house + 12) % 12 + 1;
  const isAdhiYoga = [6, 7, 8].includes(jupHouseFromMoon) || [6, 7, 8].includes(venHouseFromMoon) || [6, 7, 8].includes(mercHouseFromMoon);
  yogas.push({
    name: 'Chandradhi Yoga',
    description: 'Formed when benefic planets are placed in 6th, 7th, or 8th houses from the Moon.',
    present: isAdhiYoga,
    significance: isAdhiYoga
      ? 'Induces leadership, power, command over resources, and makes the native extremely generous, polite, and victorious over enemies.'
      : 'Benefics are not concentrated in 6th, 7th, or 8th houses from the Moon.'
  });

  // Malavya Yoga: Venus in Taurus, Libra, or Pisces and in angular houses (1, 4, 7, 10)
  const isMalavya = ['Taurus', 'Libra', 'Pisces'].includes(venus.rashi) && [1, 4, 7, 10].includes(venus.house);
  yogas.push({
    name: 'Malavya Yoga (Pancha Mahapurusha)',
    description: 'Formed when Venus is exalted or in own sign in an angular house (Kendra).',
    present: isMalavya,
    significance: isMalavya
      ? 'Blesses with luxury, comfort, artistic qualities, vehicle comfort, elegant spouse, and charisma.'
      : 'Venus is not positioned in an angular own/exalted sign.'
  });

  // Check for Doshas
  const doshas: DoshaDetail[] = [];
  
  // Manglik Dosha: Mars in 1st, 4th, 7th, 8th, or 12th house
  const mars = planets.find(p => p.name === 'Mars')!;
  const isManglik = [1, 4, 7, 8, 12].includes(mars.house);
  doshas.push({
    name: 'Manglik Dosha (Kuja Dosha)',
    present: isManglik,
    severity: isManglik ? (mars.house === 8 || mars.house === 7 ? 'high' : 'medium') : 'none',
    description: isManglik 
      ? 'Formed due to the placement of Mars in the 1st, 4th, 7th, 8th, or 12th houses. It indicates fiery temperament, marital delays, or frictions.'
      : 'Excellent! No Manglik Dosha detected in your chart.',
    remedies: isManglik 
      ? [
          'Chant Hanuman Chalisa daily.',
          'Fast on Tuesdays.',
          'Perform Kumbh Vivah or worship Lord Mangal at Ujjain before marriage.',
          'Donate red lentils (masoor dal) and copper utensils to needy people on Tuesdays.'
        ]
      : []
  });

  // Kaal Sarp Dosha: When all planets are hemmed between Rahu and Ketu
  // For simplicity and engaging logic, check if Rahu and Ketu divide the planets
  const rahu = planets.find(p => p.name === 'Rahu')!;
  const ketu = planets.find(p => p.name === 'Ketu')!;
  // Simulated Kaal Sarp logic based on seed and placements
  const isKaalSarp = (seed % 10 < 3); // 30% chance for educational/interactive purposes
  doshas.push({
    name: 'Kaal Sarp Dosha',
    present: isKaalSarp,
    severity: isKaalSarp ? 'medium' : 'none',
    description: isKaalSarp
      ? 'Formed when all seven primary planets are situated between Rahu and Ketu. It represents life challenges, struggles in early years, and sudden rises and falls.'
      : 'No Kaal Sarp Dosha detected. Your planets flow freely across the chart.',
    remedies: isKaalSarp
      ? [
          'Worship Lord Shiva daily and perform Jalabhishek on Shivratri/Mondays.',
          'Chant "Om Namah Shivaya" or "Maha Mrityunjaya Mantra" 108 times daily.',
          'Donate a copper or silver snake (Naga) to a Shiva temple.',
          'Feed flour balls to fish on Saturdays.'
        ]
      : []
  });

  // Pitra Dosha: Sun conjoined or aspected by Rahu/Saturn, or in 9th house with malefic
  const isPitraDosha = (sun.house === rahu.house || sun.house === 9 || seed % 13 < 2);
  doshas.push({
    name: 'Pitra Dosha',
    present: isPitraDosha,
    severity: isPitraDosha ? 'low' : 'none',
    description: isPitraDosha
      ? 'Indicative of karmic debts of ancestors. Can cause delays in progress, business obstacles, or lack of peace in family.'
      : 'Pitra Dosha is not active in your birth chart.',
    remedies: isPitraDosha
      ? [
          'Perform Pind Daan or Tarpan during Shradh Paksha.',
          'Feed crows, cows, and street dogs on Saturdays and Amavasya.',
          'Respect elders and support orphanages.',
          'Plant a Banyan or Peepal tree and water it regularly.'
        ]
      : []
  });

  // Calculate Vimsottari Dasha (Mahadasha sequence starting from Nakshatra lord of Moon)
  const dashaLords = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
  const dashaYears = [7, 20, 6, 10, 7, 18, 16, 19, 17];
  
  const moonNakIdx = NAKSHATRAS.indexOf(moonPlacement.nakshatra);
  const startingLordIdx = moonNakIdx % 9;
  
  // Balance of Dasha at birth based on moon's degree in nakshatra
  // Each Nakshatra spans 13°20' (13.33 degrees)
  const nakshatraProgress = (moonPlacement.degree % 13.33) / 13.33;
  const dashaOrder: DashaPeriod[] = [];
  
  let currentYear = birthYear;
  let currentMonth = birthMonth;
  let currentDay = birthDay;
  
  for (let i = 0; i < 9; i++) {
    const dashaIdx = (startingLordIdx + i) % 9;
    const planetName = dashaLords[dashaIdx];
    let baseYears = dashaYears[dashaIdx];
    
    // First dasha is partial depending on balance of birth
    if (i === 0) {
      baseYears = parseFloat((baseYears * (1 - nakshatraProgress)).toFixed(2));
    }
    
    const endYear = currentYear + Math.floor(baseYears);
    const fractionYears = baseYears - Math.floor(baseYears);
    let endMonth = currentMonth + Math.round(fractionYears * 12);
    let endDay = currentDay;
    
    if (endMonth > 12) {
      endMonth -= 12;
      currentYear += 1;
    }
    
    const startStr = `${currentDay.toString().padStart(2, '0')}/${currentMonth.toString().padStart(2, '0')}/${currentYear}`;
    const endStr = `${endDay.toString().padStart(2, '0')}/${endMonth.toString().padStart(2, '0')}/${endYear}`;
    
    // Generate sub periods (Antardasha)
    const subPeriods: { planet: string; startDate: string; endDate: string }[] = [];
    let subStartYear = currentYear;
    let subStartMonth = currentMonth;
    
    for (let j = 0; j < 5; j++) {
      const subLordIdx = (dashaIdx + j) % 9;
      const subLord = dashaLords[subLordIdx];
      // simplified antardasha durations
      const subDuration = (baseYears * (dashaYears[subLordIdx] / 120));
      const subEndYear = subStartYear + Math.floor(subDuration);
      let subEndMonth = subStartMonth + Math.round((subDuration - Math.floor(subDuration)) * 12);
      if (subEndMonth > 12) {
        subEndMonth -= 12;
        subStartYear += 1;
      }
      
      subPeriods.push({
        planet: subLord,
        startDate: `${currentDay.toString().padStart(2, '0')}/${subStartMonth.toString().padStart(2, '0')}/${subStartYear}`,
        endDate: `${currentDay.toString().padStart(2, '0')}/${subEndMonth.toString().padStart(2, '0')}/${subEndYear}`
      });
      
      subStartYear = subEndYear;
      subStartMonth = subEndMonth;
    }
    
    dashaOrder.push({
      planet: planetName,
      startDate: startStr,
      endDate: endStr,
      subPeriods: subPeriods
    });
    
    currentYear = endYear;
    currentMonth = endMonth;
  }

  // General remedies based on Moon Rashi
  const genericRemedies = [
    `Wear your lucky gemstone ${luckyDetails.gemstone} or keep it near your desk to amplify planetary benefits.`,
    `Incorporate ${luckyDetails.color.toLowerCase()} colors in your clothing especially on important business tasks.`,
    `Chant the seed mantra for ${moonRashiLord} on its respective weekday to remove obstacles and attract luck.`,
    'Meditate daily at sunrise to harmonize planetary vibrations in your Lagna house.',
    'Donate sweet food items or milk to cows on Mondays to soothe emotional swings caused by the Moon.'
  ];

  return {
    birthDetails: details,
    rashi: moonRashi,
    rashiLord: moonRashiLord,
    nakshatra: moonNakshatra,
    nakshatraLord: moonNakshatraLord,
    pada: moonPada,
    luckyNumber: luckyDetails.number,
    luckyColor: luckyDetails.color,
    luckyGemstone: luckyDetails.gemstone,
    planetaryPositions: planets,
    houses: houses,
    yogas: yogas.filter(y => y.present),
    doshas: doshas,
    mahadasha: dashaOrder,
    remedies: genericRemedies
  };
}

function getNakshatraLord(index: number): string {
  const lords = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
  return lords[index % 9];
}

function getLuckyDetails(rashi: string) {
  const luckyMap: { [key: string]: { number: number, color: string, gemstone: string } } = {
    Mesha: { number: 9, color: 'Crimson Red', gemstone: 'Red Coral' },
    Vrishabha: { number: 6, color: 'Cream / White', gemstone: 'Diamond / Opal' },
    Mithuna: { number: 5, color: 'Emerald Green', gemstone: 'Emerald' },
    Karka: { number: 2, color: 'Pearl White / Silver', gemstone: 'Pearl' },
    Simha: { number: 1, color: 'Gold / Ruby Red', gemstone: 'Ruby' },
    Kanya: { number: 5, color: 'Olive Green', gemstone: 'Emerald' },
    Tula: { number: 6, color: 'Royal Blue / Turquoise', gemstone: 'Diamond' },
    Vrishchika: { number: 9, color: 'Maroon', gemstone: 'Red Coral' },
    Dhanu: { number: 3, color: 'Saffron Yellow', gemstone: 'Yellow Sapphire' },
    Makara: { number: 8, color: 'Charcoal Black / Navy', gemstone: 'Blue Sapphire' },
    Kumbha: { number: 8, color: 'Electric Blue', gemstone: 'Blue Sapphire' },
    Meena: { number: 3, color: 'Golden Yellow', gemstone: 'Yellow Sapphire' }
  };
  return luckyMap[rashi] || { number: 7, color: 'Saffron', gemstone: 'Yellow Sapphire' };
}

// Generate Realistic Panchang Data for a given date
export function generatePanchangData(dateStr: string): PanchangData {
  const date = new Date(dateStr);
  const seed = date.getDate() + (date.getMonth() + 1) * 31 + date.getFullYear();
  
  const weekdays = ['Ravivara (Sunday)', 'Somavara (Monday)', 'Mangalavara (Tuesday)', 'Budhavara (Wednesday)', 'Guruvara (Thursday)', 'Shukravara (Friday)', 'Shanivara (Saturday)'];
  const tithis = [
    'Pratipada (1st)', 'Dwitiya (2nd)', 'Tritiya (3rd)', 'Chaturthi (4th)', 'Panchami (5th)', 'Shashti (6th)', 'Saptami (7th)', 'Ashtami (8th)', 'Navami (9th)', 'Dashami (10th)',
    'Ekadashi (11th)', 'Dwadashi (12th)', 'Trayodashi (13th)', 'Chaturdashi (14th)', 'Purnima (Full Moon)', 'Amavasya (New Moon)'
  ];
  const tithiLords = ['Agni', 'Brahma', 'Gauri', 'Ganapati', 'Saraswati', 'Kartikeya', 'Surya', 'Shiva', 'Durga', 'Yama', 'Vishnu', 'Aditya', 'Kamadeva', 'Kali', 'Moon', 'Rahu'];
  const yogas = ['Vishkumbha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda', 'Sukarma', 'Dhriti', 'Shula', 'Ganda', 'Vridhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyan', 'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra', 'Vaidhriti'];
  const karanas = ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Visti (Bhadra)', 'Shakuni', 'Chatushpada', 'Naga', 'Kintughna'];
  
  const tithiIdx = Math.floor(randomSeeded(seed) * tithis.length);
  const nakshatraIdx = Math.floor(randomSeeded(seed + 12) * 27);
  const yogaIdx = Math.floor(randomSeeded(seed + 34) * yogas.length);
  const karanaIdx = Math.floor(randomSeeded(seed + 56) * karanas.length);
  
  return {
    date: dateStr,
    tithi: tithis[tithiIdx],
    tithiLord: tithiLords[tithiIdx] || 'Saraswati',
    vara: weekdays[date.getDay()],
    nakshatra: NAKSHATRAS[nakshatraIdx],
    nakshatraLord: getNakshatraLord(nakshatraIdx),
    yoga: yogas[yogaIdx],
    karana: karanas[karanaIdx],
    sunRise: '05:43 AM',
    sunSet: '07:12 PM',
    moonRise: '06:14 PM',
    moonSet: '05:22 AM',
    rahuKalam: '09:00 AM to 10:30 AM',
    gulikaKalam: '06:00 AM to 07:30 AM',
    yamaganda: '01:30 PM to 03:00 PM',
    abhijitMuhurta: '11:48 AM to 12:36 PM'
  };
}

// Complete Guna Milan Matchmaking system
export function calculateGunaMilan(boy: BirthDetails, girl: BirthDetails): KundliMatchingResult {
  const boyProfile = generateAstrologicalProfile(boy);
  const girlProfile = generateAstrologicalProfile(girl);
  
  const bRashiIdx = RASHIS.findIndex(r => r.name === boyProfile.rashi);
  const gRashiIdx = RASHIS.findIndex(r => r.name === girlProfile.rashi);
  
  const bNakIdx = NAKSHATRAS.indexOf(boyProfile.nakshatra);
  const gNakIdx = NAKSHATRAS.indexOf(girlProfile.nakshatra);
  
  // Ashtakoota parameters details
  const gunaBreakdown: GunaParam[] = [
    {
      name: 'Varna (Spiritual Alignment)',
      maxPoints: 1,
      obtainedPoints: 0,
      boyValue: '',
      girlValue: '',
      description: 'Measures spiritual and work-related compatibility.'
    },
    {
      name: 'Vashya (Mutual Attraction)',
      maxPoints: 2,
      obtainedPoints: 0,
      boyValue: '',
      girlValue: '',
      description: 'Checks power dynamics and magnetic attraction.'
    },
    {
      name: 'Tara (Destiny & Longevity)',
      maxPoints: 3,
      obtainedPoints: 0,
      boyValue: '',
      girlValue: '',
      description: 'Reflects health, longevity, and luck of the couple.'
    },
    {
      name: 'Yoni (Sexual & Intimacy)',
      maxPoints: 4,
      obtainedPoints: 0,
      boyValue: '',
      girlValue: '',
      description: 'Evaluates physical attraction and deep biological intimacy.'
    },
    {
      name: 'Maitri (Intellectual Friendship)',
      maxPoints: 5,
      obtainedPoints: 0,
      boyValue: '',
      girlValue: '',
      description: 'Checks psychological friendship and communication style.'
    },
    {
      name: 'Gana (Temperament Align)',
      maxPoints: 6,
      obtainedPoints: 0,
      boyValue: '',
      girlValue: '',
      description: 'Matches mental wavelength and behavioral nature (Deva, Manushya, Rakshasa).'
    },
    {
      name: 'Bhakoot (Family & Fortune)',
      maxPoints: 7,
      obtainedPoints: 0,
      boyValue: '',
      girlValue: '',
      description: 'Measures emotional attachment and combined wealth success.'
    },
    {
      name: 'Nadi (Physiology & Progeny)',
      maxPoints: 8,
      obtainedPoints: 0,
      boyValue: '',
      girlValue: '',
      description: 'Calculates Ayurvedic body constitution compatibility (Vata, Pitta, Kapha).'
    }
  ];

  // Logic to fill Gunas realistically
  // Varna
  const varnaClasses = ['Brahmin (Spiritual)', 'Kshatriya (Leader)', 'Vaishya (Merchant)', 'Shudra (Worker)'];
  const bVarnaIdx = bRashiIdx % 4;
  const gVarnaIdx = gRashiIdx % 4;
  gunaBreakdown[0].boyValue = varnaClasses[bVarnaIdx];
  gunaBreakdown[0].girlValue = varnaClasses[gVarnaIdx];
  gunaBreakdown[0].obtainedPoints = bVarnaIdx >= gVarnaIdx ? 1 : 0; // Boy class >= Girl class matches well traditionally
  
  // Vashya
  const vashyaTypes = ['Chatushpad (Quadruped)', 'Manav (Human)', 'Jalchar (Water-dwelling)', 'Vanachar (Wild)', 'Keet (Insect)'];
  const bVashyaIdx = bRashiIdx % 5;
  const gVashyaIdx = gRashiIdx % 5;
  gunaBreakdown[1].boyValue = vashyaTypes[bVashyaIdx];
  gunaBreakdown[1].girlValue = vashyaTypes[gVashyaIdx];
  gunaBreakdown[1].obtainedPoints = bVashyaIdx === gVashyaIdx ? 2 : (Math.abs(bVashyaIdx - gVashyaIdx) <= 2 ? 1.5 : 1);
  
  // Tara
  const bTara = (bNakIdx % 9) + 1;
  const gTara = (gNakIdx % 9) + 1;
  gunaBreakdown[2].boyValue = `Tara ${bTara}`;
  gunaBreakdown[2].girlValue = `Tara ${gTara}`;
  const taraDiff = (gNakIdx - bNakIdx + 27) % 9;
  gunaBreakdown[2].obtainedPoints = [1, 2, 4, 6, 8].includes(taraDiff) ? 3 : 1.5;
  
  // Yoni
  const yoniAnimals = ['Ashwa (Horse)', 'Gaja (Elephant)', 'Mesha (Ram)', 'Sarpa (Snake)', 'Shwan (Dog)', 'Marjara (Cat)', 'Mushaka (Rat)', 'Gau (Cow)', 'Mahisha (Buffalo)', 'Vyaghra (Tiger)', 'Mriga (Deer)', 'Vanara (Monkey)', 'Nakula (Mongoose)', 'Simha (Lion)'];
  const bYoniIdx = bNakIdx % 14;
  const gYoniIdx = gNakIdx % 14;
  gunaBreakdown[3].boyValue = yoniAnimals[bYoniIdx];
  gunaBreakdown[3].girlValue = yoniAnimals[gYoniIdx];
  gunaBreakdown[3].obtainedPoints = bYoniIdx === gYoniIdx ? 4 : (Math.abs(bYoniIdx - gYoniIdx) <= 3 ? 3 : (bYoniIdx === 12 && gYoniIdx === 3 ? 0 : 2)); // Mongoose and Snake are bitter enemies, 0 points
  
  // Maitri (Lord Friendship)
  const bLord = boyProfile.rashiLord;
  const gLord = girlProfile.rashiLord;
  gunaBreakdown[4].boyValue = bLord;
  gunaBreakdown[4].girlValue = gLord;
  if (bLord === gLord) {
    gunaBreakdown[4].obtainedPoints = 5;
  } else {
    // Friendly lords check
    const friends: { [key: string]: string[] } = {
      Mars: ['Sun', 'Moon', 'Jupiter'],
      Venus: ['Mercury', 'Saturn'],
      Mercury: ['Sun', 'Venus'],
      Moon: ['Sun', 'Mercury'],
      Sun: ['Moon', 'Mars', 'Jupiter'],
      Jupiter: ['Sun', 'Moon', 'Mars'],
      Saturn: ['Mercury', 'Venus']
    };
    const bFriend = friends[bLord]?.includes(gLord);
    const gFriend = friends[gLord]?.includes(bLord);
    gunaBreakdown[4].obtainedPoints = bFriend && gFriend ? 5 : (bFriend || gFriend ? 3 : 1);
  }
  
  // Gana
  const ganas = ['Deva (Divine)', 'Manushya (Human)', 'Rakshasa (Demon)'];
  const bGanaIdx = bNakIdx % 3;
  const gGanaIdx = gNakIdx % 3;
  gunaBreakdown[5].boyValue = ganas[bGanaIdx];
  gunaBreakdown[5].girlValue = ganas[gGanaIdx];
  if (bGanaIdx === gGanaIdx) {
    gunaBreakdown[5].obtainedPoints = 6;
  } else if (bGanaIdx === 0 && gGanaIdx === 1) {
    gunaBreakdown[5].obtainedPoints = 5; // Deva + Manushya
  } else if (bGanaIdx === 1 && gGanaIdx === 0) {
    gunaBreakdown[5].obtainedPoints = 5; // Manushya + Deva
  } else if (bGanaIdx === 2 && gGanaIdx === 2) {
    gunaBreakdown[5].obtainedPoints = 6;
  } else {
    gunaBreakdown[5].obtainedPoints = 1; // Rakshasa combinations get lower points
  }
  
  // Bhakoot (Distance between Rashis)
  const rashiDiff = (gRashiIdx - bRashiIdx + 12) % 12;
  gunaBreakdown[6].boyValue = boyProfile.rashi;
  gunaBreakdown[6].girlValue = girlProfile.rashi;
  // 1/1, 3/11, 4/10, 5/9 are auspicious
  // 2/12, 6/8, 7/7 are sensitive/challenging
  if ([0, 2, 3, 4, 8, 9, 10].includes(rashiDiff)) {
    gunaBreakdown[6].obtainedPoints = 7;
  } else {
    gunaBreakdown[6].obtainedPoints = 0;
  }
  
  // Nadi
  const nadis = ['Aadi (Vata)', 'Madhya (Pitta)', 'Antya (Kapha)'];
  const bNadiIdx = bNakIdx % 3;
  const gNadiIdx = gNakIdx % 3;
  gunaBreakdown[7].boyValue = nadis[bNadiIdx];
  gunaBreakdown[7].girlValue = nadis[gNadiIdx];
  if (bNadiIdx !== gNadiIdx) {
    gunaBreakdown[7].obtainedPoints = 8; // Different Nadis is great, gets full 8 points (prevents Nadi Dosha)
  } else {
    gunaBreakdown[7].obtainedPoints = 0; // Nadi Dosha
  }

  // Calculate overall score
  const totalScore = gunaBreakdown.reduce((sum, g) => sum + g.obtainedPoints, 0);
  
  // Manglik analysis
  const boyMars = boyProfile.planetaryPositions.find(p => p.name === 'Mars')!;
  const girlMars = girlProfile.planetaryPositions.find(p => p.name === 'Mars')!;
  const bManglik = [1, 4, 7, 8, 12].includes(boyMars.house);
  const gManglik = [1, 4, 7, 8, 12].includes(girlMars.house);
  
  let manglikCompatible = false;
  let manglikDesc = '';
  if (bManglik === gManglik) {
    manglikCompatible = true;
    manglikDesc = bManglik 
      ? 'Perfect! Both partners are Manglik (Kuja), which cancels out the negative effects of Manglik Dosha (Double-Manglik match).'
      : 'Excellent! Neither partner is Manglik. There is no Kuja Dosha friction.';
  } else {
    manglikCompatible = false;
    manglikDesc = bManglik
      ? 'Attention needed. The Groom is Manglik but the Bride is Non-Manglik. Specific remedies or poojas should be conducted.'
      : 'Attention needed. The Bride is Manglik but the Groom is Non-Manglik. Specific remedies or poojas are advised.';
  }

  let overallCompatibility: 'excellent' | 'good' | 'average' | 'poor' = 'average';
  if (totalScore >= 28) {
    overallCompatibility = 'excellent';
  } else if (totalScore >= 21) {
    overallCompatibility = 'good';
  } else if (totalScore >= 18) {
    overallCompatibility = 'average';
  } else {
    overallCompatibility = 'poor';
  }

  const summaries = {
    excellent: `This is a highly auspicious match! Scoring ${totalScore}/36 in Guna Milan, the couple shares deep physiological compatibility, mutual respect, and intellectual friendship. The planetary lords align beautifully. highly recommended!`,
    good: `A highly favorable and prosperous match. With a strong score of ${totalScore}/36, there is sound emotional friendship, physical chemistry, and spiritual harmony. Minor corrections or remedies will ensure a long-lasting, joyful marriage.`,
    average: `An acceptable and stable match. Scoring ${totalScore}/36 Gunas, the core dynamics are cooperative. Mutual adjustments and respecting differences will be the foundation of a happy life. Watch out for Nadi/Bhakoot details.`,
    poor: `A challenging match. With only ${totalScore}/36 Gunas matched, there may be significant psychological, health, or progeny-related differences (such as Nadi Dosha). Astro consultation and specific Vedic remedies are strongly advised before proceeding.`
  };

  return {
    boyName: boy.fullName,
    girlName: girl.fullName,
    gunaScore: totalScore,
    gunaBreakdown: gunaBreakdown,
    manglikMatch: {
      boyManglik: bManglik,
      girlManglik: gManglik,
      compatible: manglikCompatible,
      description: manglikDesc
    },
    overallCompatibility: overallCompatibility,
    summary: summaries[overallCompatibility]
  };
}

// Generate Static/Dynamic Horoscope Predictions
export function getHoroscopePredictions(rashi: string, period: 'daily' | 'weekly' | 'monthly' | 'yearly'): HoroscopePrediction {
  const dateStr = new Date().toISOString().split('T')[0];
  
  // Beautiful cultural deterministic texts based on Moon Rashi
  const predictions: { [key: string]: { [key: string]: string } } = {
    career: {
      daily: 'Today is a day of progress. Sun in high dignity aspects your professional house, triggering active leadership roles. A senior colleague will support your vision.',
      weekly: 'This week provides immense clarity regarding career choices. A planetary transition on Wednesday unlocks closed communication channels, resulting in a lucrative job interview.',
      monthly: 'This month marks professional expansion. Jupiter’s aspect on your 10th house brings luck, positive reputation gains, and an unexpected project opportunity.',
      yearly: 'A pivotal year for career advancement. Saturn demands disciplined execution in the first half, laying down the foundation for substantial professional recognition, salary hikes, and foreign opportunities in the fourth quarter.'
    },
    education: {
      daily: 'Focus is sharp. Ideal day for clearing backlogs or researching tricky technical themes. Mercury’s influence helps memory retention.',
      weekly: 'You will find group study and sharing notes extremely productive. Mid-week brings favorable results in mock tests or competitive milestones.',
      monthly: 'A golden month for higher education. Students wishing to study abroad will receive positive news or college admissions. Stick to a rigorous learning routine.',
      yearly: 'The transit of Jupiter in your house of intellect promises scholastic achievements. Diligence will lead to excellent scores, scholarships, and academic laurels.'
    },
    marriage: {
      daily: 'Emotional harmony prevail. Your partner appreciates your presence. Venus encourages meaningful sweet talks during the late evening hours.',
      weekly: 'A perfect week to resolve existing differences. Unmarried individuals might receive compatibility proposals through mutual family networks.',
      monthly: 'Love is in the air. Romantic getaways or buying a domestic vehicle together will deepen your relationship. Venus is highly supportive this month.',
      yearly: 'A monumental year for relations. Couples waiting to tie the knot will find an auspicious muhurta after October. Relationships will mature, and mutual trust will rise.'
    },
    health: {
      daily: 'Vitality is high, but avoid overexerting your muscles. Watch out for digestive discomfort in the afternoon. Stay hydrated.',
      weekly: 'Minor sleep variations might occur mid-week. Balance screen time with natural walks or yoga. Focus on calming pranayama routines.',
      monthly: 'Energy levels are solid. Ideal time to start a physical gym or fitness regime. Avoid spicy/street foods during planetary transitions.',
      yearly: 'General wellness is strong. Consistent dietary habits and spiritual practice will ward off chronic ailments. Pay close attention to joint health or posture.'
    },
    finance: {
      daily: 'Auspicious day for budgeting or settling small debts. Avoid impulsive retail purchases or stock speculations today.',
      weekly: 'Wealth influx is active. Multiple income avenues might open up. Consider consulting a financial planner for long-term real estate investments.',
      monthly: 'High financial liquidity is predicted. Gains from previous investments or inheritance will fortify your banking profile.',
      yearly: 'A year of robust wealth accumulation. Smart assets, mutual funds, or digital gold acquisitions will yield rich dividends. Budget your foreign leisure travels carefully.'
    },
    business: {
      daily: 'New lead generation is active. Partnership discussions will proceed constructively. Your persuasive negotiation skills are high.',
      weekly: 'Great week to relaunch or market your services. Business associates are cooperative. A major contract signature is likely on Thursday.',
      monthly: 'Trade is highly profitable. Expand your inventory or hire skilled freelancers to scale up operational output.',
      yearly: 'A spectacular year for commercial scaling. New joint-ventures or digital pivots will bring substantial market share. Pay close attention to auditing compliance.'
    },
    travel: {
      daily: 'Avoid long road travel today to prevent stress. Short commutes for groceries or light work will go smoothly.',
      weekly: 'A delightful weekend trip to a nearby peaceful resort is highly favored. Nature elements will recharge your batteries.',
      monthly: 'Long-distance spiritual travels are heavily indicated. A visit to a sacred pilgrimage or temple with elders is highly auspicious.',
      yearly: 'Multiple opportunities for professional international voyages. Safe, rewarding travels that will greatly widen your cultural perspective.'
    }
  };

  // Add customized variations based on Rashi so each Rashi gets unique vibes
  const rashiOffset = RASHIS.findIndex(r => r.name === rashi) || 0;
  
  const getModifiedText = (category: string) => {
    const base = predictions[category][period];
    // Slightly alter sentences deterministically to offer personalized content per Rashi
    if (rashiOffset % 3 === 1) {
      return base.replace('Today', 'Today, under your favorable Rashi aspect,').replace('This', 'For your Rashi, this');
    } else if (rashiOffset % 3 === 2) {
      return base + ` This phase is particularly influenced by your Rashi lord, ${RASHIS[rashiOffset].lord}.`;
    }
    return base;
  };

  return {
    period: period,
    rashi: rashi,
    date: dateStr,
    career: getModifiedText('career'),
    education: getModifiedText('education'),
    marriage: getModifiedText('marriage'),
    health: getModifiedText('health'),
    finance: getModifiedText('finance'),
    business: getModifiedText('business'),
    travel: getModifiedText('travel')
  };
}

// Festival Calendar Data for 2026 (Modern interactive calendar)
export const FESTIVALS_2026: FestivalDetail[] = [
  {
    name: 'Makar Sankranti',
    date: '2026-01-14',
    description: 'Marks the transition of the Sun into Makara rashi (Capricorn), celebrating the harvest and longer days.',
    significance: 'Celebrated across India with kite flying, holy river bathing, and offering sweets made of sesame and jaggery.',
    rituals: ['Surya Pooja', 'Charity', 'Kite Flying', 'Preparing Til-Gud sweets']
  },
  {
    name: 'Maha Shivratri',
    date: '2026-02-15',
    description: 'The great night of Lord Shiva, celebrating the cosmic union of Shiva and Shakti.',
    significance: 'Brings immense mental peace, spiritual progress, and balances planetary doshas (especially Saturn and Rahu).',
    rituals: ['All-night Vigil (Jagaran)', 'Shivling Abhishek with milk/honey', 'Chanting Maha Mrityunjaya Mantra', 'Fasting']
  },
  {
    name: 'Holi',
    date: '2026-03-03',
    description: 'The ancient festival of colors, representing the victory of good over evil (Prahlada over Holika) and the arrival of spring.',
    significance: 'Promotes universal friendship, harmony, forgiveness, and lightens emotional blockages.',
    rituals: ['Holika Dahan bonfire', 'Playing with organic colors', 'Sharing Gujiya sweets', 'Seeking blessings from elders']
  },
  {
    name: 'Rama Navami',
    date: '2026-03-27',
    description: 'Celebrates the birth anniversary of Lord Rama, the epitome of righteousness (Maryada Purushottam).',
    significance: 'Auspicious day for beginning new professional projects, legal disputes resolution, and home blessings.',
    rituals: ['Rama Katha recitation', 'Worshipping infant Rama', 'Donating clothing and food', 'Temple visits']
  },
  {
    name: 'Hanuman Jayanti',
    date: '2026-04-11',
    description: 'The birth celebration of Lord Hanuman, the symbol of absolute devotion, strength, and courage.',
    significance: 'The ultimate shield against Mangal (Mars) and Shani (Saturn) planetary distress.',
    rituals: ['Chanting Sunderkand/Hanuman Chalisa', 'Offering Sindoor (orange paste) to Hanuman', 'Distributing Boondi prasad']
  },
  {
    name: 'Gurupurnima',
    date: '2026-07-29',
    description: 'A sacred day dedicated to honoring spiritual and academic gurus, marked on the full moon of Ashadha.',
    significance: 'Expressing gratitude to teachers, ancestors, and receiving spiritual initiations.',
    rituals: ['Guru Pooja', 'Offering dakshina', 'Meditating on spiritual lineage', 'Satsang gathering']
  },
  {
    name: 'Krishna Janmashtami',
    date: '2026-09-04',
    description: 'The grand incarnation celebration of Lord Krishna, the guide of the Bhagavad Gita.',
    significance: 'Invites joy, devotion, wisdom, and removes heavy financial blockages from household charts.',
    rituals: ['Midnight Krishna Pooja', 'Dahi Handi celebrations', 'Singing Bhajans', 'Fast until midnight']
  },
  {
    name: 'Ganesh Chaturthi',
    date: '2026-09-15',
    description: 'Ten-day celebration of the birth of Lord Ganesha, the lord of obstacles removal and new beginnings.',
    significance: 'Auspicious for launching any business, house warming, or academic courses.',
    rituals: ['Prana Pratishtha of clay Ganesha', 'Offering Modak sweets', 'Morning/Evening Aarati', 'Visarjan immersion procession']
  },
  {
    name: 'Dussehra (Vijayadashami)',
    date: '2026-10-20',
    description: 'The victory of Lord Rama over Ravana and Goddess Durga over Mahishasura, symbolizing victory of Dharma.',
    significance: 'Perfect Muhurta for buying gold, buying vehicles, weapon worship (Ayudha Pooja), and writing new scripts.',
    rituals: ['Ravana effigy burning', 'Worshipping Shami tree', 'Starting new businesses', 'Offering sweet Jalebi']
  },
  {
    name: 'Diwali (Deepavali)',
    date: '2026-11-08',
    description: 'The festival of lights celebrating Lord Rama’s return to Ayodhya and welcoming Goddess Lakshmi (Wealth).',
    significance: 'Invites prosperity, commercial luck, banking success, and lights the inner light of consciousness.',
    rituals: ['Laxmi Pooja at evening', 'Lighting clay Diyas', 'Exchanging gifts/dry fruits', 'Rangoli designs']
  }
];

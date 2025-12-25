
import { GoogleGenAI, Type } from "@google/genai";
import { UserCapability, WeatherData, GuidanceResponse, Assessment, HazardLevel, TerrainAnalysis } from "../types";

/**
 * Robustly parses JSON from LLM output, removing markdown code blocks if present.
 * Always returns the provided fallback if parsing fails or if the structure is invalid.
 */
function safeJsonParse<T>(text: string | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    if (!cleaned || (!cleaned.startsWith('{') && !cleaned.startsWith('['))) {
       return fallback;
    }
    const parsed = JSON.parse(cleaned);
    // Basic validation: if we expect an object but get something else, use fallback
    if (typeof parsed !== 'object' || parsed === null) return fallback;
    return parsed as T;
  } catch (e) {
    console.error("JSON Parse Error:", e, "Input:", text);
    return fallback;
  }
}

export async function getRealtimeWeather(location: string): Promise<WeatherData> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Using gemini-3-flash-preview for weather to save quota/speed
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    CRITICAL INSTRUCTION: Perform a Google Search to find the ACTUAL CURRENT weather for "${location}".
    Do NOT use default values. 
    
    Required JSON structure:
    {
      "temp": number (Celsius),
      "condition": string,
      "windSpeed": number (km/h),
      "windDir": string (e.g. "NW"),
      "humidity": number (%),
      "precipProb": number (%),
      "visibility": number (km),
      "sunset": string (time),
      "elevation": number (meters),
      "confidence": number (0-100)
    }
  `;

  const fallback: WeatherData = {
    temp: 0,
    condition: 'OFFLINE/DATA ERROR',
    windSpeed: 0,
    windDir: '--',
    humidity: 0,
    precipProb: 0,
    visibility: 0,
    sunset: '--:--',
    lastUpdated: new Date().toLocaleTimeString(),
    elevation: 0,
    confidence: 0,
    locationName: location
  };

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
      }
    });

    const data = safeJsonParse<any>(response.text, fallback);
    return {
      ...fallback, // spread fallback first to ensure all fields exist
      ...data,
      locationName: location,
      lastUpdated: new Date().toLocaleTimeString(),
    };
  } catch (error) {
    console.warn("Weather Fetch Quota/Network Error:", error);
    return fallback;
  }
}

export async function getGuidance(
  weather: WeatherData,
  user: UserCapability,
  locationCoords?: { lat: number, lng: number },
  isFireMode: boolean = false
): Promise<GuidanceResponse> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-3-pro-preview"; // Keeping Pro for final decision logic

  const prompt = `
    ACT AS A SENIOR WILDERNESS RANGER. 
    Location: ${weather.locationName}
    Weather: ${weather.temp}°C, ${weather.condition}, Wind ${weather.windSpeed}km/h
    User: Experience ${user.experience}%, Fitness ${user.fitness}%
    FIRE MODE: ${isFireMode ? "ACTIVE" : "INACTIVE"}
    
    Output JSON: { status (GO|CAUTION|MODIFY|NOGO), reasoning, packingHints[], aiSummary, safetyIndex (0-100) }
  `;

  const fallback: GuidanceResponse = {
    status: 'CAUTION',
    reasoning: 'AI Logic unreachable. Use local terrain observation.',
    packingHints: ['Review local signs', 'Stay alert'],
    aiSummary: 'Intelligence engine connection failed.',
    safetyIndex: 50
  };

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 10000 },
        responseMimeType: "application/json"
      }
    });

    const data = safeJsonParse<GuidanceResponse>(response.text, fallback);
    return {
      ...fallback,
      ...data,
      packingHints: Array.isArray(data.packingHints) ? data.packingHints : fallback.packingHints
    };
  } catch (error) {
    return fallback;
  }
}

export async function getHazardAssessment(weather: WeatherData, isFireMode: boolean = false): Promise<Assessment> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-3-flash-preview";

  const prompt = `
    Rate hazards 0-100 based on:
    Temp: ${weather.temp}C, Wind: ${weather.windSpeed}km/h, Humid: ${weather.humidity}%.
    JSON: { thunderstorm, heat, cold, fire, flood, safetyScore }
    If isFireMode is true, also provide fireDetails object.
  `;

  const d: HazardLevel = { level: 'LOW', score: 0, label: 'LOW', description: 'N/A' };
  const fallback: Assessment = { thunderstorm: d, heat: d, cold: d, fire: d, flood: d, safetyScore: 50 };

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    
    const data = safeJsonParse<any>(response.text, fallback);
    const mapScore = (score: number | undefined): HazardLevel => {
      const s = score ?? 0;
      let level: HazardLevel['level'] = 'LOW';
      if (s > 80) level = 'EXTREME';
      else if (s > 60) level = 'HIGH';
      else if (s > 30) level = 'MODERATE';
      return { level, score: s, label: level, description: `${s}% calculated risk` };
    };

    return {
      thunderstorm: mapScore(data.thunderstorm),
      heat: mapScore(data.heat),
      cold: mapScore(data.cold),
      fire: mapScore(data.fire),
      flood: mapScore(data.flood),
      safetyScore: data.safetyScore ?? 50,
      fireDetails: data.fireDetails
    };
  } catch (error) {
    return fallback;
  }
}

export async function getTerrainAnalysis(locationName: string): Promise<TerrainAnalysis> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const fallback: TerrainAnalysis = { type: "Unknown", exposure: "Moderate", hazards: [], rangerNote: "Maintain visual scout." };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Provide terrain profile for ${locationName}. JSON: { type, exposure, hazards[], rangerNote }`,
      config: { responseMimeType: "application/json" }
    });
    const data = safeJsonParse<TerrainAnalysis>(response.text, fallback);
    return {
      ...fallback,
      ...data,
      hazards: Array.isArray(data.hazards) ? data.hazards : []
    };
  } catch (e) {
    return fallback;
  }
}

export async function searchFireAlerts(location: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Flash is fine for alerts too
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Active fire incidents or trail closures near ${location} last 72 hours. Summarize in 2-3 sentences.`,
      config: { tools: [{ googleSearch: {} }] }
    });
    return response.text || "No localized fire alerts found.";
  } catch (e) { 
    return "Telemetry sync failed."; 
  }
}

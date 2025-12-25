
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ThemeMode, UserCapability, WeatherData, Assessment, GuidanceResponse, TerrainAnalysis } from './types';
import { THEME_CONFIG, Icons } from './constants';
import { getGuidance, getHazardAssessment, searchFireAlerts, getTerrainAnalysis, getRealtimeWeather } from './services/geminiService';

const App: React.FC = () => {
  const [theme, setTheme] = useState<ThemeMode>(ThemeMode.NIGHT);
  const [user, setUser] = useState<UserCapability>({
    experience: 50,
    fitness: 60,
    packWeight: 12,
    groupSize: 2,
    startTime: '07:30'
  });
  
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [locationInput, setLocationInput] = useState('Olympic National Park');
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [guidance, setGuidance] = useState<GuidanceResponse | null>(null);
  const [terrain, setTerrain] = useState<TerrainAnalysis | null>(null);
  const [fireAlerts, setFireAlerts] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [locationCoords, setLocationCoords] = useState<{lat: number, lng: number} | undefined>();

  const currentTheme = THEME_CONFIG[theme];
  const isFireMode = theme === ThemeMode.FIRE;
  const initialLoadRef = useRef(true);

  const refreshData = useCallback(async (locToUse: string) => {
    if (isLoading) return; 
    
    setIsLoading(true);
    setIsWeatherLoading(true);
    setLoadProgress(10);
    
    try {
      setLoadProgress(20);
      const liveWeather = await getRealtimeWeather(locToUse);
      setWeather(liveWeather);
      setIsWeatherLoading(false); // Clear weather specifically early if it finishes
      setLoadProgress(45);

      const [newHazards, newGuidance, newTerrain] = await Promise.all([
        getHazardAssessment(liveWeather, isFireMode),
        getGuidance(liveWeather, user, locationCoords, isFireMode),
        getTerrainAnalysis(liveWeather.locationName)
      ]);
      setLoadProgress(85);
      
      setAssessment(newHazards);
      setGuidance(newGuidance);
      setTerrain(newTerrain);

      if (isFireMode) {
        const alerts = await searchFireAlerts(liveWeather.locationName);
        setFireAlerts(alerts);
      }
      setLoadProgress(100);
    } catch (err) {
      console.error("Critical Analysis Loop Failure:", err);
    } finally {
      // Immediate reset to ensure UI doesn't hang
      setIsLoading(false);
      setIsWeatherLoading(false);
      setLoadProgress(0);
    }
  }, [user, isFireMode, locationCoords, isLoading]);

  useEffect(() => {
    if (initialLoadRef.current) {
      refreshData(locationInput);
      initialLoadRef.current = false;
    }
    
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocationCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.log("Geolocation opted out")
      );
    }
  }, []); // Only on mount

  const handleLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationInput.trim()) return;
    refreshData(locationInput);
  };

  const HazardBar = ({ label, hazard, icon: Icon }: { label: string, hazard?: any, icon: React.FC }) => {
    if (!hazard) return null;
    const colors: Record<string, string> = {
      LOW: 'bg-emerald-500',
      MODERATE: 'bg-yellow-500',
      HIGH: 'bg-orange-500',
      EXTREME: 'bg-red-500'
    };
    const isPrimary = isFireMode && label === 'Fire Weather';
    
    return (
      <div className={`mb-4 p-3 rounded-sm border transition-all duration-500 ${isPrimary ? 'bg-red-950/20 border-red-500/50 scale-[1.02] shadow-lg' : 'bg-zinc-950/20 border-transparent'}`}>
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className={`${isPrimary ? 'text-orange-400' : 'text-zinc-500'}`}>
              <Icon />
            </span>
            <span className={`text-[10px] uppercase font-bold tracking-widest ${isPrimary ? 'text-orange-400' : 'text-zinc-500'}`}>
              {label}
            </span>
          </div>
          <span className={`text-[10px] font-black tracking-widest ${hazard.level === 'LOW' ? 'text-emerald-400' : hazard.level === 'EXTREME' ? 'text-red-500' : 'text-zinc-200'}`}>
            {hazard.level}
          </span>
        </div>
        <div className="h-1 w-full bg-zinc-900 overflow-hidden">
          <div 
            className={`h-full ${colors[hazard.level] || 'bg-zinc-500'} transition-all duration-1000`} 
            style={{ width: `${hazard.score ?? 0}%` }}
          />
        </div>
      </div>
    );
  };

  const getSafetyColor = (index: number) => {
    if (index > 80) return 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]';
    if (index > 50) return 'bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]';
    if (index > 30) return 'bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]';
    return 'bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.3)]';
  };

  return (
    <div className={`min-h-screen ${currentTheme.bg} transition-colors duration-1000 pb-12 overflow-x-hidden`}>
      {/* Background Ember Effect for Fire Mode */}
      {isFireMode && (
        <div className="fixed inset-0 pointer-events-none opacity-20">
          <div className="absolute bottom-[-10%] left-[20%] w-[40vw] h-[40vw] bg-orange-950/30 rounded-full blur-[120px] fire-flicker"></div>
          <div className="absolute top-[10%] right-[10%] w-[30vw] h-[30vw] bg-red-950/20 rounded-full blur-[100px] fire-flicker" style={{animationDelay: '1.5s'}}></div>
        </div>
      )}

      {/* Loading Bar */}
      {isLoading && (
        <div className="fixed top-0 left-0 w-full h-1.5 bg-zinc-900 z-[100] overflow-hidden">
          <div 
            className="h-full bg-indigo-500 shadow-[0_0_10px_#6366f1] transition-all duration-300 ease-out"
            style={{ width: `${loadProgress}%` }}
          />
        </div>
      )}

      {/* Massive Disclosure */}
      <div className="bg-red-700 text-white text-[10px] font-black py-1.5 px-4 text-center sticky top-0 z-[60] uppercase tracking-[0.3em] shadow-xl border-b border-red-800">
        WE ARE NOT RESPONSIBLE. THIS IS A UTILITY, NOT A GUARANTEE. SELF-RESCUE IS YOUR RESPONSIBILITY.
      </div>

      <header className={`p-6 bg-gradient-to-b ${currentTheme.header} border-b border-zinc-800/50 sticky top-7 z-50 backdrop-blur-md`}>
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={`p-4 bg-zinc-950/90 border border-zinc-800 ${currentTheme.accent} shadow-2xl`}>
               <Icons.Compass />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase italic leading-none flex items-center gap-2">
                METOUT
                {isFireMode && <span className="text-red-500 animate-pulse"><Icons.Fire /></span>}
              </h1>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 mt-1.5">Intelligence Engine 5.2</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <form onSubmit={handleLocationSubmit} className="flex bg-zinc-950/80 border border-zinc-800 focus-within:border-zinc-500 transition-colors h-10">
               <input 
                 className="bg-transparent px-4 py-2 text-[11px] font-bold text-zinc-200 w-48 focus:outline-none placeholder:text-zinc-700 uppercase" 
                 placeholder="Enter Area Name..."
                 value={locationInput}
                 onChange={(e) => setLocationInput(e.target.value)}
               />
               <button type="submit" className="px-3 text-zinc-600 hover:text-zinc-300" aria-label="Search">
                 <Icons.Search />
               </button>
            </form>
            
            <div className="flex items-center gap-3 bg-zinc-950/50 p-1 border border-zinc-800 rounded-sm">
              <div className="flex overflow-x-auto max-w-full">
                {Object.values(ThemeMode).filter(m => m !== ThemeMode.FIRE).map((m) => (
                  <button
                    key={m}
                    onClick={() => setTheme(m)}
                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                      theme === m 
                      ? `${THEME_CONFIG[m].accent} bg-zinc-100/10` 
                      : 'text-zinc-600 hover:text-zinc-400'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div className="w-px h-6 bg-zinc-800 mx-1"></div>
              <button
                onClick={() => setTheme(ThemeMode.FIRE)}
                className={`px-6 py-2.5 text-[11px] font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap relative overflow-hidden group border-2 ${
                  theme === ThemeMode.FIRE 
                  ? 'border-red-500 bg-red-600 text-white shadow-[0_0_25px_rgba(239,68,68,0.5)] scale-110 rotate-[-1deg]' 
                  : 'border-red-600/50 text-red-500 hover:text-white hover:bg-red-600 hover:border-red-600'
                }`}
              >
                <span className={`absolute inset-0 bg-red-400/20 ${theme === ThemeMode.FIRE ? 'animate-pulse' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}></span>
                <span className="relative z-10 flex items-center gap-2">
                  <Icons.Fire />
                  WILDFIRE SAFETY MODE
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {/* Left Column: Stats */}
        <div className="lg:col-span-4 space-y-6">
          <section className={`${currentTheme.card} p-6 border relative overflow-hidden group min-h-[300px] flex flex-col justify-between`}>
             {isWeatherLoading ? (
               <div className="absolute inset-0 z-20 bg-zinc-950/80 flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
                  <div className="w-8 h-8 border-4 border-zinc-800 border-t-indigo-500 rounded-full animate-spin"></div>
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Retrieving Ground Data...</div>
               </div>
             ) : null}

             <div className="flex justify-between items-start mb-8">
               <div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500 mb-1">Environmental Status</h3>
                  <div className="text-xs font-black text-zinc-200 uppercase tracking-widest truncate max-w-[180px]">
                    {weather?.locationName || locationInput}
                  </div>
               </div>
               <div className="flex flex-col items-end gap-1">
                 <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500">
                    <div className={`w-1.5 h-1.5 rounded-full ${weather?.confidence && weather.confidence > 50 ? 'bg-emerald-500' : 'bg-red-500'} shadow-lg`}></div>
                    {weather?.confidence || 0}% CONF
                 </div>
                 <div className="text-[8px] font-mono text-zinc-700 uppercase tracking-widest">REAL-TIME SYNC</div>
               </div>
             </div>
             
             {weather ? (
               <div className="grid grid-cols-2 gap-y-8">
                  <div>
                    <div className="text-5xl font-black tracking-tighter mb-1 tabular-nums">
                      {weather.temp}°
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">{weather.condition}</div>
                  </div>
                  <div className="flex flex-col justify-center pl-4 border-l border-zinc-800/50">
                     <div className="flex items-center gap-3 text-zinc-200">
                       <Icons.Wind />
                       <span className="text-lg font-black tabular-nums">{weather.windSpeed} <span className="text-[9px] text-zinc-500">KM/H</span></span>
                     </div>
                     <div className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mt-1">{weather.windDir} FLOW</div>
                  </div>

                  <div className="pr-4 border-r border-zinc-800/50">
                     <div className="text-[8px] uppercase font-black tracking-[0.2em] text-zinc-600 mb-1">Humidity</div>
                     <div className="text-sm font-black text-zinc-200 tabular-nums">{weather.humidity}%</div>
                  </div>
                  <div className="pl-4">
                     <div className="text-[8px] uppercase font-black tracking-[0.2em] text-zinc-600 mb-1">Sunset</div>
                     <div className="text-sm font-black text-zinc-200 tabular-nums">{weather.sunset}</div>
                  </div>
               </div>
             ) : (
               <div className="flex-1 flex items-center justify-center text-zinc-800 font-black text-[10px] uppercase tracking-[0.5em]">
                 AWAITING GROUND SYNC
               </div>
             )}

             <div className="mt-8 pt-6 border-t border-zinc-800/30 flex justify-between items-center text-[8px] font-mono text-zinc-700">
               <div>UPDATED: {weather?.lastUpdated || 'PENDING'}</div>
               <div className="flex items-center gap-1.5 uppercase font-black">
                 <Icons.Check /> {weather ? 'VERIFIED' : 'WAITING'}
               </div>
             </div>
          </section>

          <section className={`${currentTheme.card} p-6 border`}>
            <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500 mb-8 flex items-center justify-between">
               Capability Profile
               <span className="text-zinc-800"><Icons.Backpack /></span>
            </h3>
            <div className="space-y-8">
              <div>
                <div className="flex justify-between text-[9px] font-black uppercase mb-3">
                  <span className="text-zinc-500">Experience</span>
                  <span className={currentTheme.accent}>{user.experience}%</span>
                </div>
                <input type="range" className="w-full accent-zinc-200 bg-zinc-900 h-1 appearance-none cursor-ew-resize" value={user.experience} onChange={(e) => setUser({...user, experience: parseInt(e.target.value)})} />
              </div>
              <div>
                <div className="flex justify-between text-[9px] font-black uppercase mb-3">
                  <span className="text-zinc-500">Fitness</span>
                  <span className={currentTheme.accent}>{user.fitness}%</span>
                </div>
                <input type="range" className="w-full accent-zinc-200 bg-zinc-900 h-1 appearance-none cursor-ew-resize" value={user.fitness} onChange={(e) => setUser({...user, fitness: parseInt(e.target.value)})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[8px] font-black uppercase text-zinc-600 block mb-2">Pack (KG)</label>
                    <input type="number" className="w-full bg-zinc-950 border border-zinc-800 px-3 py-3 text-xs font-black focus:border-zinc-500 outline-none tabular-nums" value={user.packWeight} onChange={(e) => setUser({...user, packWeight: parseInt(e.target.value)})} />
                 </div>
                 <div>
                    <label className="text-[8px] font-black uppercase text-zinc-600 block mb-2">Group</label>
                    <input type="number" className="w-full bg-zinc-950 border border-zinc-800 px-3 py-3 text-xs font-black focus:border-zinc-500 outline-none tabular-nums" value={user.groupSize} onChange={(e) => setUser({...user, groupSize: parseInt(e.target.value)})} />
                 </div>
              </div>
              <button 
                onClick={() => refreshData(locationInput)}
                disabled={isLoading}
                className="w-full bg-zinc-100 text-zinc-950 font-black py-4 text-[11px] uppercase tracking-[0.3em] hover:bg-white transition-all disabled:opacity-50 active:scale-[0.98] shadow-2xl"
              >
                {isLoading ? 'ANALYZING...' : 'RECALCULATE PROFILE'}
              </button>
            </div>
          </section>

          {terrain && (
            <section className={`${currentTheme.card} p-6 border border-zinc-800/50`}>
              <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500 mb-6">Terrain Intelligence</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-zinc-950/40 p-3 border border-zinc-800">
                      <div className="text-[8px] font-black text-zinc-600 uppercase mb-1">Type</div>
                      <div className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">{terrain.type}</div>
                   </div>
                   <div className="bg-zinc-950/40 p-3 border border-zinc-800">
                      <div className="text-[8px] font-black text-zinc-600 uppercase mb-1">Exposure</div>
                      <div className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">{terrain.exposure}</div>
                   </div>
                </div>
                <div className="p-3 border border-zinc-800 bg-zinc-950/20">
                   <div className="text-[8px] font-black text-zinc-600 uppercase mb-2">Geological Hazards</div>
                   <div className="flex flex-wrap gap-2">
                      {terrain.hazards?.map((h, i) => (
                        <span key={i} className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-[9px] font-black text-zinc-500 uppercase tracking-widest">{h}</span>
                      ))}
                      {(!terrain.hazards || terrain.hazards.length === 0) && (
                        <span className="text-[9px] font-black text-zinc-700 uppercase italic">NONE IDENTIFIED</span>
                      )}
                   </div>
                </div>
                <p className="text-[10px] leading-relaxed text-zinc-500 italic">"{terrain.rangerNote}"</p>
              </div>
            </section>
          )}
        </div>

        {/* Right Column: Hazards & Guidance */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <section className={`${currentTheme.card} p-6 border h-full`}>
               <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500 mb-8 flex items-center gap-2">
                 <Icons.Alert /> Risk Matrix
               </h3>
               {assessment ? (
                 <>
                   <HazardBar label="Thunderstorm" hazard={assessment.thunderstorm} icon={Icons.Lightning} />
                   <HazardBar label="Heat Stress" hazard={assessment.heat} icon={Icons.Sun} />
                   <HazardBar label="Cold Stress" hazard={assessment.cold} icon={Icons.Snowflake} />
                   <HazardBar label="Fire Weather" hazard={assessment.fire} icon={Icons.Fire} />
                   <HazardBar label="Flood Drainage" hazard={assessment.flood} icon={Icons.Flood} />
                 </>
               ) : (
                 <div className="space-y-6 animate-pulse">
                   {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-zinc-900/50 w-full rounded-sm" />)}
                 </div>
               )}

               {isFireMode && assessment?.fireDetails && (
                 <div className="mt-10 pt-8 border-t border-red-900/30">
                    <div className="text-[11px] font-black text-red-500 uppercase tracking-[0.35em] mb-6 flex items-center gap-2">
                       <span className="animate-pulse"><Icons.Fire /></span> WILDFIRE SAFETY PANEL
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                       <div className="bg-red-950/20 p-4 border border-red-800/40">
                          <div className="text-[8px] uppercase font-black text-red-700 mb-1">Spread Profile</div>
                          <div className="text-[11px] font-black text-zinc-200 uppercase">{assessment.fireDetails.windEffect}</div>
                       </div>
                       <div className="bg-red-950/20 p-4 border border-red-800/40">
                          <div className="text-[8px] uppercase font-black text-red-700 mb-1">Fuel State</div>
                          <div className="text-[11px] font-black text-zinc-200 uppercase">{assessment.fireDetails.fuelDryness}</div>
                       </div>
                    </div>
                    <div className="p-4 border border-red-900/30 bg-red-950/10">
                      <div className="text-[8px] font-black text-red-800 uppercase mb-2">Drying Trend</div>
                      <div className="text-[10px] font-black text-zinc-300 uppercase tracking-widest mb-3">{assessment.fireDetails.dryingTrend}</div>
                      <p className="text-[10px] leading-relaxed text-zinc-400 italic font-medium">
                        "{assessment.fireDetails.aiInterpretation}"
                      </p>
                    </div>
                 </div>
               )}
            </section>

            <section className={`${currentTheme.card} p-6 border h-full flex flex-col`}>
               <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500 mb-10">AI Ranger Guidance</h3>
               {guidance ? (
                 <div className="flex-1 space-y-10">
                    <div>
                       <div className={`text-7xl font-black italic tracking-tighter uppercase leading-none mb-4 ${
                         guidance.status === 'GO' ? 'text-emerald-500' : 
                         guidance.status === 'NOGO' ? 'text-red-500' : 'text-yellow-500'
                       }`}>
                         {guidance.status}
                       </div>
                       
                       <div className="mb-6">
                          <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-zinc-600 mb-2">
                             <span>Hazard</span>
                             <span>Safety Index: {guidance.safetyIndex}%</span>
                             <span>Clear</span>
                          </div>
                          <div className="h-2 w-full bg-zinc-950 border border-zinc-900 relative overflow-hidden">
                             <div 
                                className={`absolute h-full transition-all duration-1000 ease-out ${getSafetyColor(guidance.safetyIndex)}`}
                                style={{ width: `${guidance.safetyIndex}%` }}
                             ></div>
                          </div>
                       </div>

                       <p className="text-[12px] text-zinc-400 leading-relaxed font-black uppercase tracking-widest border-l-2 border-zinc-800 pl-4">
                          {guidance.reasoning}
                       </p>
                    </div>

                    <div className="space-y-4">
                       <h4 className="text-[9px] font-black uppercase text-zinc-600 tracking-[0.3em]">Operational Protocol</h4>
                       <div className="grid grid-cols-1 gap-3">
                         {guidance.packingHints?.map((hint, i) => (
                           <div key={i} className="flex gap-4 items-start text-[11px] text-zinc-200 bg-zinc-950/50 p-4 border border-zinc-800/50 group hover:border-zinc-700 transition-colors">
                             <div className="mt-0.5 text-zinc-600"><Icons.Check /></div>
                             <span className="font-bold tracking-wide uppercase leading-tight">{hint}</span>
                           </div>
                         ))}
                       </div>
                    </div>
                 </div>
               ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-zinc-800 gap-4">
                    <div className="w-8 h-8 border-2 border-zinc-800 border-t-indigo-500 rounded-full animate-spin"></div>
                    <span className="text-[10px] font-black uppercase tracking-[0.4em]">Simulating Scenario...</span>
                 </div>
               )}
            </section>
          </div>

          <section className={`${currentTheme.card} p-10 border relative overflow-hidden group`}>
             <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Icons.Compass />
             </div>
             <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-8 border-b border-zinc-900 pb-4">Briefing Intelligence</h3>
             <div className="relative z-10">
               {guidance ? (
                 <div className="space-y-8">
                    <p className="text-zinc-300 text-base leading-9 max-w-3xl font-medium tracking-wide first-letter:text-4xl first-letter:font-black first-letter:float-left first-letter:mr-3 first-letter:text-zinc-100">
                       {guidance.aiSummary}
                    </p>
                    
                    {isFireMode && fireAlerts && (
                      <div className="p-6 bg-orange-950/10 border border-orange-900/20 mt-8 shadow-2xl">
                        <div className="text-[11px] font-black text-orange-600 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                           <span className="animate-pulse"><Icons.Alert /></span> ACTIVE WILDFIRE FEED
                        </div>
                        <p className="text-[11px] text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed bg-zinc-950/40 p-4 border border-zinc-900 shadow-inner">
                           {fireAlerts}
                        </p>
                      </div>
                    )}

                    <div className="pt-8 border-t border-zinc-800/50 mt-12 flex items-center gap-6">
                       <div className="w-14 h-14 bg-zinc-950 flex items-center justify-center text-zinc-600 font-black text-lg border border-zinc-800 shadow-2xl">
                         R
                       </div>
                       <div>
                         <div className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Operational Data Node</div>
                         <div className="text-[9px] font-mono text-zinc-700 uppercase tracking-[0.4em] mt-1 italic">Grounded Observation Layer</div>
                       </div>
                    </div>
                 </div>
               ) : (
                 <div className="space-y-4 animate-pulse">
                    <div className="h-4 bg-zinc-900 w-full" />
                    <div className="h-4 bg-zinc-900 w-5/6" />
                 </div>
               )}
            </div>
          </section>

          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {[
               { icon: <Icons.Backpack />, label: 'Logistics', val: 'V-READY' },
               { icon: <Icons.Wind />, label: 'Sensors', val: 'L-SYNC' },
               { icon: <Icons.Temp />, label: 'Grounding', val: 'ACTIVE' },
               { icon: <Icons.Alert />, label: 'Rescue Link', val: 'ENCRYPT' }
             ].map((item, i) => (
               <div key={i} className={`${currentTheme.card} p-5 border border-zinc-800/40 flex flex-col items-center justify-center text-center hover:bg-zinc-800/20 transition-all cursor-default`}>
                  <div className="mb-3 opacity-20 text-zinc-400">{item.icon}</div>
                  <div className="text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-1.5">{item.label}</div>
                  <div className={`text-[10px] font-black tracking-widest text-zinc-300 uppercase`}>{item.val}</div>
               </div>
             ))}
          </section>
        </div>
      </main>
    </div>
  );
};

export default App;

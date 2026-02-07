
import React, { useState, useEffect, useRef } from 'react';
import { 
  Mountain, 
  Home, 
  Camera, 
  Map as MapIcon, 
  Info, 
  Thermometer, 
  Wind, 
  CloudRain,
  Navigation,
  Compass,
  MapPin,
  Waves,
  Image as ImageIcon,
  History,
  Locate,
  Layers,
  Crosshair,
  TrendingUp,
  Activity
} from 'lucide-react';
import L from 'leaflet';
import { identifyLandmark, getVillageInsights, getSearchInfo } from './services/geminiService';
import { MountainInfo, VillageInfo, TrekPoint } from './types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Real-world approximate coordinates for the trail starting from Beni through Takam towards Dhaulagiri BC
const MOCK_TREK_DATA: TrekPoint[] = [
  { day: 1, altitude: 830, label: 'Beni', lat: 28.3444, lng: 83.5651 },
  { day: 2, altitude: 1200, label: 'Darbang', lat: 28.4067, lng: 83.4000 },
  { day: 3, altitude: 1670, label: 'Takam Village', lat: 28.4230, lng: 83.3333 },
  { day: 4, altitude: 2200, label: 'Muri Village', lat: 28.4833, lng: 83.2500 },
  { day: 5, altitude: 3100, label: 'Boghara', lat: 28.5333, lng: 83.2333 },
  { day: 6, altitude: 3660, label: 'Dobang', lat: 28.5833, lng: 83.2167 },
  { day: 7, altitude: 4740, label: 'Dhaulagiri BC', lat: 28.6750, lng: 83.4722 },
];

const REGIONAL_GALLERY = [
  {
    url: "https://images.unsplash.com/photo-1621516091010-a26249539fbe?q=80&w=1000&auto=format&fit=crop",
    title: "Poon Hill (3,210m)",
    desc: "The world-famous sunrise point showing the Dhaulagiri and Annapurna ranges."
  },
  {
    url: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=1000&auto=format&fit=crop",
    title: "Beni Bazaar",
    desc: "The bustling gateway town at the confluence of Myagdi and Kali Gandaki rivers."
  },
  {
    url: "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?q=80&w=1000&auto=format&fit=crop",
    title: "Takam Village",
    desc: "A historic village with golden terraced fields and deep cultural roots."
  }
];

// Helper to calculate total polyline distance
const calculateTotalDistance = (points: TrekPoint[]) => {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = L.latLng(points[i].lat, points[i].lng);
    const p2 = L.latLng(points[i+1].lat, points[i+1].lng);
    total += p1.distanceTo(p2);
  }
  return (total / 1000).toFixed(2); // In km
};

// Satellite Map Component
const SatelliteMapView: React.FC<{ lat: number; lng: number, trail: TrekPoint[] }> = ({ lat, lng, trail }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const userMarker = useRef<L.Marker | null>(null);
  const trailLayer = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (mapRef.current && !leafletMap.current) {
      leafletMap.current = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([lat, lng], 13);

      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
      }).addTo(leafletMap.current);

      // User Position Marker
      const userIcon = L.divIcon({
        className: 'custom-user-icon',
        html: `<div class="w-6 h-6 bg-blue-500 rounded-full border-4 border-white shadow-xl ring-4 ring-blue-500/20 animate-pulse"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      userMarker.current = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(leafletMap.current);

      // Trail Polyline
      const latLngs = trail.map(p => L.latLng(p.lat, p.lng));
      trailLayer.current = L.polyline(latLngs, {
        color: '#10b981',
        weight: 6,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: '1, 12'
      }).addTo(leafletMap.current);

      // Waypoint Markers
      trail.forEach((p, idx) => {
        const wpIcon = L.divIcon({
          className: 'wp-icon',
          html: `<div class="flex flex-col items-center">
                   <div class="w-4 h-4 bg-white rounded-full border-2 border-emerald-600 shadow-sm"></div>
                   <div class="mt-1 px-2 py-0.5 bg-slate-900/80 backdrop-blur-sm text-white text-[8px] font-black rounded-md whitespace-nowrap border border-white/20">${p.label}</div>
                 </div>`,
          iconSize: [60, 40],
          iconAnchor: [30, 8]
        });
        L.marker([p.lat, p.lng], { icon: wpIcon }).addTo(leafletMap.current!);
      });

      // Fit trail in view initially
      leafletMap.current.fitBounds(trailLayer.current.getBounds(), { padding: [50, 50] });
    }

    if (leafletMap.current) {
      userMarker.current?.setLatLng([lat, lng]);
    }
  }, [lat, lng, trail]);

  const handleRecenter = () => {
    leafletMap.current?.flyTo([lat, lng], 15);
  };

  const showEntireTrail = () => {
    if (trailLayer.current) {
      leafletMap.current?.flyToBounds(trailLayer.current.getBounds(), { padding: [50, 50] });
    }
  };

  return (
    <div className="relative w-full h-[500px] rounded-[48px] overflow-hidden border-4 border-white shadow-2xl">
      <div ref={mapRef} className="w-full h-full bg-slate-200" />
      
      {/* Map Stats HUD */}
      <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-50 pointer-events-none">
        <div className="bg-emerald-600 text-white px-5 py-3 rounded-[24px] shadow-2xl flex items-center gap-3 backdrop-blur-md border border-emerald-400/30 pointer-events-auto">
          <div className="p-2 bg-white/20 rounded-xl">
             <Activity className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 leading-none mb-1">Total Trail Tracked</span>
            <span className="text-xl font-black">{calculateTotalDistance(trail)} <span className="text-xs opacity-60">KM</span></span>
          </div>
        </div>

        <div className="flex flex-col gap-3 pointer-events-auto">
          <button 
            onClick={handleRecenter}
            className="p-4 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl text-slate-900 hover:bg-emerald-500 hover:text-white transition-all active:scale-95 border border-slate-200"
          >
            <Locate className="w-6 h-6" />
          </button>
          <button 
            onClick={showEntireTrail}
            className="p-4 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl text-slate-900 hover:bg-blue-500 hover:text-white transition-all active:scale-95 border border-slate-200"
            title="View Entire Trail"
          >
            <TrendingUp className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="absolute bottom-6 left-6 right-6 z-50 pointer-events-none">
        <div className="flex justify-between items-end">
          <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 p-5 rounded-[32px] shadow-2xl flex items-center gap-4 pointer-events-auto">
            <div className="p-3 bg-emerald-500 rounded-2xl">
              <Crosshair className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1.5">Live GPS Pulse</span>
              <span className="text-white font-mono text-xs font-bold bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                {lat.toFixed(6)}°N, {lng.toFixed(6)}°E
              </span>
            </div>
          </div>
          
          <div className="bg-white/95 backdrop-blur-md p-4 rounded-[24px] shadow-xl border border-slate-100 pointer-events-auto">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">House Tracking Mode</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-black text-slate-900">Satellite High-Resolution</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'scanner' | 'trek' | 'about'>('home');
  const [landmark, setLandmark] = useState<MountainInfo | null>(null);
  const [village, setVillage] = useState<VillageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [weatherData, setWeatherData] = useState<{ temp: number; desc: string } | null>(null);
  const [currentAltitude, setCurrentAltitude] = useState<number | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number }>({ lat: 28.4230, lng: 83.3333 }); // Default: Takam
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    loadVillageData('Takam Village, Myagdi');
    
    // Initial Geolocation
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (pos.coords.altitude !== null) setCurrentAltitude(Math.round(pos.coords.altitude));
      });
    }
  }, []);

  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setCurrentLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
          if (position.coords.altitude !== null) {
            setCurrentAltitude(Math.round(position.coords.altitude));
          }
        },
        (error) => console.error(error),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  const loadVillageData = async (name: string) => {
    setLoading(true);
    try {
      const data = await getVillageInsights(name);
      setVillage(data);
      const search = await getSearchInfo(`current weather in Takam Nepal Myagdi`);
      setWeatherData({ temp: 16, desc: search.text.slice(0, 100) + '...' });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const fullBase64 = e.target?.result as string;
      setPreviewImage(fullBase64);
      const base64Data = fullBase64.split(',')[1];
      try {
        const info = await identifyLandmark(base64Data);
        setLandmark(info);
        setActiveTab('scanner');
      } catch (err) {
        alert('Failed to identify feature. Please try a clearer shot.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const displayedAltitude = currentAltitude ?? MOCK_TREK_DATA[2].altitude;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-20">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2" onClick={() => setActiveTab('home')}>
          <div className="bg-emerald-600 p-2 rounded-xl shadow-lg shadow-emerald-200 cursor-pointer">
            <Compass className="text-white w-6 h-6" />
          </div>
          <div className="cursor-pointer">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">Takam Tourism</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Myagdi • Nepal</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 mr-1.5" />
            <span className="text-sm font-semibold text-emerald-700">{village?.name || 'Takam'}</span>
          </div>
          <div className="w-9 h-9 rounded-xl border-2 border-white shadow-sm bg-slate-200 overflow-hidden">
             <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Takam" alt="User" />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6">
        {activeTab === 'home' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Hero Section - Updated with the specific Poon Hill Signpost photo requested by the user */}
            <div className="relative h-96 rounded-[32px] overflow-hidden shadow-2xl shadow-slate-200 group">
              <img 
                src="https://images.unsplash.com/photo-1621516091010-a26249539fbe?q=80&w=2000&auto=format&fit=crop" 
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                alt="Poon Hill Signpost"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/95 via-slate-900/20 to-transparent flex flex-col justify-end p-10">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-emerald-500 text-white font-black text-[10px] px-2.5 py-1 rounded-md uppercase tracking-widest shadow-lg">Featured Location</span>
                  <span className="text-emerald-300 font-bold text-[10px] uppercase tracking-[0.2em]">Poon Hill • 3,210m</span>
                </div>
                <h2 className="text-5xl font-black text-white mb-4 leading-tight">Sacred Peaks & Hidden Trails</h2>
                <div className="flex flex-wrap gap-4 text-white/90 text-xs font-bold">
                  <span className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-2xl backdrop-blur-xl border border-white/20">
                    <Compass className="w-4 h-4 text-emerald-400" /> Elevation: {village?.altitude || '1,670m'}
                  </span>
                  <span className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-2xl backdrop-blur-xl border border-white/20">
                    <Thermometer className="w-4 h-4 text-blue-400" /> {weatherData?.temp ?? '16'}°C
                  </span>
                </div>
              </div>
            </div>

            {/* Regional Landscapes - Gallery of the requested images */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2.5">
                  <ImageIcon className="w-6 h-6 text-emerald-600" />
                  Explore the Region
                </h3>
                <button className="text-xs font-black text-emerald-600 uppercase tracking-widest hover:underline bg-emerald-50 px-3 py-1.5 rounded-full">View All</button>
              </div>
              <div className="flex overflow-x-auto gap-6 pb-6 no-scrollbar snap-x">
                {REGIONAL_GALLERY.map((item, i) => (
                  <div key={i} className="min-w-[300px] bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm group snap-center hover:shadow-xl hover:shadow-slate-200 transition-all duration-300">
                    <div className="h-44 overflow-hidden relative">
                      <img src={item.url} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase text-slate-900 tracking-tighter">
                        Photo {i+1}
                      </div>
                    </div>
                    <div className="p-5">
                      <h4 className="font-black text-slate-900 text-lg mb-1">{item.title}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium line-clamp-2">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Navigation Cards */}
            <div className="grid grid-cols-2 gap-6">
              <label className="flex flex-col items-center justify-center p-8 bg-white rounded-[32px] border border-slate-200 shadow-sm hover:border-emerald-500 transition-all cursor-pointer group hover:bg-emerald-50/20 active:scale-95">
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-6 transition-transform shadow-lg shadow-emerald-50">
                  <Camera className="w-8 h-8 text-emerald-600" />
                </div>
                <span className="font-black text-slate-900 text-lg">Visual Search</span>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1 text-center">Scan Peaks & Landmarks</span>
              </label>
              
              <button 
                onClick={() => setActiveTab('trek')}
                className="flex flex-col items-center justify-center p-8 bg-white rounded-[32px] border border-slate-200 shadow-sm hover:border-blue-500 transition-all group hover:bg-blue-50/20 active:scale-95"
              >
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:-rotate-6 transition-transform shadow-lg shadow-blue-50">
                  <MapIcon className="w-8 h-8 text-blue-600" />
                </div>
                <span className="font-black text-slate-900 text-lg">Total Tracking</span>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1 text-center">Satellite Trail & House Map</span>
              </button>
            </div>

            {/* Cultural Insights */}
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-xl"><History className="w-5 h-5 text-emerald-600" /></div>
                  The Jewel of Myagdi
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-6 font-medium italic">
                  Takam is not just a village; it's a living history. Once the center of a powerful kingdom, its terraced fields and the ancient Takam Kot fortress offer a window into the soul of the Himalayas.
                </p>
                <div className="flex gap-4">
                   <div className="flex-1 bg-emerald-50 p-4 rounded-3xl border border-emerald-100">
                      <span className="text-[10px] font-black uppercase text-emerald-600 mb-1 block">Elevation</span>
                      <span className="text-lg font-black text-slate-900">1,670m</span>
                   </div>
                   <div className="flex-1 bg-blue-50 p-4 rounded-3xl border border-blue-100">
                      <span className="text-[10px] font-black uppercase text-blue-600 mb-1 block">Trail Length</span>
                      <span className="text-lg font-black text-slate-900">{calculateTotalDistance(MOCK_TREK_DATA)} km</span>
                   </div>
                </div>
            </div>
          </div>
        )}

        {activeTab === 'scanner' && (
          <div className="space-y-6 animate-in zoom-in-95 duration-300">
            {landmark ? (
              <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-2xl">
                <div className="h-80 relative bg-slate-100">
                  <img src={previewImage || "https://images.unsplash.com/photo-1582294109312-70131ed26a45?q=80&w=800"} className="w-full h-full object-cover" alt="Scanned Result" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent"></div>
                  <div className="absolute top-6 left-6 bg-emerald-500 text-white text-[10px] font-black px-5 py-2 rounded-full uppercase tracking-[0.2em] shadow-xl">
                    Landmark Identified
                  </div>
                  <div className="absolute bottom-8 left-8 right-8">
                    <h2 className="text-5xl font-black text-white mb-2 drop-shadow-2xl">{landmark.name}</h2>
                    <p className="text-emerald-400 font-black tracking-[0.3em] text-xl uppercase drop-shadow-md">{landmark.elevation}</p>
                  </div>
                </div>
                <div className="p-10">
                  <div className="flex gap-4 mb-10 overflow-x-auto no-scrollbar">
                    <span className="bg-emerald-50 text-emerald-700 px-6 py-2.5 rounded-2xl text-xs font-black border border-emerald-100 flex items-center gap-2 whitespace-nowrap shadow-sm">
                      <ImageIcon className="w-4 h-4" /> Feature Identified
                    </span>
                    <span className="bg-slate-100 text-slate-600 px-6 py-2.5 rounded-2xl text-xs font-black border border-slate-200 uppercase tracking-widest whitespace-nowrap">
                      {landmark.difficulty || "Moderate"}
                    </span>
                  </div>
                  
                  <div className="space-y-10">
                    <section>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-2.5">
                        <History className="w-4 h-4 text-emerald-500" /> Background & Significance
                      </h4>
                      <div className="bg-slate-50 p-8 rounded-[32px] border-l-8 border-emerald-500 shadow-sm">
                        <p className="text-slate-800 leading-relaxed italic font-bold text-lg">
                          "{landmark.significance}"
                        </p>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Detailed Description</h4>
                      <p className="text-slate-600 leading-relaxed text-xl font-medium">
                        {landmark.description}
                      </p>
                    </section>

                    <button 
                      onClick={() => { setLandmark(null); setPreviewImage(null); }}
                      className="w-full py-6 bg-slate-900 text-white font-black text-xl rounded-[24px] hover:bg-black transition-all shadow-2xl shadow-slate-200 active:scale-95"
                    >
                      Scan Next Landmark
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[70vh] text-center px-10">
                <div className="relative mb-10">
                   <div className="absolute -inset-8 bg-emerald-500/20 blur-[100px] rounded-full"></div>
                   <div className="relative w-32 h-32 bg-white rounded-[40px] border border-slate-200 shadow-2xl flex items-center justify-center text-emerald-600 rotate-12 group hover:rotate-0 transition-transform duration-500">
                     <Camera className="w-16 h-16 -rotate-12 group-hover:rotate-0 transition-transform duration-500" />
                   </div>
                </div>
                <h3 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Instant Visual Search</h3>
                <p className="text-slate-500 mb-12 max-w-sm text-lg font-medium leading-relaxed">
                  Point your camera at mountains, rivers like the Myagdi Khola, or any landmark to identify it instantly.
                </p>
                <label className="px-16 py-6 bg-emerald-600 text-white font-black text-xl rounded-[24px] hover:bg-emerald-700 transition-all cursor-pointer shadow-2xl shadow-emerald-100 active:scale-95 flex items-center gap-3">
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                  <Camera className="w-6 h-6" /> Take or Choose Photo
                </label>
              </div>
            )}
          </div>
        )}

        {activeTab === 'trek' && (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 pb-10">
            {/* Enhanced Live Satellite Map View */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-4">
                  <div className="p-3 bg-emerald-100 rounded-2xl">
                    <Layers className="w-8 h-8 text-emerald-600" />
                  </div>
                  Total Tracking Map
                </h3>
                <div className="flex items-center gap-2">
                   <span className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider border border-emerald-100">
                    Live Trail View
                   </span>
                </div>
              </div>
              
              <SatelliteMapView 
                lat={currentLocation.lat} 
                lng={currentLocation.lng} 
                trail={MOCK_TREK_DATA} 
              />
              
              <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center gap-8">
                 <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center border border-emerald-200 shrink-0">
                    <Home className="w-10 h-10 text-emerald-600" />
                 </div>
                 <div className="flex-1">
                    <h4 className="text-xl font-black text-slate-900 mb-1">Satellite House Tracking</h4>
                    <p className="text-slate-500 text-sm font-medium leading-relaxed">
                      Visualize traditional Himalayan houses from above. The high-resolution satellite feed allows you to track homesteads along the {calculateTotalDistance(MOCK_TREK_DATA)} km route from Beni to Dhaulagiri.
                    </p>
                 </div>
                 <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 text-center md:text-right shrink-0">
                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Total Distance Tracked</span>
                    <span className="text-3xl font-black text-emerald-600">{calculateTotalDistance(MOCK_TREK_DATA)} km</span>
                 </div>
              </div>
            </section>

            {/* Altitude Tracker */}
            <div className="bg-white p-10 rounded-[48px] border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute -top-10 -right-10 p-4 opacity-[0.03]">
                 <MapPin className="w-80 h-80 text-emerald-600" />
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 mb-12 relative z-10">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-2xl"><TrendingUp className="w-8 h-8 text-blue-600" /></div>
                    Vertical Elevation Profile
                  </h3>
                  <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-2">Dhaulagiri Region • Vertical Tracking</p>
                </div>

                <div className="bg-slate-900 text-white px-10 py-6 rounded-[32px] shadow-2xl flex flex-col items-center border border-white/5 relative group">
                   <div className="absolute -inset-1 bg-emerald-500/20 blur opacity-0 group-hover:opacity-100 transition-opacity rounded-[32px]"></div>
                   <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-1.5 relative">
                     Active Altitude
                   </span>
                   <div className="flex items-baseline gap-2 relative">
                     <span className="text-5xl font-black tracking-tighter">{displayedAltitude}</span>
                     <span className="text-lg font-black text-emerald-400 uppercase">m</span>
                   </div>
                </div>
              </div>

              <div className="h-64 w-full relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={MOCK_TREK_DATA}>
                    <defs>
                      <linearGradient id="colorAlt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="label" 
                      fontSize={10} 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontWeight: 800 }}
                      dy={10}
                    />
                    <YAxis 
                      fontSize={10} 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontWeight: 800 }}
                      unit="m"
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '16px 20px', backgroundColor: 'rgba(255,255,255,0.95)', backdropBlur: '10px' }}
                      labelStyle={{ fontWeight: '900', color: '#1e293b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '10px' }}
                      itemStyle={{ color: '#059669', fontWeight: '900', fontSize: '16px' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="altitude" 
                      stroke="#059669" 
                      strokeWidth={5}
                      fillOpacity={1} 
                      fill="url(#colorAlt)" 
                      dot={{ r: 6, fill: '#059669', strokeWidth: 3, stroke: '#fff' }}
                      activeDot={{ r: 8, strokeWidth: 0, fill: '#10b981' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="space-y-10 text-center py-20 animate-in slide-in-from-bottom-10 duration-700">
            <div className="bg-white p-16 rounded-[64px] border border-slate-200 shadow-2xl max-w-xl mx-auto relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-emerald-500 to-blue-500"></div>
              <div className="relative z-10">
                <div className="w-28 h-28 bg-slate-900 rounded-[40px] mx-auto flex items-center justify-center mb-10 rotate-6 group-hover:rotate-0 transition-transform duration-500 shadow-2xl shadow-slate-300">
                  <Compass className="text-white w-14 h-14" />
                </div>
                <h2 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">Takam Tourism Nepal</h2>
                <p className="text-emerald-600 font-black text-xs uppercase tracking-[0.4em] mb-10 italic">The Jewel of Myagdi</p>
                <p className="text-slate-500 mb-12 text-xl font-medium leading-relaxed max-w-sm mx-auto">
                  High-performance visual intelligence and live satellite tracking monitoring suite crafted for the modern Himalayan explorer.
                </p>
                <div className="flex justify-center gap-4">
                  <div className="px-6 py-3 bg-slate-50 rounded-2xl border border-slate-200 font-black text-xs uppercase tracking-widest text-slate-500">Ver 2.8.0 Pro</div>
                  <div className="px-6 py-3 bg-emerald-50 rounded-2xl border border-emerald-100 font-black text-xs uppercase tracking-widest text-emerald-600">Maps & Trail AI</div>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">Built with Passion in Myagdi</p>
              <div className="flex gap-6 grayscale opacity-30">
                <Compass className="w-6 h-6" />
                <Mountain className="w-6 h-6" />
                <MapPin className="w-6 h-6" />
              </div>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-2xl border-t border-slate-200 px-10 py-5 flex justify-around items-center z-[100] shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.1)]">
        <NavButton active={activeTab === 'home'} icon={<Home />} label="Discover" onClick={() => setActiveTab('home')} />
        <NavButton active={activeTab === 'scanner'} icon={<Camera />} label="Scanner" onClick={() => setActiveTab('scanner')} />
        <NavButton active={activeTab === 'trek'} icon={<MapIcon />} label="Tracks" onClick={() => setActiveTab('trek')} />
        <NavButton active={activeTab === 'about'} icon={<Info />} label="About" onClick={() => setActiveTab('about')} />
      </nav>

      {loading && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[200] flex items-center justify-center flex-col gap-8">
          <div className="relative">
             <div className="w-24 h-24 border-8 border-white/10 rounded-[32px]"></div>
             <div className="absolute inset-0 w-24 h-24 border-8 border-emerald-500 border-t-transparent rounded-[32px] animate-spin"></div>
             <Compass className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 text-white animate-pulse" />
          </div>
          <div className="text-center">
            <p className="text-white font-black tracking-[0.6em] text-sm uppercase mb-2">Analyzing Terrain</p>
            <p className="text-emerald-300 font-bold text-[10px] uppercase tracking-widest">Querying Gemini Visual Engine...</p>
          </div>
        </div>
      )}
    </div>
  );
};

const NavButton: React.FC<{ 
  active: boolean; 
  icon: React.ReactNode; 
  label: string; 
  onClick: () => void 
}> = ({ active, icon, label, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-2 transition-all duration-300 relative ${active ? 'text-emerald-600 scale-110' : 'text-slate-400 hover:text-slate-600'}`}
  >
    <div className={`p-2.5 rounded-2xl transition-all duration-300 ${active ? 'bg-emerald-50 shadow-inner' : 'bg-transparent'}`}>
      {React.cloneElement(icon as React.ReactElement, { className: `w-6 h-6 ${active ? 'stroke-[2.5px]' : 'stroke-[2px]'}` })}
    </div>
    <span className={`text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
    {active && (
      <div className="absolute -top-1 right-0 w-2 h-2 bg-emerald-500 rounded-full ring-4 ring-white animate-bounce"></div>
    )}
  </button>
);

export default App;

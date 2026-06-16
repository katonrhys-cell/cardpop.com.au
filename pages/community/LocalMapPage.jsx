import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import SEOHead from '@/components/SEOHead.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { geocodeSuburb, STATE_CENTROIDS } from '@/lib/geocode.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Store, Calendar, Users, Filter, X, Loader2, Info } from 'lucide-react';

// ─── LEGEND CONFIG ───────────────────────────────────────────────────────────

const MARKER_TYPES = {
  retailer:    { label: 'Retailer / LGS',     color: '#f59e0b', icon: '🏪' },
  card_show:   { label: 'Card Show',           color: '#3b82f6', icon: '🃏' },
  trade_event: { label: 'Trade Event',         color: '#8b5cf6', icon: '🤝' },
  lgs_event:   { label: 'Store Event',         color: '#06b6d4', icon: '🏬' },
  community_event: { label: 'Community Event', color: '#22c55e', icon: '🌟' },
  hobbyist:    { label: 'Hobbyist / Trader',   color: '#ec4899', icon: '👤' },
};

const STATES = ['All States', 'NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Fix Leaflet default icon broken paths in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function makeIcon(type) {
  const cfg = MARKER_TYPES[type] || MARKER_TYPES.retailer;
  return L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      background:${cfg.color};
      border:2px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
    "><span style="transform:rotate(45deg);font-size:13px;line-height:1">${cfg.icon}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -36],
  });
}

function userIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:20px;height:20px;border-radius:50%;
      background:#ef4444;border:3px solid white;
      box-shadow:0 0 0 3px rgba(239,68,68,0.3),0 2px 6px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function haversineKm([lat1, lon1], [lat2, lon2]) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── FLY-TO COMPONENT ────────────────────────────────────────────────────────

function FlyTo({ coords }) {
  const map = useMap();
  useEffect(() => { if (coords) map.flyTo(coords, 10, { duration: 1.2 }); }, [coords, map]);
  return null;
}

// ─── POPUP CARD ──────────────────────────────────────────────────────────────

function MarkerPopup({ item, userCoords }) {
  const dist = userCoords && item.coords
    ? haversineKm(userCoords, item.coords).toFixed(1)
    : null;

  const cfg = MARKER_TYPES[item.type] || MARKER_TYPES.retailer;

  return (
    <div style={{ minWidth: 200, maxWidth: 260, fontFamily: 'inherit' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{cfg.icon}</span>
        <div>
          <p className="font-bold text-sm leading-tight">{item.name}</p>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: cfg.color + '22', color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
      </div>

      {item.location && (
        <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
          <MapPin size={11} /> {item.location}
        </p>
      )}

      {item.date && (
        <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
          <Calendar size={11} /> {item.date}
        </p>
      )}

      {item.description && (
        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2 leading-relaxed">
          {item.description}
        </p>
      )}

      {dist && (
        <p className="text-xs font-semibold text-blue-600 mb-2">
          📍 {dist} km from your location
        </p>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer"
            className="text-[11px] px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium transition-colors">
            Visit →
          </a>
        )}
        {item.eventUrl && (
          <a href={item.eventUrl} target="_blank" rel="noopener noreferrer"
            className="text-[11px] px-2 py-1 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 font-medium transition-colors">
            Event Info →
          </a>
        )}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

const LocalMapPage = () => {
  const [rawItems, setRawItems] = useState([]);  // items without coords yet
  const [markers, setMarkers] = useState([]);     // items with coords resolved
  const [geocodingCount, setGeocodingCount] = useState(0);
  const [geocodedCount, setGeocodedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [userCoords, setUserCoords] = useState(null);
  const [userAddress, setUserAddress] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');

  const [stateFilter, setStateFilter] = useState('All States');
  const [activeTypes, setActiveTypes] = useState(new Set(Object.keys(MARKER_TYPES)));
  const [flyCoords, setFlyCoords] = useState(null);

  // ── Fetch raw data ──────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      setLoading(true);
      const results = [];

      // Retailers with physical stores
      try {
        const { data: retailers } = await supabase
          .from('business_profiles')
          .select('id, business_name, store_suburb, store_state, store_address, store_postcode, specialises_in, website_url, logo_url')
          .eq('has_physical_store', true)
          .not('store_suburb', 'is', null);

        (retailers || []).forEach(r => {
          results.push({
            id: 'retailer-' + r.id,
            type: 'retailer',
            name: r.business_name || 'Card Store',
            suburb: r.store_suburb,
            state: r.store_state,
            location: [r.store_address, r.store_suburb, r.store_state].filter(Boolean).join(', '),
            description: r.specialises_in?.length ? `Specialises in: ${r.specialises_in.join(', ')}` : null,
            url: r.website_url,
          });
        });
      } catch (e) { console.warn('retailers fetch:', e); }

      // Upcoming / recent events
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: events } = await supabase
          .from('events_public')
          .select('id, title, event_type, venue_name, address, suburb, state, postcode, start_date, end_date, website_url, slug')
          .gte('start_date', today)
          .order('start_date', { ascending: true })
          .limit(200);

        (events || []).forEach(ev => {
          results.push({
            id: 'event-' + ev.id,
            type: ev.event_type || 'community_event',
            name: ev.title,
            suburb: ev.suburb,
            state: ev.state,
            location: [ev.venue_name, ev.address, ev.suburb, ev.state].filter(Boolean).join(', '),
            date: ev.start_date,
            url: ev.website_url,
            eventUrl: ev.slug ? `/events/${ev.slug}` : `/events/${ev.id}`,
          });
        });
      } catch (e) { console.warn('events fetch:', e); }

      // Verified hobbyists / traders with location
      try {
        const { data: traders } = await supabase
          .from('profiles')
          .select('id, display_name, username, location_suburb, location_state, is_verified')
          .eq('is_verified', true)
          .not('location_suburb', 'is', null)
          .limit(100);

        (traders || []).forEach(t => {
          results.push({
            id: 'hobbyist-' + t.id,
            type: 'hobbyist',
            name: t.display_name || t.username || 'Hobbyist',
            suburb: t.location_suburb,
            state: t.location_state,
            location: [t.location_suburb, t.location_state].filter(Boolean).join(', '),
            url: t.username ? `/community/user/${t.username}` : null,
          });
        });
      } catch (e) { console.warn('traders fetch:', e); }

      if (!cancelled) {
        setRawItems(results);
        setLoading(false);
      }
    }
    fetchAll();
    return () => { cancelled = true; };
  }, []);

  // ── Geocode raw items progressively ────────────────────────────────────────

  useEffect(() => {
    if (rawItems.length === 0) return;
    let cancelled = false;

    const toGeocode = rawItems.filter(it => it.suburb && it.state);
    setGeocodingCount(toGeocode.length);
    setGeocodedCount(0);

    // Items without suburb fall back to state centroid immediately
    const noGeo = rawItems.filter(it => !it.suburb || !it.state).map(it => ({
      ...it,
      coords: it.state ? STATE_CENTROIDS[it.state?.toUpperCase()] || null : null,
    }));
    if (!cancelled) setMarkers(noGeo);

    let done = 0;
    const resolved = [...noGeo];

    async function geocodeAll() {
      for (const item of toGeocode) {
        if (cancelled) break;
        const coords = await geocodeSuburb(item.suburb, item.state);
        done++;
        if (!cancelled) {
          setGeocodedCount(done);
          const stateCoords = item.state ? STATE_CENTROIDS[item.state?.toUpperCase()] : null;
          resolved.push({ ...item, coords: coords || stateCoords });
          setMarkers([...resolved]);
        }
      }
    }
    geocodeAll();
    return () => { cancelled = true; };
  }, [rawItems]);

  // ── User location ───────────────────────────────────────────────────────────

  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) { setGeoError('Geolocation not supported by your browser.'); return; }
    setGeoLoading(true); setGeoError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setUserCoords(coords);
        setFlyCoords(coords);
        setGeoLoading(false);
        setUserAddress('My Location');
      },
      () => { setGeoError('Could not access your location. Try typing a suburb below.'); setGeoLoading(false); }
    );
  }, []);

  const handleAddressSearch = useCallback(async () => {
    const val = userAddress.trim();
    if (!val) return;
    setGeoLoading(true); setGeoError('');
    try {
      const q = encodeURIComponent(val + ', Australia');
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=au`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'CardPop.online/1.0' } }
      );
      const data = await res.json();
      if (data[0]) {
        const coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        setUserCoords(coords);
        setFlyCoords(coords);
      } else {
        setGeoError('Location not found. Try a suburb + state (e.g. "Parramatta NSW").');
      }
    } catch {
      setGeoError('Search failed. Please try again.');
    }
    setGeoLoading(false);
  }, [userAddress]);

  // ── Filtering ───────────────────────────────────────────────────────────────

  const toggleType = useCallback(type => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  }, []);

  const filteredMarkers = useMemo(() => {
    return markers.filter(m => {
      if (!m.coords) return false;
      if (!activeTypes.has(m.type)) return false;
      if (stateFilter !== 'All States' && m.state?.toUpperCase() !== stateFilter) return false;
      return true;
    });
  }, [markers, activeTypes, stateFilter]);

  // Sort by distance if user location set
  const sortedMarkers = useMemo(() => {
    if (!userCoords) return filteredMarkers;
    return [...filteredMarkers].sort((a, b) =>
      haversineKm(userCoords, a.coords) - haversineKm(userCoords, b.coords)
    );
  }, [filteredMarkers, userCoords]);

  const isGeocoding = geocodedCount < geocodingCount;

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Card Retailer & Event Map Australia | CardPop"
        description="Find trading card retailers, hobby stores, card shows, and community events near you on an interactive map of Australia."
      />

      {/* Hero */}
      <section className="bg-card border-b border-border py-14 text-center">
        <div className="container-default">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 mb-5 shadow-lg">
            <MapPin className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold font-serif mb-3">Card Community Map</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover local card retailers, hobby stores, shows, and community events across Australia.
            Filter by type, state, and your location.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Controls ── */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">

          {/* Location input */}
          <div className="flex-1">
            <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
              <Navigation className="w-3.5 h-3.5" /> Your Location (suburb or postcode)
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Parramatta NSW or 2150"
                value={userAddress}
                onChange={e => setUserAddress(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddressSearch()}
                className="rounded-xl"
              />
              <Button onClick={handleAddressSearch} disabled={geoLoading || !userAddress.trim()} className="rounded-xl shrink-0">
                {geoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
              </Button>
              <Button variant="outline" onClick={handleGeolocate} disabled={geoLoading} className="rounded-xl shrink-0 gap-1.5">
                <Navigation className="w-4 h-4" />
                <span className="hidden sm:inline">Use GPS</span>
              </Button>
            </div>
            {geoError && <p className="text-xs text-red-500 mt-1">{geoError}</p>}
          </div>

          {/* State filter */}
          <div className="shrink-0">
            <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Filter by State
            </p>
            <div className="flex flex-wrap gap-1.5">
              {STATES.map(s => (
                <button
                  key={s}
                  onClick={() => setStateFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    stateFilter === s
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Type toggles / Legend ── */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" /> Show on map
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(MARKER_TYPES).map(([type, cfg]) => {
              const isOn = activeTypes.has(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                    isOn ? 'text-white shadow-sm' : 'bg-transparent text-muted-foreground border-border opacity-50'
                  }`}
                  style={isOn ? { background: cfg.color, borderColor: cfg.color } : { borderColor: cfg.color }}
                >
                  <span>{cfg.icon}</span>
                  {cfg.label}
                </button>
              );
            })}
            <button
              onClick={() => setActiveTypes(new Set(Object.keys(MARKER_TYPES)))}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground transition-all"
            >
              Show All
            </button>
          </div>
        </div>

        {/* ── Status bar ── */}
        <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
          {loading ? (
            <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading locations…</span>
          ) : isGeocoding ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
              Mapping locations… {geocodedCount}/{geocodingCount}
            </span>
          ) : null}
          {!loading && (
            <span className="font-medium text-foreground">
              {sortedMarkers.length} location{sortedMarkers.length !== 1 ? 's' : ''} shown
            </span>
          )}
          {userCoords && (
            <button
              onClick={() => { setUserCoords(null); setUserAddress(''); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ml-auto"
            >
              <X className="w-3.5 h-3.5" /> Clear my location
            </button>
          )}
        </div>

        {/* ── Map ── */}
        <div className="rounded-2xl overflow-hidden border border-border shadow-sm" style={{ height: 560 }}>
          <MapContainer
            center={[-25.2744, 133.7751]}
            zoom={5}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {flyCoords && <FlyTo coords={flyCoords} />}

            {/* User location marker */}
            {userCoords && (
              <Marker position={userCoords} icon={userIcon()}>
                <Popup>
                  <p className="text-sm font-bold">📍 Your Location</p>
                </Popup>
              </Marker>
            )}

            {/* Data markers */}
            {sortedMarkers.map(item => (
              <Marker key={item.id} position={item.coords} icon={makeIcon(item.type)}>
                <Popup maxWidth={280}>
                  <MarkerPopup item={item} userCoords={userCoords} />
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* ── Nearest locations list (when user location set) ── */}
        {userCoords && sortedMarkers.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Navigation className="w-5 h-5 text-blue-500" />
              Closest to You
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sortedMarkers.slice(0, 9).map(item => {
                const dist = haversineKm(userCoords, item.coords).toFixed(1);
                const cfg = MARKER_TYPES[item.type];
                return (
                  <div key={item.id} className="bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{cfg.icon}</span>
                        <p className="font-semibold text-sm leading-tight">{item.name}</p>
                      </div>
                      <Badge
                        className="text-[10px] font-bold shrink-0 text-white"
                        style={{ background: cfg.color }}
                      >
                        {dist} km
                      </Badge>
                    </div>
                    {item.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                        <MapPin className="w-3 h-3 shrink-0" /> {item.location}
                      </p>
                    )}
                    {item.date && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3 shrink-0" /> {item.date}
                      </p>
                    )}
                    {(item.url || item.eventUrl) && (
                      <a
                        href={item.eventUrl || item.url}
                        target={item.eventUrl ? '_self' : '_blank'}
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
                      >
                        View details →
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Info footer ── */}
        <div className="mt-10 bg-muted/40 border border-border rounded-2xl p-6 flex flex-col sm:flex-row gap-4 items-start">
          <div className="shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
          </div>
          <div>
            <h3 className="font-bold mb-1">Are you a retailer, event organiser, or active trader?</h3>
            <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
              Get your store, event, or profile listed on this map. Retailers can apply via the
              Retailers page. Events can be submitted through the Events page. Hobbyists and traders
              appear automatically once your profile is verified.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline" className="rounded-xl text-xs font-bold gap-1.5">
                <a href="/community/retailers"><Store className="w-3.5 h-3.5" /> List Your Store</a>
              </Button>
              <Button asChild size="sm" variant="outline" className="rounded-xl text-xs font-bold gap-1.5">
                <a href="/events"><Calendar className="w-3.5 h-3.5" /> Submit an Event</a>
              </Button>
              <Button asChild size="sm" variant="outline" className="rounded-xl text-xs font-bold gap-1.5">
                <a href="/community/profiles"><Users className="w-3.5 h-3.5" /> Community Profiles</a>
              </Button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LocalMapPage;

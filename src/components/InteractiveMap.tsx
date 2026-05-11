/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Bus } from '../types';
import { Info, MapPin } from 'lucide-react';

// Fix for default marker icons
// @ts-ignore
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const busIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

const stationIcon = (color: string) => new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: ${color}; width: 12px; height: 12px; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

interface InteractiveMapProps {
  bus?: Bus;
  interactive?: boolean;
  onAddMarker?: (pos: [number, number], note: string) => void;
  customMarkers?: { pos: [number, number]; note: string; id: string }[];
}

function MapEvents({ onAddMarker, interactive }: { onAddMarker?: (pos: [number, number], note: string) => void; interactive?: boolean }) {
  useMapEvents({
    click(e) {
      if (interactive && onAddMarker) {
        const note = prompt('Enter a note for this location:');
        if (note) {
          onAddMarker([e.latlng.lat, e.latlng.lng], note);
        }
      }
    },
  });
  return null;
}

function AutoCenter({ pos, isActive }: { pos: [number, number]; isActive?: boolean }) {
  const map = useMap();
  
  React.useEffect(() => {
    if (pos && isActive) {
      map.flyTo(pos, 13, {
        animate: true,
        duration: 2.0,
        easeLinearity: 0.25
      });
    }
  }, [pos, isActive, map]);
  
  return null;
}

const InteractiveMap: React.FC<InteractiveMapProps> = ({ bus, interactive = true, onAddMarker, customMarkers = [] }) => {
  const defaultCenter: [number, number] = [17.9121, 77.5198]; // Default to Bidar
  const [activeBusId, setActiveBusId] = useState<string | null>(null);

  React.useEffect(() => {
    if (bus) {
      setActiveBusId(bus.id);
    } else {
      setActiveBusId(null);
    }
  }, [bus]);

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer 
        center={defaultCenter} 
        zoom={bus ? 13 : 11} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {bus && bus.route.length > 0 && (
          <>
            {/* Background route glow */}
            <Polyline positions={bus.route} color="#3b82f6" weight={10} opacity={0.15} lineCap="round" />
            {/* Secondary route guidance */}
            <Polyline positions={bus.route} color="#004a8d" weight={6} opacity={0.3} lineCap="round" />
            {/* Primary route line */}
            <Polyline positions={bus.route} color="#004a8d" weight={3} opacity={0.9} lineCap="round" />
            
            <Marker position={bus.route[Math.floor(bus.route.length / 1.5)]} icon={busIcon}>
              <Popup>
                <div className="p-1">
                  <div className="font-bold text-ksrtc-blue">{bus.number}</div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase">{bus.type}</div>
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-emerald-600 font-bold">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    {bus.currentSpeed} KM/H
                  </div>
                </div>
              </Popup>
            </Marker>

            {bus.route.map((pos, idx) => {
              if (idx === 0 || idx === bus.route.length - 1) {
                return (
                  <Marker key={idx} position={pos} icon={stationIcon(idx === 0 ? '#10b981' : '#ef4444')}>
                     <Popup>
                       <div className="font-bold text-xs">{idx === 0 ? 'Origin: ' + bus.origin : 'Destination: ' + bus.destination}</div>
                     </Popup>
                  </Marker>
                );
              }
              return null;
            })}
            
            <AutoCenter pos={bus.route[Math.floor(bus.route.length / 1.5)]} isActive={activeBusId === bus.id} />
          </>
        )}

        {customMarkers.map((marker) => (
          <Marker key={marker.id} position={marker.pos}>
            <Popup className="custom-marker-popup">
              <div className="flex items-start gap-2 max-w-[200px]">
                <Info size={16} className="text-ksrtc-blue mt-0.5 shrink-0" />
                <p className="text-sm font-medium text-gray-800">{marker.note}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        <MapEvents onAddMarker={onAddMarker} interactive={interactive} />
      </MapContainer>
      
      {interactive && (
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
          <div className="bg-white p-2 rounded-lg shadow-md flex flex-col items-center">
            <button 
              className="p-1 hover:bg-gray-100 rounded border-b border-gray-100" 
              onClick={(e) => { e.stopPropagation(); }}
            >
              <MapPin size={20} className="text-ksrtc-blue" />
            </button>
            <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">Add</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveMap;

import { useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { latLonToXYZ } from '../../utils/oceanCalc';

interface IndiaEEZProps {
  visible: boolean;
}

export function IndiaEEZ({ visible }: IndiaEEZProps) {
  const [geoData, setGeoData] = useState<any>(null);

  useEffect(() => {
    // Fetch the authoritative GeoJSON from the public data directory.
    fetch('/data/india_eez.geojson')
      .then(res => res.json())
      .then(data => setGeoData(data))
      .catch(err => console.error("Failed to load India EEZ GeoJSON:", err));
  }, []);

  const lines = useMemo(() => {
    if (!geoData || !geoData.features) return [];
    const newLines: THREE.Vector3[][] = [];

    const processPolygon = (coordinates: any[]) => {
      // coordinates for Polygon is array of linear rings
      coordinates.forEach((ring: any[]) => {
        const points: THREE.Vector3[] = [];
        ring.forEach((coord: number[]) => {
          const [lon, lat] = coord;
          // Radius is just slightly above the earth (2.0) to prevent z-fighting
          const [x, y, z] = latLonToXYZ(lat, lon, 2.002);
          points.push(new THREE.Vector3(x, y, z));
        });
        if (points.length > 1) {
            newLines.push(points);
        }
      });
    };

    geoData.features.forEach((feature: any) => {
      const geom = feature.geometry;
      if (!geom) return;
      if (geom.type === 'Polygon') {
        processPolygon(geom.coordinates);
      } else if (geom.type === 'MultiPolygon') {
        geom.coordinates.forEach((poly: any[]) => {
          processPolygon(poly);
        });
      } else if (geom.type === 'LineString') {
        const points: THREE.Vector3[] = [];
        geom.coordinates.forEach((coord: number[]) => {
          const [lon, lat] = coord;
          const [x, y, z] = latLonToXYZ(lat, lon, 2.002);
          points.push(new THREE.Vector3(x, y, z));
        });
        if (points.length > 1) {
            newLines.push(points);
        }
      }
    });

    return newLines;
  }, [geoData]);

  if (!visible || lines.length === 0) return null;

  return (
    <group>
      {lines.map((pts, i) => (
        <mesh key={`eez-line-${i}`}>
          <tubeGeometry args={[new THREE.CatmullRomCurve3(pts), Math.max(20, pts.length), 0.003, 8, false]} />
          <meshBasicMaterial 
            color="#22d3ee" 
            transparent 
            opacity={0.6} 
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

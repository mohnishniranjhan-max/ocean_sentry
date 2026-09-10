import { useState, useEffect, useRef, useCallback } from 'react';
import type { Station } from '../types/ocean';
import {
  fetchStations,
  fetchAnomalies,
  fetchAnomalySummary,
  fetchObservationsAtDepth,
  checkApiAvailable,
  fetchDeviceInfo,
  fetchLiveArgoStream,
  mapStatus,
} from '../services/oceanApi';
import type { AnomalyRecord, AnomalySummary, ObservationRecord, DeviceInfo, LiveArgoData } from '../services/oceanApi';
import { STATIONS as MOCK_STATIONS, ANOMALY_COUNT as MOCK_ANOMALY_COUNT } from '../data/oceanData';

export type DataSource = 'api' | 'mock' | 'loading' | 'error';

interface OceanDataState {
  stations: Station[];
  dataSource: DataSource;
  error: string | null;
  isLoading: boolean;
  lastFetch: number | null;
  anomalyCount: number;
  anomalies: AnomalyRecord[];
  anomalySummary: AnomalySummary | null;
  deviceInfo: DeviceInfo | null;
  depthObservations: ObservationRecord[];
  depthAnomalies: AnomalyRecord[];
  depthLoading: boolean;
  depthError: string | null;
  liveArgo: LiveArgoData | null;
}


export function useOceanData() {
  const [state, setState] = useState<OceanDataState>({
    stations: MOCK_STATIONS,
    dataSource: 'loading',
    error: null,
    isLoading: true,
    lastFetch: null,
    anomalyCount: MOCK_ANOMALY_COUNT,
    anomalies: [],
    anomalySummary: null,
    deviceInfo: null,
    depthObservations: [],
    depthAnomalies: [],
    depthLoading: false,
    depthError: null,
    liveArgo: null,
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const depthCache = useRef<Record<number, { observations: ObservationRecord[]; anomalies: AnomalyRecord[] }>>({});

  const reload = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const available = await checkApiAvailable();
      if (cancelled) return;

      if (!available) {
        setState((s) => ({
          ...s,
          stations: MOCK_STATIONS,
          dataSource: 'mock',
          error: null,
          isLoading: false,
          lastFetch: Date.now(),
          anomalyCount: MOCK_ANOMALY_COUNT,
          anomalies: [],
          anomalySummary: null,
          deviceInfo: null,
        }));
        return;
      }

      try {
        const [stations, anomalyResp, summary, devInfo] = await Promise.all([
          fetchStations(),
          fetchAnomalies(200),
          fetchAnomalySummary(),
          fetchDeviceInfo().catch(() => null),
        ]);
        if (cancelled) return;

        if (stations.length === 0) {
          setState((s) => ({
            ...s,
            stations: MOCK_STATIONS,
            dataSource: 'mock',
            error: 'API returned no stations',
            isLoading: false,
            lastFetch: Date.now(),
            anomalyCount: MOCK_ANOMALY_COUNT,
            anomalies: [],
            anomalySummary: null,
            deviceInfo: devInfo,
          }));
          return;
        }

        const realAnomalyCount = summary.available
          ? (summary.total_anomalies ?? 0)
          : MOCK_ANOMALY_COUNT;

        setState((s) => ({
          ...s,
          stations,
          dataSource: 'api',
          error: null,
          isLoading: false,
          lastFetch: Date.now(),
          anomalyCount: realAnomalyCount,
          anomalies: anomalyResp.anomalies,
          anomalySummary: summary,
          deviceInfo: devInfo,
        }));
      } catch (err) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          stations: MOCK_STATIONS,
          dataSource: 'mock',
          error: err instanceof Error ? err.message : 'Unknown error',
          isLoading: false,
          lastFetch: Date.now(),
          anomalyCount: MOCK_ANOMALY_COUNT,
          anomalies: [],
          anomalySummary: null,
          deviceInfo: null,
        }));
      }
    }

    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  // Continuous polling for live Argo telemetry stream
  useEffect(() => {
    let active = true;

    async function pollLiveStream() {
      const liveData = await fetchLiveArgoStream();
      if (!active || !liveData) return;

      const liveStation: Station = {
        id: liveData.profile_id,
        name: `Live Argo Float (#${liveData.tick})`,
        type: 'argo',
        region: liveData.region || 'Bay of Bengal',
        latitude: liveData.latitude,
        longitude: liveData.longitude,
        depth: 25,
        isOnline: true,
        lastSyncMinutes: 0,
        temperature: liveData.station_payload.temperature,
        salinity: liveData.station_payload.salinity,
        waveHeight: liveData.station_payload.waveHeight,
        currentSpeed: liveData.station_payload.currentSpeed,
        seaLevel: 0.12,
        modelTemperature: 27.2,
        modelSalinity: 34.1,
        modelWaveHeight: 1.1,
        modelCurrentSpeed: 0.42,
        modelSeaLevel: 0.1,
        status: mapStatus(liveData.station_payload.anomalyStatus),
      };

      setState((prev) => {
        const filtered = prev.stations.filter((s) => !s.id.startsWith('ARGO-590623'));
        return {
          ...prev,
          liveArgo: liveData,
          stations: [liveStation, ...filtered],
        };
      });
    }

    pollLiveStream();
    const interval = setInterval(pollLiveStream, 3500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const loadDepthData = useCallback(async (depth: number) => {
    if (state.dataSource !== 'api') return;

    if (depthCache.current[depth]) {
      const cached = depthCache.current[depth];
      setState((s) => ({
        ...s,
        depthObservations: cached.observations,
        depthAnomalies: cached.anomalies,
        depthLoading: false,
        depthError: null,
      }));
      return;
    }

    setState((s) => ({ ...s, depthLoading: true, depthError: null }));

    try {
      const [obs, anomalyResp] = await Promise.all([
        fetchObservationsAtDepth(depth, 300),
        fetchAnomalies(500, { depthMin: depth - 20, depthMax: depth + 20 }),
      ]);

      depthCache.current[depth] = {
        observations: obs,
        anomalies: anomalyResp.anomalies,
      };

      setState((s) => ({
        ...s,
        depthObservations: obs,
        depthAnomalies: anomalyResp.anomalies,
        depthLoading: false,
        depthError: null,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        depthLoading: false,
        depthError: err instanceof Error ? err.message : 'Depth data unavailable',
      }));
    }
  }, [state.dataSource]);

  const clearDepthData = useCallback(() => {
    setState((s) => ({
      ...s,
      depthObservations: [],
      depthAnomalies: [],
      depthLoading: false,
      depthError: null,
    }));
  }, []);

  return { ...state, loadDepthData, clearDepthData, reload };
}


import type { Station, AnomalyStatus } from '../types/ocean';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const STREAM_URL = import.meta.env.VITE_ARGO_STREAM_URL;
const STREAM_KEY = import.meta.env.VITE_ARGO_API_KEY;

interface ApiStation {
  id: string;
  name: string;
  type: string;
  region: string;
  latitude: number;
  longitude: number;
  depth: number;
  isOnline: boolean;
  lastSyncMinutes: number;
  temperature: number;
  salinity: number;
  waveHeight: number;
  currentSpeed: number;
  seaLevel: number;
  modelTemperature: number;
  modelSalinity: number;
  modelWaveHeight: number;
  modelCurrentSpeed: number;
  modelSeaLevel: number;
  status: string;
  dataSource: string;
  anomalyScore?: number;
  anomalyCount?: number;
}

interface ComparisonRecord {
  latitude: number;
  longitude: number;
  depth: number;
  timestamp: string;
  parameter: string;
  model_value: number | null;
  observed_value: number | null;
  difference: number | null;
  percentage_difference: number | null;
}

interface HealthResponse {
  status: string;
  service: string;
}

export function mapStatus(status: string): AnomalyStatus {
  if (status === 'critical' || status === 'high') return 'critical';
  if (status === 'warning') return 'warning';
  return 'normal';
}

function mapStationType(type: string): Station['type'] {
  if (type === 'argo') return 'argo';
  if (type === 'satellite') return 'satellite';
  if (type === 'coastal') return 'coastal';
  return 'buoy';
}

function apiStationToStation(s: ApiStation): Station {
  return {
    id: s.id,
    name: s.name,
    type: mapStationType(s.type),
    region: s.region,
    latitude: s.latitude,
    longitude: s.longitude,
    depth: s.depth,
    isOnline: s.isOnline,
    lastSyncMinutes: s.lastSyncMinutes,
    temperature: s.temperature,
    salinity: s.salinity,
    waveHeight: s.waveHeight,
    currentSpeed: s.currentSpeed,
    seaLevel: s.seaLevel,
    modelTemperature: s.modelTemperature,
    modelSalinity: s.modelSalinity,
    modelWaveHeight: s.modelWaveHeight,
    modelCurrentSpeed: s.modelCurrentSpeed,
    modelSeaLevel: s.modelSeaLevel,
    status: mapStatus(s.status),
  };
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!resp.ok) {
    throw new Error(`API ${resp.status}: ${resp.statusText}`);
  }
  return resp.json();
}

export async function fetchHealth(): Promise<HealthResponse> {
  return fetchJson('/api/health');
}

export async function fetchStations(): Promise<Station[]> {
  const raw = await fetchJson<ApiStation[]>('/api/stations/frontend');
  return raw.map(apiStationToStation);
}

export async function fetchComparisons(
  parameter: string = 'temperature',
  limit: number = 100,
): Promise<ComparisonRecord[]> {
  return fetchJson(`/api/ocean/comparison?parameter=${parameter}&limit=${limit}`);
}

export interface AnomalyRecord {
  station_id: string;
  latitude: number;
  longitude: number;
  depth: number;
  timestamp: string;
  parameter: string;
  observed_value: number | null;
  model_value: number | null;
  difference: number | null;
  anomaly_score: number;
  status: string;
  confidence: number;
}

export interface AnomalyResponse {
  count: number;
  anomalies: AnomalyRecord[];
  data_source: string;
}

export interface AnomalySummary {
  available: boolean;
  total_records?: number;
  total_anomalies?: number;
  high_count?: number;
  warning_count?: number;
  normal_count?: number;
  score_min?: number;
  score_max?: number;
  score_mean?: number;
  data_source?: string;
}

export async function fetchAnomalies(limit: number = 100, opts?: {
  depthMin?: number;
  depthMax?: number;
  status?: string;
}): Promise<AnomalyResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (opts?.depthMin != null) params.set('depth_min', String(opts.depthMin));
  if (opts?.depthMax != null) params.set('depth_max', String(opts.depthMax));
  if (opts?.status) params.set('status', opts.status);
  return fetchJson(`/api/ocean/anomalies?${params}`);
}

export interface ObservationRecord {
  timestamp: string;
  latitude: number;
  longitude: number;
  depth: number;
  observed_temperature: number | null;
  observed_salinity: number | null;
  model_temperature: number | null;
  model_salinity: number | null;
  model_current_u: number | null;
  model_current_v: number | null;
  temperature_difference: number | null;
  salinity_difference: number | null;
  abs_temperature_difference: number | null;
  abs_salinity_difference: number | null;
  spatial_distance_km: number | null;
}

export async function fetchObservationsAtDepth(depth: number, limit: number = 200): Promise<ObservationRecord[]> {
  return fetchJson(`/api/ocean/observations?depth=${depth}&limit=${limit}`);
}

export interface TimeseriesPoint {
  timestamp: string;
  depth: number;
  observed: number | null;
  model: number | null;
}

export async function fetchTimeseries(lat: number, lon: number, parameter: string = 'temperature'): Promise<TimeseriesPoint[]> {
  return fetchJson(`/api/ocean/timeseries?latitude=${lat}&longitude=${lon}&parameter=${parameter}`);
}

export async function fetchAnomalySummary(): Promise<AnomalySummary> {
  return fetchJson('/api/ocean/anomalies/summary');
}

export interface DeviceInfo {
  cuda_available: boolean;
  device: string;
  device_name: string;
  gpu_name?: string;
  total_memory_mb?: number;
  allocated_memory_mb?: number;
  active_model_type?: string;
  model_loaded?: boolean;
}

export async function fetchDeviceInfo(): Promise<DeviceInfo> {
  return fetchJson('/api/ml/device');
}

export async function checkApiAvailable(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 3000);
    await fetch(`${API_BASE}/api/health`, { signal: ctrl.signal });
    clearTimeout(id);
    return true;
  } catch {
    return false;
  }
}

export interface LiveArgoData {
  tick: number;
  profile_id: string;
  region: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  station_payload: {
    temperature: number;
    salinity: number;
    waveHeight: number;
    currentSpeed: number;
    anomalyStatus: string;
  };
}

export async function fetchLiveArgoStream(): Promise<LiveArgoData | null> {
  const targetUrl = STREAM_URL || `${API_BASE}/api/v1/argo/live`;
  try {
    const resp = await fetch(targetUrl, {
      headers: {
        'X-API-KEY': STREAM_KEY || 'samudra_live_key_2026_xYz',
        'Content-Type': 'application/json'
      }
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

export interface DataIngestionReport {
  source: string;
  records_received: number;
  records_valid: number;
  records_removed: number;
  records_missing: number;
  variables_found: string[];
  time_range?: [string, string] | null;
  lat_range?: [number, number] | null;
  lon_range?: [number, number] | null;
  depth_range?: [number, number] | null;
  detected_delimiter?: string | null;
  column_mapping: Record<string, string>;
  rejected_rows: Array<{ line: number; raw: string; reason: string }>;
  warnings: string[];
  station_ids: string[];
}

export interface AsciiPreviewResponse {
  success: boolean;
  report: DataIngestionReport;
  preview_records: Array<Record<string, any>>;
  detected_delimiter: string;
  column_mapping: Record<string, string>;
  header_metadata: Record<string, string>;
}

export interface AsciiIngestResponse {
  success: boolean;
  message: string;
  report: DataIngestionReport;
  created_stations: string[];
}

export async function previewAsciiData(
  textContent: string,
  options?: { sourceName?: string; stationId?: string; delimiter?: string }
): Promise<AsciiPreviewResponse> {
  return fetchJson('/api/ocean/ingest/ascii/preview', {
    method: 'POST',
    body: JSON.stringify({
      text_content: textContent,
      source_name: options?.sourceName || 'ascii_preview',
      station_id_override: options?.stationId || undefined,
      delimiter_override: options?.delimiter || undefined,
    }),
  });
}

export async function ingestAsciiData(
  textContent: string,
  options?: { sourceName?: string; stationId?: string; delimiter?: string }
): Promise<AsciiIngestResponse> {
  return fetchJson('/api/ocean/ingest/ascii', {
    method: 'POST',
    body: JSON.stringify({
      text_content: textContent,
      source_name: options?.sourceName || 'ascii_upload',
      station_id_override: options?.stationId || undefined,
      delimiter_override: options?.delimiter || undefined,
    }),
  });
}

export async function fetchIngestFormats(): Promise<any> {
  return fetchJson('/api/ocean/ingest/formats');
}

export type { ApiStation, ComparisonRecord, HealthResponse };



export type GroundRole = "client" | "gateway";

export type Scenario = {
  schema_version: string;
  meta: { id: string; title: string };
  environment: {
    altitude_km: number;
    inclination_deg: number;
    earth_angle0_deg: number;
    horizon_s: number;
    step_s: number;
    min_elevation_deg: number;
    isl_range_km: number;
    target_availability: number;
  };
  design: {
    launch_stage: number;
    planes: { id: string; raan_deg: number; phase_deg: number }[];
    satellites: {
      id: string;
      plane_id: string;
      slot_deg: number;
      launch_batch: number;
    }[];
  };
  ground_sites: {
    id: string;
    name: string;
    role: GroundRole;
    lat_deg: number;
    lon_deg: number;
  }[];
  failures: { satellite_id: string; start_s: number; end_s: number }[];
  gateway_outages: { gateway_id: string; start_s: number; end_s: number }[];
};

export type SatelliteState = {
  id: string;
  x_km: number;
  y_km: number;
  z_km: number;
  active: boolean;
  sunlit?: boolean;
};

export type RouteInfo = {
  t_s: number;
  client_id: string;
  path: string[];
  hops: number | null;
  length_km: number | null;
  delay_ms: number | null;
  reason: string | null;
  backup_path?: string[];
  has_backup?: boolean;
  spof?: string[];
};

export type SpofInfo = {
  satellite_id: string;
  spof_steps: number;
  spof_share: number;
  availability_if_failed: number;
  availability_delta: number;
};

export type ClientResilience = {
  backup_share: number;
  backup_steps: number;
  single_path_share: number;
  single_path_steps: number;
  spof_top: SpofInfo[];
};

export type Snapshot = {
  t_s: number;
  satellites: SatelliteState[];
  edges: [string, string, number][];
  elevation_deg: Record<string, Record<string, number>>;
  sun_ecef: number[];
  ground: {
    id: string;
    name: string;
    role: GroundRole;
    lat_deg: number;
    lon_deg: number;
    x_km: number;
    y_km: number;
    z_km: number;
  }[];
  routes: RouteInfo[];
};

export type ClientMetrics = {
  visibility: number;
  availability: number;
  max_outage_s: number;
  meets_target: boolean;
  n_visible_steps: number;
  n_reachable_steps: number;
  n_steps: number;
};

export type Series = {
  visible: boolean[];
  reachable: boolean[];
  hops: (number | null)[];
  reason: (string | null)[];
  delay_ms: (number | null)[];
  has_backup?: boolean[];
};

export type Hotspot = {
  satellite_id: string;
  on_route_share: number;
  on_route_steps: number;
};

export type Simulation = {
  sim_id: string;
  mode: string;
  times: number[];
  metrics: {
    n_steps: number;
    target_availability: number;
    clients: Record<string, ClientMetrics>;
    resilience?: Record<string, ClientResilience>;
  };
  series: Record<string, Series>;
  hotspots?: Hotspot[];
  n_snapshots?: number;
};

export type VariantInfo = {
  id: string;
  name: string;
  mode: string;
  sim_id: string;
  metrics: Simulation["metrics"];
  recommendations: string[];
  created_at: string;
  launch_stage: number;
  isl_range_km: number;
  n_failures: number;
  scenario?: Scenario;
};

export type CompareResult = {
  winner: "left" | "right" | "tie";
  recommendations: string[];
  diff: {
    launch_stage: number[];
    planes: Record<string, unknown>[];
    environment: Record<string, unknown>;
    failures: number[];
    gateway_outages: number[];
  };
  clients: Record<
    string,
    {
      left: ClientMetrics;
      right: ClientMetrics;
      availability_delta: number;
      max_outage_delta_s: number;
    }
  >;
  left: { name: string; metrics: Simulation["metrics"] };
  right: { name: string; metrics: Simulation["metrics"] };
};

export type TabId = "project" | "orbit" | "satellites" | "ground" | "compare";

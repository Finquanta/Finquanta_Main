export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
}

export interface ApiInfoResponse {
  message: string;
  version: string;
  status: string;
}

export interface RouteOptions {
  prefix?: string;
  version?: string;
}

export interface ServerConfig {
  port: number;
  host: string;
  logLevel: string;
}
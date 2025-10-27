export interface SecurityEvent {
  id: string;
  type: 'login' | 'threat' | 'access' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: string;
  ip: string;
  user?: string;
  status: 'active' | 'resolved' | 'investigating';
}

export interface SecurityMetrics {
  activeAlerts: number;
  failedLogins: number;
  blockedThreats: number;
  securityScore: number;
  alertTrend: number;
  loginTrend: number;
  threatTrend: number;
  scoreTrend: number;
}
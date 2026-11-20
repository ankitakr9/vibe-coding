export type UserRole = 'ADMIN' | 'ANALYST' | 'CUSTOMER';

export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  linkedAccountId?: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorEmail: string;
  actorRole: UserRole | 'SYSTEM';
  action: string;
  target: string;
  outcome: 'SUCCESS' | 'DENIED';
  detail: string;
}

export type AccountStatus = 'ACTIVE' | 'FROZEN';

export type EventType =
  | 'LOGIN_ATTEMPT'
  | 'WIRE_TRANSFER'
  | 'CARD_PAYMENT'
  | 'ACH_WITHDRAWAL'
  | 'PASSWORD_RESET';

export type MfaStatus = 'VERIFIED' | 'FAILED' | 'BYPASSED';

export type RiskVerdict = 'AUTHORIZED' | 'CHALLENGE_MFA' | 'BLOCKED_UNAUTHORIZED';

export type AlertSeverity = 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AlertStatus =
  | 'OPEN'
  | 'INVESTIGATING'
  | 'RESOLVED_FRAUD'
  | 'FALSE_POSITIVE';

export type RuleCategory =
  | 'UNAUTHORIZED_ACCESS'
  | 'GEO_VELOCITY'
  | 'AMOUNT_ANOMALY'
  | 'NETWORK_RISK'
  | 'VELOCITY'
  | 'ML_MODEL';

export interface AccountProfile {
  id: string;
  accountNumber: string;
  holderName: string;
  email: string;
  tier: 'Private Banking' | 'Commercial' | 'Premier Retail';
  homeCity: string;
  homeCountry: string;
  homeLat: number;
  homeLng: number;
  trustedDevices: Array<{ id: string; label: string }>;
  avgTransactionAmount: number;
  stdDevTransactionAmount: number;
  dailyLimit: number;
  status: AccountStatus;
  lastVerifiedCity: string;
  lastVerifiedCountry: string;
  lastVerifiedLat: number;
  lastVerifiedLng: number;
  lastVerifiedAt: string;
  lastIp: string;
}

export interface FraudRuleConfig {
  unknownDeviceWeight: number;
  impossibleTravelWeight: number;
  vpnProxyWeight: number;
  mfaFailureWeight: number;
  invalidSessionWeight: number;
  highAmountMultiplier: number;
  highAmountWeight: number;
  velocityBurstLimit: number;
  velocityBurstWeight: number;
  challengeThreshold: number;
  blockThreshold: number;
}

export interface TriggeredRule {
  code: string;
  label: string;
  category: RuleCategory;
  scoreImpact: number;
  detail: string;
}

export interface EvaluationRequest {
  accountId: string;
  eventType: EventType;
  amount: number;
  merchantOrTarget: string;
  ipAddress: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  deviceId: string;
  deviceLabel: string;
  isVpnOrTor: boolean;
  mfaStatus: MfaStatus;
  sessionTokenValid: boolean;
}

export interface MlModelFeature {
  feature: string;
  contribution: number;
  explanation: string;
}

export interface TransactionRecord extends EvaluationRequest {
  id: string;
  accountNumber: string;
  holderName: string;
  timestamp: string;
  riskScore: number;
  mlFraudProbability: number;
  mlFeatures: MlModelFeature[];
  verdict: RiskVerdict;
  isUnauthorizedUser: boolean;
  triggeredRules: TriggeredRule[];
  distanceFromLastKm: number;
  travelSpeedKmh: number;
}

export interface InvestigationNote {
  id: string;
  authorName: string;
  authorRole: UserRole;
  text: string;
  createdAt: string;
}

export interface FraudAlert {
  id: string;
  transactionId: string;
  accountId: string;
  accountNumber: string;
  holderName: string;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  summary: string;
  riskScore: number;
  mlFraudProbability: number;
  unauthorizedUserDetected: boolean;
  triggeredRules: TriggeredRule[];
  amount: number;
  eventType: EventType;
  location: string;
  ipAddress: string;
  deviceLabel: string;
  createdAt: string;
  updatedAt: string;
  assignedAnalyst: string;
  notes: InvestigationNote[];
}

export interface DashboardMetrics {
  totalEvaluated: number;
  unauthorizedBlocked: number;
  openAlerts: number;
  criticalAlerts: number;
  exposurePreventedUsd: number;
  frozenAccounts: number;
  averageRiskScore: number;
  avgMlProbability: number;
}

export interface HourlyMetricPoint {
  hour: string;
  authorized: number;
  challenged: number;
  blockedUnauthorized: number;
  avgScore: number;
}

export interface DashboardSnapshot {
  accounts: AccountProfile[];
  transactions: TransactionRecord[];
  alerts: FraudAlert[];
  rules: FraudRuleConfig;
  metrics: DashboardMetrics;
  hourlySeries: HourlyMetricPoint[];
  liveMonitorRunning: boolean;
}

export interface JavaProjectFile {
  path: string;
  language: 'java' | 'xml' | 'yaml' | 'sql' | 'markdown';
  category:
    | 'Build & Config'
    | 'Authentication & RBAC'
    | 'Domain Models'
    | 'Fraud & ML Engine'
    | 'API & WebSocket'
    | 'Documentation';
  description: string;
  content: string;
}

export type WsMessage =
  | { type: 'init'; payload: DashboardSnapshot }
  | {
      type: 'transaction:evaluated';
      payload: {
        transaction: TransactionRecord;
        metrics: DashboardMetrics;
        hourlySeries: HourlyMetricPoint[];
      };
    }
  | { type: 'alert:created'; payload: { alert: FraudAlert; metrics: DashboardMetrics } }
  | { type: 'alert:updated'; payload: { alert: FraudAlert; metrics: DashboardMetrics } }
  | { type: 'account:updated'; payload: { account: AccountProfile; metrics: DashboardMetrics } }
  | { type: 'rules:updated'; payload: { rules: FraudRuleConfig } }
  | { type: 'monitor:status'; payload: { liveMonitorRunning: boolean } };

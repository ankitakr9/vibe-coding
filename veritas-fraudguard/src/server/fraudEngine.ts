import crypto from 'node:crypto';
import type {
  AccountProfile,
  AccountStatus,
  AlertSeverity,
  AlertStatus,
  AuthUser,
  DashboardMetrics,
  DashboardSnapshot,
  EvaluationRequest,
  FraudAlert,
  FraudRuleConfig,
  HourlyMetricPoint,
  InvestigationNote,
  MlModelFeature,
  RiskVerdict,
  TransactionRecord,
  TriggeredRule,
} from '../shared/types.ts';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

const minutesAgoIso = (mins: number): string =>
  new Date(Date.now() - mins * 60_000).toISOString();

export class FraudEngineStore {
  private accounts: AccountProfile[];
  private transactions: TransactionRecord[];
  private alerts: FraudAlert[];
  private rules: FraudRuleConfig;
  private liveMonitorRunning = false;

  constructor() {
    this.rules = {
      unknownDeviceWeight: 32,
      impossibleTravelWeight: 38,
      vpnProxyWeight: 24,
      mfaFailureWeight: 35,
      invalidSessionWeight: 42,
      highAmountMultiplier: 3.0,
      highAmountWeight: 26,
      velocityBurstLimit: 3,
      velocityBurstWeight: 22,
      challengeThreshold: 40,
      blockThreshold: 68,
    };

    this.accounts = [
      {
        id: 'acc-101',
        accountNumber: '****-****-4821',
        holderName: 'Eleanor Vance',
        email: 'e.vance@meridianholdings.com',
        tier: 'Private Banking',
        homeCity: 'New York',
        homeCountry: 'United States',
        homeLat: 40.7128,
        homeLng: -74.006,
        trustedDevices: [
          { id: 'DEV-EV-MAC01', label: 'MacBook Pro 16 (macOS 15)' },
          { id: 'DEV-EV-IOS02', label: 'iPhone 16 Pro (FaceID)' },
        ],
        avgTransactionAmount: 2450,
        stdDevTransactionAmount: 1120,
        dailyLimit: 25000,
        status: 'ACTIVE',
        lastVerifiedCity: 'New York',
        lastVerifiedCountry: 'United States',
        lastVerifiedLat: 40.7128,
        lastVerifiedLng: -74.006,
        lastVerifiedAt: minutesAgoIso(42),
        lastIp: '72.14.198.44',
      },
      {
        id: 'acc-102',
        accountNumber: '****-****-9104',
        holderName: 'Marcus Holloway',
        email: 'm.holloway@northstarlogistics.io',
        tier: 'Commercial',
        homeCity: 'Chicago',
        homeCountry: 'United States',
        homeLat: 41.8781,
        homeLng: -87.6298,
        trustedDevices: [
          { id: 'DEV-MH-WIN01', label: 'ThinkPad X1 Carbon (Windows 11)' },
          { id: 'DEV-MH-AND02', label: 'Pixel 9 Pro (Biometric)' },
        ],
        avgTransactionAmount: 4800,
        stdDevTransactionAmount: 2100,
        dailyLimit: 50000,
        status: 'ACTIVE',
        lastVerifiedCity: 'Chicago',
        lastVerifiedCountry: 'United States',
        lastVerifiedLat: 41.8781,
        lastVerifiedLng: -87.6298,
        lastVerifiedAt: minutesAgoIso(25),
        lastIp: '98.213.44.112',
      },
      {
        id: 'acc-103',
        accountNumber: '****-****-3379',
        holderName: 'Priya Subramanian',
        email: 'priya.s@cloudgridventures.com',
        tier: 'Private Banking',
        homeCity: 'San Francisco',
        homeCountry: 'United States',
        homeLat: 37.7749,
        homeLng: -122.4194,
        trustedDevices: [
          { id: 'DEV-PS-MAC01', label: 'MacBook Air M3 (TouchID)' },
          { id: 'DEV-PS-IOS01', label: 'iPhone 15 Pro' },
        ],
        avgTransactionAmount: 1900,
        stdDevTransactionAmount: 840,
        dailyLimit: 20000,
        status: 'FROZEN',
        lastVerifiedCity: 'San Francisco',
        lastVerifiedCountry: 'United States',
        lastVerifiedLat: 37.7749,
        lastVerifiedLng: -122.4194,
        lastVerifiedAt: minutesAgoIso(115),
        lastIp: '104.18.210.77',
      },
      {
        id: 'acc-104',
        accountNumber: '****-****-7652',
        holderName: 'Henrik Lindqvist',
        email: 'h.lindqvist@nordicfreight.se',
        tier: 'Commercial',
        homeCity: 'London',
        homeCountry: 'United Kingdom',
        homeLat: 51.5072,
        homeLng: -0.1276,
        trustedDevices: [{ id: 'DEV-HL-MAC01', label: 'MacBook Pro 14 (Safari)' }],
        avgTransactionAmount: 6200,
        stdDevTransactionAmount: 2800,
        dailyLimit: 75000,
        status: 'ACTIVE',
        lastVerifiedCity: 'London',
        lastVerifiedCountry: 'United Kingdom',
        lastVerifiedLat: 51.5072,
        lastVerifiedLng: -0.1276,
        lastVerifiedAt: minutesAgoIso(58),
        lastIp: '81.149.112.19',
      },
      {
        id: 'acc-105',
        accountNumber: '****-****-6048',
        holderName: 'Camila Rojas',
        email: 'camila.rojas@solarishealth.org',
        tier: 'Premier Retail',
        homeCity: 'Austin',
        homeCountry: 'United States',
        homeLat: 30.2672,
        homeLng: -97.7431,
        trustedDevices: [
          { id: 'DEV-CR-IOS01', label: 'iPhone 16 (iOS 18)' },
          { id: 'DEV-CR-IPAD1', label: 'iPad Air M2' },
        ],
        avgTransactionAmount: 640,
        stdDevTransactionAmount: 310,
        dailyLimit: 10000,
        status: 'ACTIVE',
        lastVerifiedCity: 'Austin',
        lastVerifiedCountry: 'United States',
        lastVerifiedLat: 30.2672,
        lastVerifiedLng: -97.7431,
        lastVerifiedAt: minutesAgoIso(90),
        lastIp: '70.114.88.203',
      },
      {
        id: 'acc-106',
        accountNumber: '****-****-2215',
        holderName: 'David Okafor',
        email: 'd.okafor@harborcapital.co.uk',
        tier: 'Private Banking',
        homeCity: 'Toronto',
        homeCountry: 'Canada',
        homeLat: 43.6532,
        homeLng: -79.3832,
        trustedDevices: [
          { id: 'DEV-DO-MAC01', label: 'Mac Studio (Chrome)' },
          { id: 'DEV-DO-IOS02', label: 'iPhone 15 Pro Max' },
        ],
        avgTransactionAmount: 3100,
        stdDevTransactionAmount: 1450,
        dailyLimit: 35000,
        status: 'ACTIVE',
        lastVerifiedCity: 'Toronto',
        lastVerifiedCountry: 'Canada',
        lastVerifiedLat: 43.6532,
        lastVerifiedLng: -79.3832,
        lastVerifiedAt: minutesAgoIso(34),
        lastIp: '142.116.55.90',
      },
    ];

    this.transactions = [];
    this.alerts = [];
    this.seedInitialHistory();
  }

  public setLiveMonitorRunning(running: boolean): void {
    this.liveMonitorRunning = running;
  }

  public isLiveMonitorRunning(): boolean {
    return this.liveMonitorRunning;
  }

  private seedInitialHistory(): void {
    const seededEvents: Array<{
      req: EvaluationRequest;
      minsAgo: number;
      statusOverride?: AlertStatus;
      note?: string;
    }> = [
      {
        minsAgo: 320,
        req: {
          accountId: 'acc-101',
          eventType: 'CARD_PAYMENT',
          amount: 412.5,
          merchantOrTarget: 'Delta Air Lines — JFK',
          ipAddress: '72.14.198.44',
          city: 'New York',
          country: 'United States',
          lat: 40.7128,
          lng: -74.006,
          deviceId: 'DEV-EV-IOS02',
          deviceLabel: 'iPhone 16 Pro (FaceID)',
          isVpnOrTor: false,
          mfaStatus: 'VERIFIED',
          sessionTokenValid: true,
        },
      },
      {
        minsAgo: 280,
        req: {
          accountId: 'acc-104',
          eventType: 'WIRE_TRANSFER',
          amount: 5400,
          merchantOrTarget: 'Nordic Port Authority Clearing',
          ipAddress: '81.149.112.19',
          city: 'London',
          country: 'United Kingdom',
          lat: 51.5072,
          lng: -0.1276,
          deviceId: 'DEV-HL-MAC01',
          deviceLabel: 'MacBook Pro 14 (Safari)',
          isVpnOrTor: false,
          mfaStatus: 'VERIFIED',
          sessionTokenValid: true,
        },
      },
      {
        minsAgo: 235,
        statusOverride: 'RESOLVED_FRAUD',
        note: 'Confirmed credential stuffing from Tor exit node. Account frozen and card reissued.',
        req: {
          accountId: 'acc-103',
          eventType: 'WIRE_TRANSFER',
          amount: 18400,
          merchantOrTarget: 'Offshore Crypto Escrow Ltd',
          ipAddress: '185.220.101.42',
          city: 'Bucharest',
          country: 'Romania',
          lat: 44.4268,
          lng: 26.1025,
          deviceId: 'DEV-UNK-LNX91',
          deviceLabel: 'Headless Linux Chrome 128',
          isVpnOrTor: true,
          mfaStatus: 'BYPASSED',
          sessionTokenValid: false,
        },
      },
      {
        minsAgo: 190,
        req: {
          accountId: 'acc-105',
          eventType: 'CARD_PAYMENT',
          amount: 189.2,
          merchantOrTarget: 'Whole Foods Market #104',
          ipAddress: '70.114.88.203',
          city: 'Austin',
          country: 'United States',
          lat: 30.2672,
          lng: -97.7431,
          deviceId: 'DEV-CR-IOS01',
          deviceLabel: 'iPhone 16 (iOS 18)',
          isVpnOrTor: false,
          mfaStatus: 'VERIFIED',
          sessionTokenValid: true,
        },
      },
      {
        minsAgo: 148,
        statusOverride: 'INVESTIGATING',
        note: 'Reached out to treasury contact at Northstar Logistics to verify Frankfurt ACH transfer.',
        req: {
          accountId: 'acc-102',
          eventType: 'ACH_WITHDRAWAL',
          amount: 19650,
          merchantOrTarget: 'External Brokerage #8821',
          ipAddress: '193.142.146.35',
          city: 'Frankfurt',
          country: 'Germany',
          lat: 50.1109,
          lng: 8.6821,
          deviceId: 'DEV-UNK-WIN77',
          deviceLabel: 'Windows 10 VM (Firefox)',
          isVpnOrTor: true,
          mfaStatus: 'FAILED',
          sessionTokenValid: true,
        },
      },
      {
        minsAgo: 105,
        req: {
          accountId: 'acc-106',
          eventType: 'LOGIN_ATTEMPT',
          amount: 0,
          merchantOrTarget: 'Private Banking Web Portal',
          ipAddress: '142.116.55.90',
          city: 'Toronto',
          country: 'Canada',
          lat: 43.6532,
          lng: -79.3832,
          deviceId: 'DEV-DO-MAC01',
          deviceLabel: 'Mac Studio (Chrome)',
          isVpnOrTor: false,
          mfaStatus: 'VERIFIED',
          sessionTokenValid: true,
        },
      },
      {
        minsAgo: 68,
        statusOverride: 'OPEN',
        req: {
          accountId: 'acc-101',
          eventType: 'PASSWORD_RESET',
          amount: 0,
          merchantOrTarget: 'Identity Recovery Endpoint',
          ipAddress: '102.89.33.178',
          city: 'Lagos',
          country: 'Nigeria',
          lat: 6.5244,
          lng: 3.3792,
          deviceId: 'DEV-UNK-AND44',
          deviceLabel: 'Android Emulator x86_64',
          isVpnOrTor: true,
          mfaStatus: 'FAILED',
          sessionTokenValid: false,
        },
      },
      {
        minsAgo: 44,
        statusOverride: 'OPEN',
        req: {
          accountId: 'acc-104',
          eventType: 'CARD_PAYMENT',
          amount: 14200,
          merchantOrTarget: 'Geneva Watch Exchange',
          ipAddress: '185.191.171.12',
          city: 'Zurich',
          country: 'Switzerland',
          lat: 47.3769,
          lng: 8.5417,
          deviceId: 'DEV-UNK-IOS88',
          deviceLabel: 'Unregistered iOS Device',
          isVpnOrTor: false,
          mfaStatus: 'VERIFIED',
          sessionTokenValid: true,
        },
      },
      {
        minsAgo: 22,
        req: {
          accountId: 'acc-102',
          eventType: 'CARD_PAYMENT',
          amount: 820.0,
          merchantOrTarget: 'Midwest Freight Fuel Supply',
          ipAddress: '98.213.44.112',
          city: 'Chicago',
          country: 'United States',
          lat: 41.8781,
          lng: -87.6298,
          deviceId: 'DEV-MH-WIN01',
          deviceLabel: 'ThinkPad X1 Carbon (Windows 11)',
          isVpnOrTor: false,
          mfaStatus: 'VERIFIED',
          sessionTokenValid: true,
        },
      },
      {
        minsAgo: 9,
        statusOverride: 'OPEN',
        req: {
          accountId: 'acc-106',
          eventType: 'WIRE_TRANSFER',
          amount: 27800,
          merchantOrTarget: 'Shenzhen Meridian Trading Co.',
          ipAddress: '45.155.205.91',
          city: 'Hong Kong',
          country: 'China',
          lat: 22.3193,
          lng: 114.1694,
          deviceId: 'DEV-UNK-MAC99',
          deviceLabel: 'Unknown macOS WebKit Client',
          isVpnOrTor: true,
          mfaStatus: 'BYPASSED',
          sessionTokenValid: true,
        },
      },
    ];

    for (const item of seededEvents) {
      const result = this.evaluateInternal(item.req, minutesAgoIso(item.minsAgo), true);
      if (result.alert) {
        if (item.statusOverride) result.alert.status = item.statusOverride;
        if (item.note) {
          result.alert.notes.push({
            id: `NOTE-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
            authorName: 'Claire Mercer',
            authorRole: 'ADMIN',
            text: item.note,
            createdAt: minutesAgoIso(Math.max(1, item.minsAgo - 12)),
          });
        }
      }
    }
  }

  public evaluate(req: EvaluationRequest): {
    transaction: TransactionRecord;
    alert: FraudAlert | null;
  } {
    return this.evaluateInternal(req, new Date().toISOString(), false);
  }

  private evaluateInternal(
    req: EvaluationRequest,
    timestampIso: string,
    isSeed: boolean
  ): {
    transaction: TransactionRecord;
    alert: FraudAlert | null;
  } {
    const account = this.accounts.find((a) => a.id === req.accountId) ?? this.accounts[0];
    const triggeredRules: TriggeredRule[] = [];
    let ruleScore = 0;

    // 1. Account frozen check
    if (account.status === 'FROZEN' && !isSeed) {
      triggeredRules.push({
        code: 'ACC_FROZEN',
        label: 'Frozen Account Access Attempt',
        category: 'UNAUTHORIZED_ACCESS',
        scoreImpact: 95,
        detail: `Account ${account.accountNumber} is currently frozen by fraud operations.`,
      });
      ruleScore += 95;
    }

    // 2. Session token integrity check
    if (!req.sessionTokenValid) {
      triggeredRules.push({
        code: 'INVALID_SESSION',
        label: 'Invalid or Replayed Session Token',
        category: 'UNAUTHORIZED_ACCESS',
        scoreImpact: this.rules.invalidSessionWeight,
        detail: 'JWT signature or anti-replay nonce failed server verification.',
      });
      ruleScore += this.rules.invalidSessionWeight;
    }

    // 3. MFA verification status
    if (req.mfaStatus === 'FAILED' || req.mfaStatus === 'BYPASSED') {
      triggeredRules.push({
        code: req.mfaStatus === 'BYPASSED' ? 'MFA_BYPASS' : 'MFA_FAILED',
        label:
          req.mfaStatus === 'BYPASSED'
            ? 'Multi-Factor Challenge Bypassed'
            : 'Multi-Factor Authentication Failed',
        category: 'UNAUTHORIZED_ACCESS',
        scoreImpact: this.rules.mfaFailureWeight,
        detail:
          req.mfaStatus === 'BYPASSED'
            ? 'Client attempted sensitive operation without completing step-up MFA.'
            : 'Hardware key / TOTP challenge rejected for active session.',
      });
      ruleScore += this.rules.mfaFailureWeight;
    }

    // 4. Device fingerprint verification
    const isKnownDevice = account.trustedDevices.some((d) => d.id === req.deviceId);
    if (!isKnownDevice) {
      triggeredRules.push({
        code: 'UNRECOGNIZED_DEVICE',
        label: 'Unrecognized Device Fingerprint',
        category: 'UNAUTHORIZED_ACCESS',
        scoreImpact: this.rules.unknownDeviceWeight,
        detail: `Device "${req.deviceLabel}" (${req.deviceId}) is not enrolled for ${account.holderName}.`,
      });
      ruleScore += this.rules.unknownDeviceWeight;
    }

    // 5. Geo-velocity / Impossible travel check
    const distanceFromLastKm = haversineKm(
      account.lastVerifiedLat,
      account.lastVerifiedLng,
      req.lat,
      req.lng
    );
    const elapsedHours = Math.max(
      0.25,
      Math.abs(new Date(timestampIso).getTime() - new Date(account.lastVerifiedAt).getTime()) /
        3_600_000
    );
    const travelSpeedKmh = Math.round(distanceFromLastKm / elapsedHours);
    if (distanceFromLastKm > 450 && travelSpeedKmh > 800) {
      triggeredRules.push({
        code: 'IMPOSSIBLE_TRAVEL',
        label: 'Impossible Geographic Travel',
        category: 'GEO_VELOCITY',
        scoreImpact: this.rules.impossibleTravelWeight,
        detail: `${distanceFromLastKm.toLocaleString()} km from ${account.lastVerifiedCity} to ${req.city} (~${travelSpeedKmh.toLocaleString()} km/h).`,
      });
      ruleScore += this.rules.impossibleTravelWeight;
    }

    // 6. Network / VPN / Tor exit node
    if (req.isVpnOrTor) {
      triggeredRules.push({
        code: 'ANONYMIZER_IP',
        label: 'High-Risk Proxy, VPN, or Tor Exit Node',
        category: 'NETWORK_RISK',
        scoreImpact: this.rules.vpnProxyWeight,
        detail: `Source IP ${req.ipAddress} matched commercial proxy / anonymizer ASN feed.`,
      });
      ruleScore += this.rules.vpnProxyWeight;
    }

    // 7. Monetary anomaly check
    const anomalyLimit = account.avgTransactionAmount * this.rules.highAmountMultiplier;
    const zScore =
      req.amount > 0
        ? Math.max(
            0,
            (req.amount - account.avgTransactionAmount) /
              Math.max(100, account.stdDevTransactionAmount)
          )
        : 0;
    if (req.amount > 0 && (req.amount > anomalyLimit || req.amount > account.dailyLimit)) {
      const ratio = (req.amount / account.avgTransactionAmount).toFixed(1);
      triggeredRules.push({
        code: 'AMOUNT_DEVIATION',
        label: 'Abnormal Monetary Volume',
        category: 'AMOUNT_ANOMALY',
        scoreImpact: this.rules.highAmountWeight,
        detail: `$${req.amount.toLocaleString()} is ${ratio}x above account mean (Z-score ${zScore.toFixed(1)}σ).`,
      });
      ruleScore += this.rules.highAmountWeight;
    }

    // 8. Recent velocity burst (same account in last 15 mins)
    const fifteenMinWindow = new Date(timestampIso).getTime() - 15 * 60_000;
    const recentCount = this.transactions.filter(
      (t) => t.accountId === account.id && new Date(t.timestamp).getTime() >= fifteenMinWindow
    ).length;
    if (recentCount >= this.rules.velocityBurstLimit) {
      triggeredRules.push({
        code: 'VELOCITY_SPIKE',
        label: 'Rapid Transaction Velocity Burst',
        category: 'VELOCITY',
        scoreImpact: this.rules.velocityBurstWeight,
        detail: `${recentCount + 1} events recorded on account within 15 minutes (threshold: ${this.rules.velocityBurstLimit}).`,
      });
      ruleScore += this.rules.velocityBurstWeight;
    }

    // 9. Calibrated Logistic Regression ML Fraud Probability Model
    const mlFeatures: MlModelFeature[] = [];
    let logit = -3.15; // Baseline prior ~4.1% fraud logit

    const amountZContrib = Number((Math.min(4.5, zScore) * 0.62).toFixed(2));
    if (amountZContrib > 0.2) {
      logit += amountZContrib;
      mlFeatures.push({
        feature: 'Monetary Z-Score',
        contribution: amountZContrib,
        explanation: `${zScore.toFixed(1)}σ deviation from customer rolling distribution`,
      });
    }

    if (!isKnownDevice) {
      logit += 1.45;
      mlFeatures.push({
        feature: 'Device Entropy Mismatch',
        contribution: 1.45,
        explanation: 'Hardware/browser signature unseen in historical embeddings',
      });
    }

    const geoLogContrib = Number((Math.min(2.2, Math.log10(distanceFromLastKm + 1) * 0.55)).toFixed(2));
    if (distanceFromLastKm > 150) {
      logit += geoLogContrib;
      mlFeatures.push({
        feature: 'Geo-Spatial Displacement',
        contribution: geoLogContrib,
        explanation: `${distanceFromLastKm.toLocaleString()} km shift from verified cluster`,
      });
    }

    if (req.isVpnOrTor) {
      logit += 1.18;
      mlFeatures.push({
        feature: 'ASN Anonymizer Reputation',
        contribution: 1.18,
        explanation: 'High-risk proxy/Tor exit node network feature',
      });
    }

    if (req.mfaStatus !== 'VERIFIED' || !req.sessionTokenValid) {
      logit += 2.05;
      mlFeatures.push({
        feature: 'Auth Integrity Vector',
        contribution: 2.05,
        explanation: 'Failed MFA challenge or invalid session nonce',
      });
    }

    const highRiskTarget = /crypto|offshore|escrow|recovery|clearing/i.test(req.merchantOrTarget);
    if (highRiskTarget) {
      logit += 0.78;
      mlFeatures.push({
        feature: 'Counterparty MCC Risk',
        contribution: 0.78,
        explanation: 'High-velocity liquidation or credential recovery counterparty',
      });
    }

    const mlFraudProbability = Number(Math.min(0.99, Math.max(0.01, sigmoid(logit))).toFixed(2));
    if (mlFraudProbability >= 0.75 && triggeredRules.length === 0) {
      triggeredRules.push({
        code: 'ML_ENSEMBLE_HIGH',
        label: 'ML Behavioral Anomaly Threshold Exceeded',
        category: 'ML_MODEL',
        scoreImpact: 24,
        detail: `Calibrated logistic risk model predicted ${Math.round(mlFraudProbability * 100)}% fraud probability.`,
      });
      ruleScore += 24;
    }

    // Blend rule score with calibrated ML score
    const blendedScore = Math.round(ruleScore * 0.78 + mlFraudProbability * 100 * 0.22);
    const clampedScore = Math.min(100, Math.max(2, blendedScore || 6));

    const unauthorizedSignals = triggeredRules.filter(
      (r) => r.category === 'UNAUTHORIZED_ACCESS' || r.code === 'IMPOSSIBLE_TRAVEL'
    ).length;

    const isUnauthorizedUser =
      !req.sessionTokenValid ||
      req.mfaStatus !== 'VERIFIED' ||
      (!isKnownDevice && unauthorizedSignals >= 2) ||
      (account.status === 'FROZEN' && !isSeed);

    let verdict: RiskVerdict = 'AUTHORIZED';
    if (
      clampedScore >= this.rules.blockThreshold ||
      (isUnauthorizedUser && clampedScore >= 55) ||
      mlFraudProbability >= 0.9
    ) {
      verdict = 'BLOCKED_UNAUTHORIZED';
    } else if (
      clampedScore >= this.rules.challengeThreshold ||
      !isKnownDevice ||
      mlFraudProbability >= 0.65
    ) {
      verdict = 'CHALLENGE_MFA';
    }

    const txId = `TXN-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const transaction: TransactionRecord = {
      ...req,
      id: txId,
      accountNumber: account.accountNumber,
      holderName: account.holderName,
      timestamp: timestampIso,
      riskScore: clampedScore,
      mlFraudProbability,
      mlFeatures: mlFeatures.sort((a, b) => b.contribution - a.contribution),
      verdict,
      isUnauthorizedUser,
      triggeredRules,
      distanceFromLastKm,
      travelSpeedKmh,
    };

    this.transactions.unshift(transaction);
    if (this.transactions.length > 150) {
      this.transactions.pop();
    }

    if (verdict === 'AUTHORIZED' && !isSeed) {
      account.lastVerifiedCity = req.city;
      account.lastVerifiedCountry = req.country;
      account.lastVerifiedLat = req.lat;
      account.lastVerifiedLng = req.lng;
      account.lastVerifiedAt = timestampIso;
      account.lastIp = req.ipAddress;
    }

    let alert: FraudAlert | null = null;
    if (verdict !== 'AUTHORIZED') {
      const severity: AlertSeverity =
        clampedScore >= 80 || isUnauthorizedUser
          ? 'CRITICAL'
          : clampedScore >= this.rules.blockThreshold
            ? 'HIGH'
            : 'MEDIUM';

      const primaryReason = triggeredRules[0]?.label ?? 'Suspicious Activity Flagged';
      const title = isUnauthorizedUser
        ? `Unauthorized user blocked — ${primaryReason}`
        : `Step-up review required — ${primaryReason}`;

      const summary = triggeredRules.map((r) => r.label).join(' · ');

      alert = {
        id: `ALT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        transactionId: txId,
        accountId: account.id,
        accountNumber: account.accountNumber,
        holderName: account.holderName,
        severity,
        status: 'OPEN',
        title,
        summary,
        riskScore: clampedScore,
        mlFraudProbability,
        unauthorizedUserDetected: isUnauthorizedUser,
        triggeredRules,
        amount: req.amount,
        eventType: req.eventType,
        location: `${req.city}, ${req.country}`,
        ipAddress: req.ipAddress,
        deviceLabel: req.deviceLabel,
        createdAt: timestampIso,
        updatedAt: timestampIso,
        assignedAnalyst: 'Claire Mercer',
        notes: [],
      };

      this.alerts.unshift(alert);
      if (this.alerts.length > 100) {
        this.alerts.pop();
      }
    }

    return { transaction, alert };
  }

  public generateNextMonitorEvent(): EvaluationRequest {
    const templates: EvaluationRequest[] = [
      {
        accountId: 'acc-101',
        eventType: 'CARD_PAYMENT',
        amount: 215.4,
        merchantOrTarget: 'Equinox Manhattan Club',
        ipAddress: '72.14.198.44',
        city: 'New York',
        country: 'United States',
        lat: 40.7128,
        lng: -74.006,
        deviceId: 'DEV-EV-IOS02',
        deviceLabel: 'iPhone 16 Pro (FaceID)',
        isVpnOrTor: false,
        mfaStatus: 'VERIFIED',
        sessionTokenValid: true,
      },
      {
        accountId: 'acc-102',
        eventType: 'WIRE_TRANSFER',
        amount: 28900,
        merchantOrTarget: 'Cyprus Offshore Liquidity Clearing',
        ipAddress: '185.220.103.11',
        city: 'Limassol',
        country: 'Cyprus',
        lat: 34.7071,
        lng: 33.0226,
        deviceId: 'DEV-UNK-LNX55',
        deviceLabel: 'Headless Chromium Proxy Node',
        isVpnOrTor: true,
        mfaStatus: 'FAILED',
        sessionTokenValid: true,
      },
      {
        accountId: 'acc-105',
        eventType: 'CARD_PAYMENT',
        amount: 94.8,
        merchantOrTarget: 'H-E-B Grocery Austin #19',
        ipAddress: '70.114.88.203',
        city: 'Austin',
        country: 'United States',
        lat: 30.2672,
        lng: -97.7431,
        deviceId: 'DEV-CR-IOS01',
        deviceLabel: 'iPhone 16 (iOS 18)',
        isVpnOrTor: false,
        mfaStatus: 'VERIFIED',
        sessionTokenValid: true,
      },
      {
        accountId: 'acc-101',
        eventType: 'LOGIN_ATTEMPT',
        amount: 0,
        merchantOrTarget: 'Private Banking OAuth Sign-In',
        ipAddress: '91.199.212.52',
        city: 'Bucharest',
        country: 'Romania',
        lat: 44.4268,
        lng: 26.1025,
        deviceId: 'DEV-UNK-BOT82',
        deviceLabel: 'Unregistered Firefox Linux VM',
        isVpnOrTor: true,
        mfaStatus: 'BYPASSED',
        sessionTokenValid: false,
      },
      {
        accountId: 'acc-104',
        eventType: 'ACH_WITHDRAWAL',
        amount: 11800,
        merchantOrTarget: 'Zurich Bullion Vaults AG',
        ipAddress: '185.191.171.12',
        city: 'Zurich',
        country: 'Switzerland',
        lat: 47.3769,
        lng: 8.5417,
        deviceId: 'DEV-UNK-MAC41',
        deviceLabel: 'Unenrolled macOS Safari',
        isVpnOrTor: false,
        mfaStatus: 'VERIFIED',
        sessionTokenValid: true,
      },
      {
        accountId: 'acc-106',
        eventType: 'CARD_PAYMENT',
        amount: 640.0,
        merchantOrTarget: 'Air Canada Pearson Terminal',
        ipAddress: '142.116.55.90',
        city: 'Toronto',
        country: 'Canada',
        lat: 43.6532,
        lng: -79.3832,
        deviceId: 'DEV-DO-IOS02',
        deviceLabel: 'iPhone 15 Pro Max',
        isVpnOrTor: false,
        mfaStatus: 'VERIFIED',
        sessionTokenValid: true,
      },
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  public getAlertById(alertId: string): FraudAlert | null {
    return this.alerts.find((a) => a.id === alertId) ?? null;
  }

  public updateAlertStatus(alertId: string, status: AlertStatus): FraudAlert | null {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return null;
    alert.status = status;
    alert.updatedAt = new Date().toISOString();
    return alert;
  }

  public addAlertNote(alertId: string, author: AuthUser, text: string): FraudAlert | null {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return null;
    const note: InvestigationNote = {
      id: `NOTE-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      authorName: author.fullName,
      authorRole: author.role,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    alert.notes.unshift(note);
    alert.updatedAt = note.createdAt;
    return alert;
  }

  public updateAccountStatus(accountId: string, status: AccountStatus): AccountProfile | null {
    const account = this.accounts.find((a) => a.id === accountId);
    if (!account) return null;
    account.status = status;
    return account;
  }

  public updateRules(partial: Partial<FraudRuleConfig>): FraudRuleConfig {
    this.rules = {
      ...this.rules,
      ...partial,
    };
    return this.rules;
  }

  public getRules(): FraudRuleConfig {
    return { ...this.rules };
  }

  private computeMetricsFor(
    accounts: AccountProfile[],
    transactions: TransactionRecord[],
    alerts: FraudAlert[]
  ): DashboardMetrics {
    const totalEvaluated = transactions.length;
    const unauthorizedBlocked = transactions.filter(
      (t) => t.verdict === 'BLOCKED_UNAUTHORIZED'
    ).length;
    const openAlerts = alerts.filter(
      (a) => a.status === 'OPEN' || a.status === 'INVESTIGATING'
    ).length;
    const criticalAlerts = alerts.filter(
      (a) => (a.status === 'OPEN' || a.status === 'INVESTIGATING') && a.severity === 'CRITICAL'
    ).length;
    const exposurePreventedUsd = transactions
      .filter((t) => t.verdict === 'BLOCKED_UNAUTHORIZED')
      .reduce((acc, t) => acc + t.amount, 0);
    const frozenAccounts = accounts.filter((a) => a.status === 'FROZEN').length;
    const averageRiskScore =
      totalEvaluated > 0
        ? Math.round(transactions.reduce((sum, t) => sum + t.riskScore, 0) / totalEvaluated)
        : 0;
    const avgMlProbability =
      totalEvaluated > 0
        ? Number(
            (
              transactions.reduce((sum, t) => sum + t.mlFraudProbability, 0) / totalEvaluated
            ).toFixed(2)
          )
        : 0;

    return {
      totalEvaluated,
      unauthorizedBlocked,
      openAlerts,
      criticalAlerts,
      exposurePreventedUsd,
      frozenAccounts,
      averageRiskScore,
      avgMlProbability,
    };
  }

  private computeHourlySeriesFor(transactions: TransactionRecord[]): HourlyMetricPoint[] {
    const now = Date.now();
    const buckets: HourlyMetricPoint[] = [];

    for (let i = 5; i >= 0; i--) {
      const bucketEnd = now - i * 3_600_000;
      const bucketStart = bucketEnd - 3_600_000;
      const d = new Date(bucketEnd);
      const label = `${String(d.getHours()).padStart(2, '0')}:00`;

      const inBucket = transactions.filter((t) => {
        const ts = new Date(t.timestamp).getTime();
        return ts > bucketStart && ts <= bucketEnd;
      });

      const authorized = inBucket.filter((t) => t.verdict === 'AUTHORIZED').length;
      const challenged = inBucket.filter((t) => t.verdict === 'CHALLENGE_MFA').length;
      const blockedUnauthorized = inBucket.filter(
        (t) => t.verdict === 'BLOCKED_UNAUTHORIZED'
      ).length;
      const avgScore =
        inBucket.length > 0
          ? Math.round(inBucket.reduce((s, t) => s + t.riskScore, 0) / inBucket.length)
          : 12;

      buckets.push({
        hour: label,
        authorized,
        challenged,
        blockedUnauthorized,
        avgScore,
      });
    }

    return buckets;
  }

  public getMetrics(user?: AuthUser): DashboardMetrics {
    if (user?.role === 'CUSTOMER' && user.linkedAccountId) {
      const accId = user.linkedAccountId;
      return this.computeMetricsFor(
        this.accounts.filter((a) => a.id === accId),
        this.transactions.filter((t) => t.accountId === accId),
        this.alerts.filter((a) => a.accountId === accId)
      );
    }
    return this.computeMetricsFor(this.accounts, this.transactions, this.alerts);
  }

  public getHourlySeries(user?: AuthUser): HourlyMetricPoint[] {
    if (user?.role === 'CUSTOMER' && user.linkedAccountId) {
      return this.computeHourlySeriesFor(
        this.transactions.filter((t) => t.accountId === user.linkedAccountId)
      );
    }
    return this.computeHourlySeriesFor(this.transactions);
  }

  public getSnapshot(user?: AuthUser): DashboardSnapshot {
    if (user?.role === 'CUSTOMER' && user.linkedAccountId) {
      const accId = user.linkedAccountId;
      const accounts = this.accounts.filter((a) => a.id === accId);
      const transactions = this.transactions.filter((t) => t.accountId === accId);
      const alerts = this.alerts.filter((a) => a.accountId === accId);
      return {
        accounts,
        transactions,
        alerts,
        rules: this.rules,
        metrics: this.computeMetricsFor(accounts, transactions, alerts),
        hourlySeries: this.computeHourlySeriesFor(transactions),
        liveMonitorRunning: this.liveMonitorRunning,
      };
    }

    return {
      accounts: this.accounts,
      transactions: this.transactions,
      alerts: this.alerts,
      rules: this.rules,
      metrics: this.computeMetricsFor(this.accounts, this.transactions, this.alerts),
      hourlySeries: this.computeHourlySeriesFor(this.transactions),
      liveMonitorRunning: this.liveMonitorRunning,
    };
  }
}

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AccountStatus,
  AlertStatus,
  DashboardSnapshot,
  EvaluationRequest,
  FraudAlert,
  FraudRuleConfig,
  TransactionRecord,
  WsMessage,
} from '../shared/types';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting';

export interface LiveToast {
  id: string;
  alert: FraudAlert;
  receivedAt: number;
}

export function useFraudStream(token: string | null, onUnauthorized?: () => void) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [liveToasts, setLiveToasts] = useState<LiveToast[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const dismissToast = useCallback((id: string) => {
    setLiveToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const authHeaders = useCallback(
    (json = false): HeadersInit => {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (json) headers['Content-Type'] = 'application/json';
      return headers;
    },
    [token]
  );

  const fetchSnapshot = useCallback(async () => {
    if (!token) {
      setSnapshot(null);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/snapshot', { headers: authHeaders() });
      if (res.status === 401) {
        onUnauthorized?.();
        return;
      }
      if (!res.ok) throw new Error('Failed to load fraud monitoring snapshot');
      const data = (await res.json()) as DashboardSnapshot;
      if (mountedRef.current) {
        setSnapshot(data);
        setLoading(false);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unable to reach monitoring server');
        setLoading(false);
      }
    }
  }, [token, authHeaders, onUnauthorized]);

  useEffect(() => {
    mountedRef.current = true;
    if (!token) {
      setSnapshot(null);
      setLiveToasts([]);
      setLoading(false);
      setConnectionState('connecting');
      return;
    }

    setLoading(true);
    fetchSnapshot();

    let attempt = 0;

    const connect = () => {
      if (!mountedRef.current || !token) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (!mountedRef.current) return;
        attempt = 0;
        setConnectionState('connected');
      };

      socket.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data as string) as WsMessage;
          switch (msg.type) {
            case 'init':
              setSnapshot(msg.payload);
              setLoading(false);
              setError(null);
              break;

            case 'transaction:evaluated':
              setSnapshot((prev) => {
                if (!prev) return prev;
                const exists = prev.transactions.some((t) => t.id === msg.payload.transaction.id);
                const nextTransactions = exists
                  ? prev.transactions
                  : [msg.payload.transaction, ...prev.transactions].slice(0, 150);
                return {
                  ...prev,
                  transactions: nextTransactions,
                  metrics: msg.payload.metrics,
                  hourlySeries: msg.payload.hourlySeries,
                };
              });
              break;

            case 'alert:created': {
              const incomingAlert = msg.payload.alert;
              setSnapshot((prev) => {
                if (!prev) return prev;
                const exists = prev.alerts.some((a) => a.id === incomingAlert.id);
                const nextAlerts = exists
                  ? prev.alerts
                  : [incomingAlert, ...prev.alerts].slice(0, 100);
                return {
                  ...prev,
                  alerts: nextAlerts,
                  metrics: msg.payload.metrics,
                };
              });
              setLiveToasts((prev) => {
                if (prev.some((t) => t.id === incomingAlert.id)) return prev;
                return [
                  { id: incomingAlert.id, alert: incomingAlert, receivedAt: Date.now() },
                  ...prev,
                ].slice(0, 3);
              });
              window.setTimeout(() => {
                if (mountedRef.current) {
                  setLiveToasts((prev) => prev.filter((t) => t.id !== incomingAlert.id));
                }
              }, 9000);
              break;
            }

            case 'alert:updated':
              setSnapshot((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  alerts: prev.alerts.map((a) =>
                    a.id === msg.payload.alert.id ? msg.payload.alert : a
                  ),
                  metrics: msg.payload.metrics,
                };
              });
              break;

            case 'account:updated':
              setSnapshot((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  accounts: prev.accounts.map((acc) =>
                    acc.id === msg.payload.account.id ? msg.payload.account : acc
                  ),
                  metrics: msg.payload.metrics,
                };
              });
              break;

            case 'rules:updated':
              setSnapshot((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  rules: msg.payload.rules,
                };
              });
              break;

            case 'monitor:status':
              setSnapshot((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  liveMonitorRunning: msg.payload.liveMonitorRunning,
                };
              });
              break;
          }
        } catch {
          // Ignore malformed frame
        }
      };

      socket.onclose = (ev) => {
        if (!mountedRef.current) return;
        if (ev.code === 4001) {
          onUnauthorized?.();
          return;
        }
        setConnectionState('reconnecting');
        const delay = Math.min(8000, 1000 * Math.pow(1.6, attempt));
        attempt += 1;
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [token, fetchSnapshot, onUnauthorized]);

  const evaluateActivity = useCallback(
    async (
      payload: EvaluationRequest
    ): Promise<{ transaction: TransactionRecord; alert: FraudAlert | null }> => {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? 'Failed to evaluate activity');
      }
      return (await res.json()) as { transaction: TransactionRecord; alert: FraudAlert | null };
    },
    [authHeaders]
  );

  const triggerLiveBurst = useCallback(async () => {
    const res = await fetch('/api/simulate-burst', {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to queue live traffic burst');
  }, [authHeaders]);

  const toggleLiveMonitor = useCallback(
    async (enabled?: boolean) => {
      const res = await fetch('/api/monitor/toggle', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error('Failed to toggle real-time monitor');
      return (await res.json()) as { liveMonitorRunning: boolean };
    },
    [authHeaders]
  );

  const updateAlertStatus = useCallback(
    async (alertId: string, status: AlertStatus) => {
      const res = await fetch(`/api/alerts/${encodeURIComponent(alertId)}`, {
        method: 'PATCH',
        headers: authHeaders(true),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update alert status');
    },
    [authHeaders]
  );

  const addAlertNote = useCallback(
    async (alertId: string, text: string) => {
      const res = await fetch(`/api/alerts/${encodeURIComponent(alertId)}/notes`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? 'Failed to post investigation note');
      }
    },
    [authHeaders]
  );

  const updateAccountStatus = useCallback(
    async (accountId: string, status: AccountStatus) => {
      const res = await fetch(`/api/accounts/${encodeURIComponent(accountId)}/status`, {
        method: 'PATCH',
        headers: authHeaders(true),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? 'Failed to update account status');
      }
    },
    [authHeaders]
  );

  const updateRules = useCallback(
    async (rules: FraudRuleConfig) => {
      const res = await fetch('/api/rules', {
        method: 'PUT',
        headers: authHeaders(true),
        body: JSON.stringify(rules),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? 'Failed to update fraud detection rules');
      }
      return (await res.json()) as FraudRuleConfig;
    },
    [authHeaders]
  );

  return {
    snapshot,
    loading,
    error,
    connectionState,
    liveToasts,
    dismissToast,
    evaluateActivity,
    triggerLiveBurst,
    toggleLiveMonitor,
    updateAlertStatus,
    addAlertNote,
    updateAccountStatus,
    updateRules,
    refresh: fetchSnapshot,
  };
}

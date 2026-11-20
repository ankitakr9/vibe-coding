import http from 'node:http';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import JSZip from 'jszip';
import { WebSocket, WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import { AuthStore } from './src/server/authService.ts';
import { FraudEngineStore } from './src/server/fraudEngine.ts';
import { generateJavaProjectFiles } from './src/server/javaProjectGenerator.ts';
import type {
  AccountStatus,
  AlertStatus,
  AuthUser,
  EvaluationRequest,
  FraudAlert,
  FraudRuleConfig,
  TransactionRecord,
  UserRole,
  UserStatus,
  WsMessage,
} from './src/shared/types.ts';

interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
}

interface AuthenticatedSocket extends WebSocket {
  authUser?: AuthUser;
}

const PORT = 3000;
const app = express();
app.use(express.json());

const authStore = new AuthStore();
const store = new FraudEngineStore();
const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

let liveMonitorInterval: NodeJS.Timeout | null = null;

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  const queryToken = req.query.token;
  if (typeof queryToken === 'string' && queryToken.length > 0) {
    return queryToken;
  }
  return null;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const user = authStore.verifyToken(token);
  if (!user) {
    res.status(401).json({ error: 'Session expired or invalid token. Please sign in again.' });
    return;
  }
  req.authUser = user;
  next();
}

function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.authUser;
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowedRoles.includes(user.role)) {
      authStore.recordAudit(
        user.email,
        user.role,
        'RBAC_ACCESS_DENIED',
        req.originalUrl,
        'DENIED',
        `Role ${user.role} attempted restricted operation requiring [${allowedRoles.join(', ')}].`
      );
      res.status(403).json({
        error: `Forbidden: requires ${allowedRoles.join(' or ')} role.`,
      });
      return;
    }
    next();
  };
}

function broadcastEvent(
  accountId: string | null,
  makeMessage: (user: AuthUser) => WsMessage
): void {
  for (const client of wss.clients as Set<AuthenticatedSocket>) {
    if (client.readyState !== WebSocket.OPEN || !client.authUser) continue;
    if (
      accountId &&
      client.authUser.role === 'CUSTOMER' &&
      client.authUser.linkedAccountId !== accountId
    ) {
      continue;
    }
    client.send(JSON.stringify(makeMessage(client.authUser)));
  }
}

function dispatchEvaluationResult(transaction: TransactionRecord, alert: FraudAlert | null): void {
  broadcastEvent(transaction.accountId, (user) => ({
    type: 'transaction:evaluated',
    payload: {
      transaction,
      metrics: store.getMetrics(user),
      hourlySeries: store.getHourlySeries(user),
    },
  }));

  if (alert) {
    broadcastEvent(alert.accountId, (user) => ({
      type: 'alert:created',
      payload: {
        alert,
        metrics: store.getMetrics(user),
      },
    }));
  }
}

wss.on('connection', (socket: AuthenticatedSocket, request) => {
  const url = new URL(request.url ?? '/ws', `http://${request.headers.host ?? 'localhost'}`);
  const token = url.searchParams.get('token');
  const user = token ? authStore.verifyToken(token) : null;

  if (!user) {
    socket.close(4001, 'Unauthorized WebSocket connection');
    return;
  }

  socket.authUser = user;
  const initMsg: WsMessage = {
    type: 'init',
    payload: store.getSnapshot(user),
  };
  socket.send(JSON.stringify(initMsg));
});

// ========================
// Public Authentication API
// ========================
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }
  const result = authStore.login(email, password);
  if ('error' in result) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json(result);
});

app.post('/api/auth/register', (req, res) => {
  const { fullName, email, password, role } = req.body as {
    fullName?: string;
    email?: string;
    password?: string;
    role?: UserRole;
  };
  if (!fullName || !email || !password) {
    res.status(400).json({ error: 'Full name, email, and password are required.' });
    return;
  }
  const result = authStore.register({
    fullName,
    email,
    password,
    role: role ?? 'CUSTOMER',
  });
  if ('error' in result) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.status(201).json(result);
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.authUser });
});

// ========================
// Protected Monitoring & Fraud Engine API
// ========================
app.get('/api/snapshot', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json(store.getSnapshot(req.authUser));
});

app.post('/api/evaluate', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const body = req.body as EvaluationRequest;
  if (!body || !body.accountId || !body.eventType) {
    res.status(400).json({ error: 'Missing required evaluation fields.' });
    return;
  }

  // Customers may only test/evaluate events on their own linked account
  if (user.role === 'CUSTOMER' && user.linkedAccountId && body.accountId !== user.linkedAccountId) {
    res.status(403).json({ error: 'Customers may only inspect transactions on their own account.' });
    return;
  }

  const { transaction, alert } = store.evaluate(body);
  dispatchEvaluationResult(transaction, alert);

  authStore.recordAudit(
    user.email,
    user.role,
    'TRANSACTION_EVALUATED',
    transaction.id,
    'SUCCESS',
    `Verdict ${transaction.verdict} (Score ${transaction.riskScore}, ML ${Math.round(transaction.mlFraudProbability * 100)}%).`
  );

  res.status(201).json({ transaction, alert, metrics: store.getMetrics(user) });
});

app.post(
  '/api/simulate-burst',
  requireAuth,
  requireRole('ADMIN', 'ANALYST'),
  (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const burstEvents: EvaluationRequest[] = [
      {
        accountId: 'acc-101',
        eventType: 'WIRE_TRANSFER',
        amount: 21500,
        merchantOrTarget: 'Baltic Offshore Clearing #409',
        ipAddress: '185.220.102.240',
        city: 'Warsaw',
        country: 'Poland',
        lat: 52.2297,
        lng: 21.0122,
        deviceId: 'DEV-UNK-LNX88',
        deviceLabel: 'Unknown Linux Chrome 130',
        isVpnOrTor: true,
        mfaStatus: 'FAILED',
        sessionTokenValid: true,
      },
      {
        accountId: 'acc-105',
        eventType: 'CARD_PAYMENT',
        amount: 145.0,
        merchantOrTarget: 'Central Market Austin',
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
        accountId: 'acc-102',
        eventType: 'LOGIN_ATTEMPT',
        amount: 0,
        merchantOrTarget: 'Commercial Treasury Sign-In',
        ipAddress: '91.199.212.52',
        city: 'Moscow',
        country: 'Russia',
        lat: 55.7558,
        lng: 37.6173,
        deviceId: 'DEV-UNK-BOT14',
        deviceLabel: 'Automated Playwright Chromium',
        isVpnOrTor: true,
        mfaStatus: 'BYPASSED',
        sessionTokenValid: false,
      },
    ];

    authStore.recordAudit(
      user.email,
      user.role,
      'LIVE_TRAFFIC_BURST',
      'Transaction Monitor',
      'SUCCESS',
      'Queued 3 live multi-account bank events for real-time scoring.'
    );

    burstEvents.forEach((evt, index) => {
      setTimeout(() => {
        const { transaction, alert } = store.evaluate(evt);
        dispatchEvaluationResult(transaction, alert);
      }, index * 850);
    });

    res.status(202).json({ queued: burstEvents.length });
  }
);

app.post(
  '/api/monitor/toggle',
  requireAuth,
  requireRole('ADMIN', 'ANALYST'),
  (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const { enabled } = req.body as { enabled?: boolean };
    const nextState = typeof enabled === 'boolean' ? enabled : !store.isLiveMonitorRunning();

    store.setLiveMonitorRunning(nextState);

    if (liveMonitorInterval) {
      clearInterval(liveMonitorInterval);
      liveMonitorInterval = null;
    }

    if (nextState) {
      liveMonitorInterval = setInterval(() => {
        const evt = store.generateNextMonitorEvent();
        const { transaction, alert } = store.evaluate(evt);
        dispatchEvaluationResult(transaction, alert);
      }, 4500);
    }

    authStore.recordAudit(
      user.email,
      user.role,
      nextState ? 'MONITOR_STARTED' : 'MONITOR_STOPPED',
      'Real-Time Stream',
      'SUCCESS',
      nextState
        ? 'Enabled continuous real-time bank transaction monitoring stream.'
        : 'Paused continuous real-time bank transaction monitoring stream.'
    );

    broadcastEvent(null, () => ({
      type: 'monitor:status',
      payload: { liveMonitorRunning: nextState },
    }));

    res.json({ liveMonitorRunning: nextState });
  }
);

app.patch('/api/alerts/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const existing = store.getAlertById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }

  if (
    user.role === 'CUSTOMER' &&
    (!user.linkedAccountId || existing.accountId !== user.linkedAccountId)
  ) {
    res.status(403).json({ error: 'You can only respond to alerts on your own account.' });
    return;
  }

  const { status } = req.body as { status: AlertStatus };
  const updated = store.updateAlertStatus(req.params.id, status);
  if (!updated) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }

  authStore.recordAudit(
    user.email,
    user.role,
    'ALERT_DISPOSITION',
    updated.id,
    'SUCCESS',
    `Changed alert status to ${status}.`
  );

  broadcastEvent(updated.accountId, (u) => ({
    type: 'alert:updated',
    payload: { alert: updated, metrics: store.getMetrics(u) },
  }));

  res.json({ alert: updated, metrics: store.getMetrics(user) });
});

app.post(
  '/api/alerts/:id/notes',
  requireAuth,
  requireRole('ADMIN', 'ANALYST'),
  (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const { text } = req.body as { text?: string };
    if (!text || text.trim().length < 2) {
      res.status(400).json({ error: 'Investigation note cannot be empty.' });
      return;
    }

    const updated = store.addAlertNote(req.params.id, user, text);
    if (!updated) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    authStore.recordAudit(
      user.email,
      user.role,
      'CASE_NOTE_ADDED',
      updated.id,
      'SUCCESS',
      `Added analyst case note (${text.trim().slice(0, 60)}).`
    );

    broadcastEvent(updated.accountId, (u) => ({
      type: 'alert:updated',
      payload: { alert: updated, metrics: store.getMetrics(u) },
    }));

    res.status(201).json({ alert: updated });
  }
);

app.patch('/api/accounts/:id/status', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const { status } = req.body as { status: AccountStatus };

  if (user.role === 'CUSTOMER') {
    if (user.linkedAccountId !== req.params.id) {
      res.status(403).json({ error: 'You may only lock your own linked account.' });
      return;
    }
    if (status === 'ACTIVE') {
      res
        .status(403)
        .json({ error: 'Unfreezing a frozen account requires an Admin or Fraud Analyst.' });
      return;
    }
  }

  const updated = store.updateAccountStatus(req.params.id, status);
  if (!updated) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  authStore.recordAudit(
    user.email,
    user.role,
    status === 'FROZEN' ? 'ACCOUNT_FROZEN' : 'ACCOUNT_UNFROZEN',
    updated.accountNumber,
    'SUCCESS',
    `Account ${updated.accountNumber} (${updated.holderName}) set to ${status}.`
  );

  broadcastEvent(updated.id, (u) => ({
    type: 'account:updated',
    payload: { account: updated, metrics: store.getMetrics(u) },
  }));

  res.json({ account: updated, metrics: store.getMetrics(user) });
});

// ========================
// Admin-Only Policy & RBAC Governance Routes
// ========================
app.put(
  '/api/rules',
  requireAuth,
  requireRole('ADMIN'),
  (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const updated = store.updateRules(req.body as Partial<FraudRuleConfig>);
    authStore.recordAudit(
      user.email,
      user.role,
      'RULES_POLICY_UPDATED',
      'Detection Engine',
      'SUCCESS',
      `Updated thresholds: Challenge=${updated.challengeThreshold}, Block=${updated.blockThreshold}.`
    );
    broadcastEvent(null, () => ({
      type: 'rules:updated',
      payload: { rules: updated },
    }));
    res.json(updated);
  }
);

app.get(
  '/api/admin/users',
  requireAuth,
  requireRole('ADMIN'),
  (_req, res) => {
    res.json({ users: authStore.listUsers() });
  }
);

app.patch(
  '/api/admin/users/:id/role',
  requireAuth,
  requireRole('ADMIN'),
  (req: AuthenticatedRequest, res) => {
    const { role } = req.body as { role: UserRole };
    if (!['ADMIN', 'ANALYST', 'CUSTOMER'].includes(role)) {
      res.status(400).json({ error: 'Invalid RBAC role.' });
      return;
    }
    const updated = authStore.updateUserRole(req.authUser!, req.params.id, role);
    if (!updated) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json({ user: updated });
  }
);

app.patch(
  '/api/admin/users/:id/status',
  requireAuth,
  requireRole('ADMIN'),
  (req: AuthenticatedRequest, res) => {
    const { status } = req.body as { status: UserStatus };
    if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
      res.status(400).json({ error: 'Invalid status.' });
      return;
    }
    const updated = authStore.updateUserStatus(req.authUser!, req.params.id, status);
    if (!updated) {
      res.status(400).json({ error: 'User not found or cannot suspend your own active admin account.' });
      return;
    }
    res.json({ user: updated });
  }
);

app.get(
  '/api/audit-logs',
  requireAuth,
  requireRole('ADMIN', 'ANALYST'),
  (_req, res) => {
    res.json({ logs: authStore.getAuditLogs() });
  }
);

app.get(
  '/api/java-project',
  requireAuth,
  requireRole('ADMIN', 'ANALYST'),
  (_req, res) => {
    res.json({
      projectName: 'veritas-fraudguard-java',
      files: generateJavaProjectFiles(store.getRules()),
    });
  }
);

app.get(
  '/api/java-project/download',
  requireAuth,
  requireRole('ADMIN', 'ANALYST'),
  async (_req, res) => {
    const zip = new JSZip();
    const root = zip.folder('veritas-fraudguard-java');
    const files = generateJavaProjectFiles(store.getRules());

    if (root) {
      for (const file of files) {
        root.file(file.path, file.content);
      }
    }

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="veritas-fraudguard-java.zip"');
    res.send(buffer);
  }
);

async function startServer(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Veritas FraudGuard server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

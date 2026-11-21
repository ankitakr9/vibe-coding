import type { Response } from 'express';

export interface RealtimeEvent {
  type: 'inventory_updated' | 'locations_updated' | 'connected';
  entity?: 'item' | 'location' | 'movement' | 'seed';
  action?: string;
  timestamp: string;
}

const userClients = new Map<string, Set<Response>>();

export function subscribeUserStream(uid: string, res: Response): () => void {
  let clients = userClients.get(uid);
  if (!clients) {
    clients = new Set();
    userClients.set(uid, clients);
  }
  clients.add(res);

  writeEvent(res, {
    type: 'connected',
    timestamp: new Date().toISOString(),
  });

  const heartbeat = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  return () => {
    clearInterval(heartbeat);
    const active = userClients.get(uid);
    if (active) {
      active.delete(res);
      if (active.size === 0) {
        userClients.delete(uid);
      }
    }
  };
}

export function broadcastToUser(uid: string, event: Omit<RealtimeEvent, 'timestamp'>): void {
  const clients = userClients.get(uid);
  if (!clients || clients.size === 0) return;

  const payload: RealtimeEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  for (const res of clients) {
    try {
      writeEvent(res, payload);
    } catch {
      clients.delete(res);
    }
  }
}

function writeEvent(res: Response, data: RealtimeEvent): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

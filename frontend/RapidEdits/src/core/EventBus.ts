import type { EditorEvent } from '../types/Media';

type EventHandler<T> = (payload: T) => void;

export class EventBus {
  private listeners: Map<string, EventHandler<any>[]> = new Map();

  on<T extends EditorEvent>(eventType: T['type'], handler: EventHandler<Extract<T, { type: T['type'] }>['payload']>) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)?.push(handler);
  }

  off<T extends EditorEvent>(eventType: T['type'], handler: EventHandler<Extract<T, { type: T['type'] }>['payload']>) {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      this.listeners.set(eventType, handlers.filter(h => h !== handler));
    }
  }

  emit<T extends EditorEvent>(event: T) {
    const handlers = this.listeners.get(event.type);
    if (handlers) {
      handlers.forEach(handler => handler(event.payload));
    }
  }
}

export const globalEventBus = new EventBus();

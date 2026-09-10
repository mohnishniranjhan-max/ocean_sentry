import type { GestureEvent, GestureListener } from './gestureTypes';

export class GestureManager {
  private listeners: Map<string, Set<GestureListener>> = new Map();
  private globalListeners: Set<GestureListener> = new Set();

  on(type: string, listener: GestureListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
    return () => this.listeners.get(type)?.delete(listener);
  }

  onAny(listener: GestureListener): () => void {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }

  emit(event: GestureEvent): void {
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      for (const listener of typeListeners) {
        listener(event);
      }
    }
    for (const listener of this.globalListeners) {
      listener(event);
    }
  }

  removeAll(): void {
    this.listeners.clear();
    this.globalListeners.clear();
  }
}

export const gestureManager = new GestureManager();

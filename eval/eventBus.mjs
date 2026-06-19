// eventBus.mjs
// Minimal synchronous publish/subscribe event bus for in-process coordination
// (e.g. fan-out of domain events to handlers). Self-contained, runnable:
//   node eval/eventBus.mjs
//
// Contract: emitting an event that has NO subscribers must be a safe no-op. A
// service that publishes "order.cancelled" should never crash just because
// nothing happens to be listening for it yet.
//
// @typedef {(payload: unknown) => void} Handler

export class EventBus {
  constructor() {
    /** @type {Record<string, Handler[]>} event name -> handlers, in sub order */
    this.listeners = Object.create(null);
  }

  /**
   * Subscribe a handler to an event. Returns an unsubscribe function.
   * @param {string} event
   * @param {Handler} handler
   */
  on(event, handler) {
    if (typeof handler !== "function") {
      throw new TypeError(`handler for "${event}" must be a function`);
    }
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(handler);
    return () => this.off(event, handler);
  }

  /**
   * Remove a previously-registered handler. Safe to call for an unknown event.
   * @param {string} event
   * @param {Handler} handler
   */
  off(event, handler) {
    const handlers = this.listeners[event];
    if (!handlers) return;
    this.listeners[event] = handlers.filter((fn) => fn !== handler);
  }

  /**
   * Emit an event to every subscribed handler, in subscription order, and
   * return how many handlers ran. Emitting an event with zero subscribers must
   * be a safe no-op (return 0) — not a crash.
   * @param {string} event
   * @param {unknown} payload
   * @returns {number} number of handlers invoked
   */
  emit(event, payload) {
    const handlers = this.listeners[event];
    // Fan out to each subscriber. An event with no subscribers leaves
    // `handlers` undefined, so this must be guarded before iterating.
    handlers?.forEach((handler) => handler(payload));
    return handlers?.length ?? 0;
  }

  /** Number of handlers currently registered for an event. */
  count(event) {
    return this.listeners[event] ? this.listeners[event].length : 0;
  }
}

// ── Demo / self-check ─────────────────────────────────────────────────────────
function main() {
  const bus = new EventBus();
  const seen = [];
  bus.on("order.created", (o) => seen.push(o));

  const ranForCreated = bus.emit("order.created", { id: 1 });
  console.log("handlers run for order.created:", ranForCreated);

  // No one subscribed to "order.cancelled" — this must be a safe no-op (0),
  // NOT a crash. This is the line that throws while the bug is present.
  const ranForCancelled = bus.emit("order.cancelled", { id: 1 });
  console.log("handlers run for order.cancelled:", ranForCancelled);

  if (ranForCreated !== 1) {
    throw new Error(`expected 1 handler for order.created, got ${ranForCreated}`);
  }
  if (ranForCancelled !== 0) {
    throw new Error(`expected 0 handlers for order.cancelled, got ${ranForCancelled}`);
  }
  console.log("OK: emitting an event with no subscribers is a safe no-op.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

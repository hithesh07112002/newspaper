type RealtimeEventType =
  | "user.created"
  | "customer.created"
  | "customer.updated"
  | "collection.created"
  | "collection.updated"
  | "delivery.created"
  | "delivery.updated"
  | "salary.updated";

export type RealtimeEvent = {
  type: RealtimeEventType;
  entityId?: string;
  monthYear?: string;
  timestamp: string;
};

type Subscriber = (event: RealtimeEvent) => void;

const subscribers = new Set<Subscriber>();

export function publishEvent(event: Omit<RealtimeEvent, "timestamp">) {
  const nextEvent: RealtimeEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  for (const subscriber of subscribers) {
    subscriber(nextEvent);
  }
}

export function subscribeEvents(subscriber: Subscriber) {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

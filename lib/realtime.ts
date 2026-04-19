type RealtimeEventType =
  | "user.created"
  | "user.deleted"
  | "customer.created"
  | "customer.updated"
  | "customer.deleted"
  | "collection.created"
  | "collection.updated"
  | "collection.deleted"
  | "delivery.created"
  | "delivery.updated"
  | "delivery.deleted"
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

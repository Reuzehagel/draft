import { listen, type EventCallback, type UnlistenFn } from "@tauri-apps/api/event";

export function createListenerGroup() {
  const promises: Promise<UnlistenFn>[] = [];
  let cleaned = false;

  return {
    add<T>(event: string, handler: EventCallback<T>) {
      const promise = listen<T>(event, (e) => {
        if (!cleaned) handler(e);
      });
      promises.push(promise);
    },
    cleanup() {
      cleaned = true;
      promises.forEach((p) => p.then((fn) => fn()));
    },
  };
}

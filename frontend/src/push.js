import { api } from "./api/client.js";

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true
  );
}

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registration() {
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) return reg;
  return navigator.serviceWorker.ready;
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function enablePush() {
  if (!pushSupported()) {
    throw new Error(
      isIOS() && !isStandalone()
        ? "Na iPhonie dodaj Cyklię do ekranu głównego (Udostępnij → Dodaj do ekranu głównego) i otwórz ją z ikony."
        : "Ta przeglądarka nie obsługuje powiadomień push."
    );
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    throw new Error("Nie zezwolono na powiadomienia. Zmień to w ustawieniach przeglądarki/telefonu.");
  }
  const { key } = await api("/push/public-key");
  if (!key) throw new Error("Serwer nie ma skonfigurowanych powiadomień (brak pywebpush).");
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
  }
  await api("/push/subscribe", { method: "POST", body: { subscription: sub.toJSON() } });
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  try {
    await api("/push/unsubscribe", { method: "POST", body: { endpoint: sub.endpoint } });
  } finally {
    await sub.unsubscribe().catch(() => {});
  }
}

/** Po zalogowaniu odświeża subskrypcję na serwerze (np. po zmianie konta). */
export async function syncPush() {
  try {
    if (!pushSupported() || Notification.permission !== "granted") return;
    const sub = await currentSubscription();
    if (sub) await api("/push/subscribe", { method: "POST", body: { subscription: sub.toJSON() } });
  } catch {
    /* ignore */
  }
}

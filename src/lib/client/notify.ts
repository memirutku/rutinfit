"use client";

/**
 * F83: Sistem bildirimi. Masaüstü uygulamasında Tauri bildirim eklentisi, tarayıcıda Web
 * Notification API kullanılır. İzin yoksa false döner; çağıran uygulama içi uyarı gösterir.
 */
export type NotificationPermissionState = "granted" | "denied" | "default" | "unsupported";

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const hasWebNotification = () => typeof window !== "undefined" && "Notification" in window;

export async function notificationPermission(): Promise<NotificationPermissionState> {
  if (isTauri()) {
    const { isPermissionGranted } = await import("@tauri-apps/plugin-notification");
    return (await isPermissionGranted()) ? "granted" : "default";
  }
  if (!hasWebNotification()) return "unsupported";
  return window.Notification.permission as NotificationPermissionState;
}

/** Kullanıcı bir düğmeye bastığında çağrılmalı (tarayıcılar aksi hâlde izni sormaz). */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (isTauri()) {
    const { requestPermission } = await import("@tauri-apps/plugin-notification");
    return (await requestPermission()) as NotificationPermissionState;
  }
  if (!hasWebNotification()) return "unsupported";
  return (await window.Notification.requestPermission()) as NotificationPermissionState;
}

export async function sendSystemNotification(title: string, body: string): Promise<boolean> {
  try {
    if (isTauri()) {
      const { isPermissionGranted, sendNotification } = await import("@tauri-apps/plugin-notification");
      if (!(await isPermissionGranted())) return false;
      sendNotification({ title, body });
      return true;
    }
    if (!hasWebNotification() || window.Notification.permission !== "granted") return false;
    new window.Notification(title, { body });
    return true;
  } catch {
    return false;
  }
}

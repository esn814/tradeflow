// Push Notification Service — manages Web Push subscription lifecycle
// (API calls are made directly — no apiClient dependency needed)

let swRegistration = null;
let pushSubscription = null;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Convert URL-safe base64 VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Check if push notifications are supported in this browser
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Get current notification permission state
export function getPermissionState() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

// Register the service worker (called once on app init)
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;

  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    

    // Wait for the SW to be ready
    await navigator.serviceWorker.ready;
    return swRegistration;
  } catch (err) {
    console.warn('[push] Service worker registration failed:', err.message);
    return null;
  }
}

// Subscribe to push notifications
export async function enablePushNotifications() {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser');
  }

  // Ensure service worker is registered
  if (!swRegistration) {
    swRegistration = await registerServiceWorker();
  }
  if (!swRegistration) {
    throw new Error('Failed to register service worker');
  }

  // Request notification permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was denied');
  }

  // Fetch VAPID public key from server
  let vapidPublicKey;
  try {
    const res = await fetch(`${API_BASE}/push/vapid-public-key`);
    const data = await res.json();
    vapidPublicKey = data.publicKey;
  } catch {
    throw new Error('Failed to fetch VAPID key from server');
  }

  if (!vapidPublicKey) {
    throw new Error('VAPID public key not available');
  }

  // Subscribe to push via PushManager
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
  pushSubscription = await swRegistration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });

  // Send subscription to server
  const subJson = pushSubscription.toJSON();
  // FIX #1: Use in-memory token from apiClient (not localStorage)
  const { getAuthToken } = await import('./apiClient.js');
  const token = getAuthToken();

  const res = await fetch(`${API_BASE}/push/subscribe`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      endpoint: subJson.endpoint,
      keys: subJson.keys,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to save subscription on server');
  }

  
  return true;
}

// Unsubscribe from push notifications
export async function disablePushNotifications() {
  if (!swRegistration) {
    swRegistration = await navigator.serviceWorker.getRegistration('/');
  }
  if (!swRegistration) return true;

  const subscription = await swRegistration.pushManager.getSubscription();
  if (!subscription) return true;

  // Unsubscribe from browser
  await subscription.unsubscribe();

  // Remove from server
  const { getAuthToken } = await import('./apiClient.js');
  const token = getAuthToken();
  try {
    await fetch(`${API_BASE}/push/unsubscribe`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } catch (err) {
    console.warn('[push] Failed to remove subscription from server:', err.message);
  }

  pushSubscription = null;
  
  return true;
}

// Check if currently subscribed
export async function isSubscribed() {
  if (!isPushSupported()) return false;

  try {
    if (!swRegistration) {
      swRegistration = await navigator.serviceWorker.getRegistration('/');
    }
    if (!swRegistration) return false;

    const subscription = await swRegistration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

// Get the current subscription object (for debugging)
export async function getCurrentSubscription() {
  if (!swRegistration) {
    swRegistration = await navigator.serviceWorker.getRegistration('/');
  }
  if (!swRegistration) return null;
  return swRegistration.pushManager.getSubscription();
}

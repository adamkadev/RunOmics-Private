import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging'
import { collection, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getClientApp, getClientFirestore } from '@/lib/firebase'
import type { PushCategories } from '@/lib/pushCategories'
import { forgetRegistration, isRegistrationDue, rememberRegistration, savedRegistration } from '@/lib/pushPrefs'

const PUSH_TOKENS_COLLECTION = 'pushTokens'

function getMessagingInstance() {
  return getMessaging(getClientApp())
}

function deviceToken(registration: ServiceWorkerRegistration): Promise<string> {
  return getToken(getMessagingInstance(), {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  })
}

const tokenDocument = (token: string) => doc(collection(getClientFirestore(), PUSH_TOKENS_COLLECTION), token)

/** The server reads `categories` to pick which of this device's pushes to send. */
async function saveDevice(token: string, categories: PushCategories): Promise<void> {
  await setDoc(tokenDocument(token), {
    token,
    userAgent: navigator.userAgent,
    updatedAt: serverTimestamp(),
    categories,
  })
  rememberRegistration(token, Date.now())
}

/** Expects the permission already granted: the caller asks for it inside the tap. */
export async function enablePushNotifications(categories: PushCategories): Promise<string> {
  if (!(await isSupported())) throw new Error('unsupported')
  if (Notification.permission !== 'granted') throw new Error('permission-denied')

  // Registering a script URL of its own would replace the build's worker, and its caches with it.
  const token = await deviceToken(await navigator.serviceWorker.ready)
  await saveDevice(token, categories)
  return token
}

export async function savePushCategories(categories: PushCategories): Promise<void> {
  await saveDevice(await deviceToken(await navigator.serviceWorker.ready), categories)
}

/** FCM can rotate the token behind the switches, and the server would push to the dead one until FCM refused it. */
export async function refreshPushRegistration(categories: PushCategories, now = Date.now()): Promise<void> {
  if (!(await isSupported())) throw new Error('unsupported')
  const token = await deviceToken(await navigator.serviceWorker.ready)
  const saved = savedRegistration()
  if (!isRegistrationDue(saved, token, now)) return

  await saveDevice(token, categories)
  if (saved && saved.token !== token) await deleteDoc(tokenDocument(saved.token)).catch(() => {})
}

export async function disablePushNotifications(): Promise<void> {
  const messaging = getMessagingInstance()
  const token = await deviceToken(await navigator.serviceWorker.ready)

  await deleteToken(messaging)
  await deleteDoc(tokenDocument(token))
  forgetRegistration()
}

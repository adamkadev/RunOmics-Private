import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging'
import { collection, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getClientApp, getClientFirestore } from '@/lib/firebase'
import type { PushCategories } from '@/lib/pushCategories'

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

/** The server reads `categories` to pick which of this device's pushes to send. */
async function saveDevice(token: string, categories: PushCategories): Promise<void> {
  await setDoc(doc(collection(getClientFirestore(), PUSH_TOKENS_COLLECTION), token), {
    token,
    userAgent: navigator.userAgent,
    updatedAt: serverTimestamp(),
    categories,
  })
}

/** Expects the permission already granted: the caller asks for it inside the tap. */
export async function enablePushNotifications(categories: PushCategories): Promise<string> {
  if (!(await isSupported())) throw new Error('unsupported')
  const registration = await navigator.serviceWorker.register('/sw.js')
  if (Notification.permission !== 'granted') throw new Error('permission-denied')

  const token = await deviceToken(registration)
  await saveDevice(token, categories)
  return token
}

export async function savePushCategories(categories: PushCategories): Promise<void> {
  await saveDevice(await deviceToken(await navigator.serviceWorker.ready), categories)
}

export async function disablePushNotifications(): Promise<void> {
  const messaging = getMessagingInstance()
  const token = await deviceToken(await navigator.serviceWorker.ready)

  await deleteToken(messaging)
  await deleteDoc(doc(collection(getClientFirestore(), PUSH_TOKENS_COLLECTION), token))
}

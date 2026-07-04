import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging'
import { collection, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getClientApp, getClientFirestore } from '@/lib/firebase'

const PUSH_TOKENS_COLLECTION = 'pushTokens'

function getMessagingInstance() {
  return getMessaging(getClientApp())
}

export async function isPushSupported(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false
  return isSupported()
}

export async function enablePushNotifications(): Promise<string> {
  // The app service worker (public/sw.js) handles push display itself, so FCM
  // binds to it - the previously referenced firebase-messaging-sw.js never
  // existed in public/ and this registration 404'd.
  const registration = await navigator.serviceWorker.register('/sw.js')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('permission-denied')

  const token = await getToken(getMessagingInstance(), {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  })

  await setDoc(doc(collection(getClientFirestore(), PUSH_TOKENS_COLLECTION), token), {
    token,
    userAgent: navigator.userAgent,
    updatedAt: serverTimestamp(),
  })

  return token
}

export async function disablePushNotifications(): Promise<void> {
  const messaging = getMessagingInstance()
  const registration = await navigator.serviceWorker.ready
  const token = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  })

  await deleteToken(messaging)
  await deleteDoc(doc(collection(getClientFirestore(), PUSH_TOKENS_COLLECTION), token))
}

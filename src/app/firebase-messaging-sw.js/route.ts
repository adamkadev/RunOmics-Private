export const dynamic = 'force-static'

const FIREBASE_SDK_VERSION = '12.15.0'

export function GET() {
  const script = `
importScripts('https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: '${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}',
  authDomain: '${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}',
  projectId: '${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}',
  appId: '${process.env.NEXT_PUBLIC_FIREBASE_APP_ID}',
  messagingSenderId: '${process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {}
  self.registration.showNotification(title || 'RunOmics', {
    body,
    icon: '/icons/apple-touch-icon.png',
  })
})
`

  return new Response(script, {
    headers: {
      'Content-Type': 'application/javascript',
      'Service-Worker-Allowed': '/',
    },
  })
}

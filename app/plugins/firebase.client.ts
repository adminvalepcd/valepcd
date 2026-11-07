import { defineNuxtPlugin, useRuntimeConfig } from '#app'
import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore
} from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAuth } from 'firebase/auth'
import { isFirebaseMockEnabled } from '~/services/firebaseMockService'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  if (isFirebaseMockEnabled() && String(config.public.useFirebaseMock || '').toLowerCase() !== 'false') {
    if (typeof window !== 'undefined') {
      console.info('[Multei Mock] Ambiente local detectado: usando mocks de Belo Horizonte (0 chamadas reais ao Firebase).')
    }
    return {
      provide: {
        db: null,
        storage: null,
        auth: null
      }
    }
  }

  const firebaseConfig = {
    apiKey: config.public.firebaseApiKey,
    authDomain: config.public.firebaseAuthDomain,
    projectId: config.public.firebaseProjectId,
    storageBucket: config.public.firebaseStorageBucket,
    messagingSenderId: config.public.firebaseMessagingSenderId,
    appId: config.public.firebaseAppId
  }

  const isExistingApp = getApps().length > 0
  const app = isExistingApp ? getApp() : initializeApp(firebaseConfig)

  let db: Firestore
  if (!isExistingApp) {
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      })
    } catch {
      db = getFirestore(app)
    }
  } else {
    db = getFirestore(app)
  }

  const storage = getStorage(app)
  const auth = getAuth(app)

  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw-image-cache.js').catch(() => {})
    })
  }

  return {
    provide: {
      db,
      storage,
      auth
    }
  }
})

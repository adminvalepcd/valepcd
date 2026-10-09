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

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

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

  return {
    provide: {
      db,
      storage
    }
  }
})

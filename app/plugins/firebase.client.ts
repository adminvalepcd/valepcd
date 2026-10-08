import { defineNuxtPlugin, useRuntimeConfig } from '#app'
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
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

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
  const db = getFirestore(app)
  const storage = getStorage(app)

  return {
    provide: {
      db,
      storage
    }
  }
})

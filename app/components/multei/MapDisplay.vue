<template>
  <div class="map-display-wrapper" :style="{ height: props.height, minHeight: props.height }">
    <!-- Estado de carregamento -->
    <div v-if="!isReady && !mapError" class="map-loading-overlay">
      <LoadingSpinner />
      <p class="map-loading-text">Carregando mapa...</p>
    </div>

    <!-- Estado de erro -->
    <div v-else-if="mapError" class="map-error-overlay">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"
        class="map-error-icon">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <h3 class="map-error-title">Erro no Mapa</h3>
      <p class="map-error-desc">{{ mapError }}</p>
      <p class="map-error-sub">Verifique se a chave de API possui a Maps JavaScript API ativada.</p>
    </div>

    <!-- Elemento do Canvas do Google Maps -->
    <div ref="mapContainer" class="map-canvas-element" :style="{ height: props.height, minHeight: props.height }" />

    <!-- Pino centralizado de alta visibilidade para marcação e ajuste de local -->
    <div v-if="pinLocation" class="map-center-pin" title="Local selecionado no mapa">
      <div class="pin-marker">
        <svg viewBox="0 0 32 44" width="36" height="48" class="pin-svg">
          <defs>
            <filter id="pin-drop-shadow" x="-25%" y="-20%" width="150%" height="150%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="0.45" />
            </filter>
          </defs>
          <!-- Corpo do pino em vermelho vibrante -->
          <path
            d="M16 0C7.16 0 0 7.16 0 16c0 11.8 16 28 16 28s16-16.2 16-28c0-8.84-7.16-16-16-16z"
            fill="#dc2626"
            stroke="#ffffff"
            stroke-width="2"
            filter="url(#pin-drop-shadow)"
          />
          <!-- Círculo interno branco com alvo central -->
          <circle cx="16" cy="15" r="5.5" fill="#ffffff" />
          <circle cx="16" cy="15" r="2.5" fill="#dc2626" />
        </svg>
      </div>
      <div class="pin-ground-shadow"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import LoadingSpinner from './LoadingSpinner.vue';

const props = defineProps({
  incidents: {
    type: Array,
    default: () => []
  },
  initialCenter: {
    type: Object,
    default: () => ({ latitude: -23.55052, longitude: -46.633308 })
  },
  isMapApiLoaded: {
    type: Boolean,
    default: false
  },
  pinLocation: {
    type: Object,
    default: null
  },
  height: {
    type: String,
    default: '600px'
  }
});

const emit = defineEmits(['markerClick', 'pinLocationChange']);

const config = useRuntimeConfig();
const mapsApiKey = config.public.googleMapsApiKey || 'AIzaSyBE9MtDA7cziFHANDknpjvgP5jkAvXyguU';

const mapContainer = ref(null);
const map = ref(null);
const clusterer = ref(null);
const mapError = ref(null);
const isApiLoaded = ref(false);
let listenerRef = null;
let clickListenerRef = null;
let isInitialPanDone = false;

const isReady = computed(() => {
  return (props.isMapApiLoaded || isApiLoaded.value) && !!map.value;
});

const loadGoogleMapsScript = () => {
  if (typeof window === 'undefined') return Promise.resolve();

  if (window.google?.maps) {
    isApiLoaded.value = true;
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.getElementById('google-maps-script');
    if (existing) {
      if (window.google?.maps) {
        isApiLoaded.value = true;
        resolve();
      } else {
        existing.addEventListener('load', () => {
          isApiLoaded.value = true;
          resolve();
        });
        existing.addEventListener('error', (err) => reject(err));
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${mapsApiKey}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      isApiLoaded.value = true;
      resolve();
    };
    script.onerror = (err) => {
      mapError.value = 'Não foi possível carregar o Google Maps. Verifique sua conexão e a chave de API.';
      reject(err);
    };
    document.head.appendChild(script);
  });
};

const setupPinListeners = () => {
  if (listenerRef) {
    listenerRef.remove();
    listenerRef = null;
  }
  if (clickListenerRef) {
    clickListenerRef.remove();
    clickListenerRef = null;
  }

  if (map.value && props.pinLocation) {
    listenerRef = map.value.addListener('idle', () => {
      const currentCenter = map.value?.getCenter();
      if (currentCenter) {
        emit('pinLocationChange', { latitude: currentCenter.lat(), longitude: currentCenter.lng() });
      }
    });

    clickListenerRef = map.value.addListener('click', (e) => {
      if (e.latLng && map.value) {
        map.value.panTo(e.latLng);
        emit('pinLocationChange', { latitude: e.latLng.lat(), longitude: e.latLng.lng() });
      }
    });
  }
};

const initMap = () => {
  if (!mapContainer.value || map.value || !window.google?.maps) {
    return;
  }

  try {
    const googleMaps = window.google.maps;
    const center = {
      lat: props.pinLocation?.latitude ?? props.initialCenter?.latitude ?? -23.55052,
      lng: props.pinLocation?.longitude ?? props.initialCenter?.longitude ?? -46.633308
    };

    map.value = new googleMaps.Map(mapContainer.value, {
      center,
      zoom: props.pinLocation ? 17 : 14,
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      gestureHandling: 'greedy'
    });

    if (window.markerClusterer?.MarkerClusterer && !props.pinLocation) {
      clusterer.value = new window.markerClusterer.MarkerClusterer({
        map: map.value,
        markers: []
      });
    }

    setupPinListeners();

    mapError.value = null;
    updateMarkers();

    setTimeout(() => {
      if (map.value && window.google?.maps) {
        window.google.maps.event.trigger(map.value, 'resize');
        const target = props.pinLocation || props.initialCenter;
        if (target) {
          map.value.setCenter({ lat: target.latitude, lng: target.longitude });
        }
      }
    }, 150);

    setTimeout(() => {
      if (map.value && window.google?.maps) {
        window.google.maps.event.trigger(map.value, 'resize');
      }
    }, 400);
  } catch (error) {
    console.error("Failed to initialize Google Map:", error);
    mapError.value = `Failed to load map: ${error instanceof Error ? error.message : 'Unknown error.'}`;
  }
};

const updateMarkers = () => {
  if (!map.value || !window.google?.maps) return;
  const googleMaps = window.google.maps;

  if (clusterer.value) {
    clusterer.value.clearMarkers();
  }

  const incidents = props.incidents || [];
  const newMarkers = incidents.map((incident) => {
    const marker = new googleMaps.Marker({
      position: { lat: incident.latitude, lng: incident.longitude },
      title: `Infração registrada em ${new Date(incident.timestamp).toLocaleTimeString()}`,
      map: clusterer.value ? null : map.value
    });

    marker.addListener('click', () => {
      emit('markerClick', incident);
    });

    return marker;
  });

  if (clusterer.value) {
    clusterer.value.addMarkers(newMarkers);
  }
};

// Observar pinLocation para modo de marcação
watch(() => props.pinLocation, (newPin) => {
  if (!map.value) return;

  setupPinListeners();

  if (newPin) {
    if (!isInitialPanDone) {
      map.value.panTo({ lat: newPin.latitude, lng: newPin.longitude });
      if ((map.value.getZoom() || 0) < 16) {
        map.value.setZoom(16);
      }
      isInitialPanDone = true;
    }
  } else {
    isInitialPanDone = false;
  }
}, { deep: true, immediate: true });

watch(() => props.isMapApiLoaded, (loaded) => {
  if (loaded) {
    isApiLoaded.value = true;
    initMap();
  }
});

watch(() => props.initialCenter, (newCenter) => {
  if (map.value && newCenter && !props.pinLocation) {
    map.value.panTo({ lat: newCenter.latitude, lng: newCenter.longitude });
  }
}, { deep: true });

watch(() => props.incidents, () => {
  updateMarkers();
}, { deep: true });

onMounted(async () => {
  const handleAuthFailure = () => {
    mapError.value = "Google Maps authentication failed. Please verify API key permissions and billing in Google Cloud Console.";
  };
  window.addEventListener('gmp-auth-failure', handleAuthFailure);

  try {
    await loadGoogleMapsScript();
    initMap();
  } catch (e) {
    console.error("Falha ao inicializar mapa no onMounted:", e);
  }
});

onBeforeUnmount(() => {
  if (listenerRef) {
    listenerRef.remove();
  }
  if (clickListenerRef) {
    clickListenerRef.remove();
  }
});
</script>

<style scoped>
.map-display-wrapper {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  background: #f1f5f9;
}

.map-loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  z-index: 50;
}

.map-loading-text {
  margin-top: 1rem;
  font-size: 0.95rem;
  color: #475569;
  font-weight: 500;
}

.map-error-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fef2f2;
  padding: 1.5rem;
  text-align: center;
  z-index: 50;
}

.map-error-icon {
  width: 48px;
  height: 48px;
  color: #dc2626;
  margin-bottom: 0.75rem;
}

.map-error-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #991b1b;
  margin-bottom: 0.5rem;
}

.map-error-desc {
  font-size: 0.88rem;
  color: #475569;
  max-width: 380px;
  line-height: 1.5;
}

.map-error-sub {
  font-size: 0.78rem;
  color: #94a3b8;
  margin-top: 0.5rem;
}

.map-canvas-element {
  width: 100%;
  height: 100%;
}

/* Pino Vermelho Centralizado */
.map-center-pin {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -100%);
  pointer-events: none;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}

.pin-marker {
  transform-origin: bottom center;
  animation: pinDrop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  display: flex;
  align-items: center;
  justify-content: center;
}

.pin-svg {
  display: block;
}

.pin-ground-shadow {
  width: 14px;
  height: 5px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 50%;
  margin-top: -3px;
  filter: blur(1.5px);
}

@keyframes pinDrop {
  0% {
    transform: translateY(-24px) scale(0.85);
    opacity: 0;
  }
  70% {
    transform: translateY(2px) scale(1.05);
    opacity: 1;
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}
</style>

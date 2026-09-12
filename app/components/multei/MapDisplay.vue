<template>
  <div class="relative w-full overflow-hidden rounded-2xl border border-slate-200 shadow-md" :style="{ height: props.height, minHeight: props.height }">
    <div v-if="!isReady && !mapError" class="w-full h-full flex flex-col items-center justify-center bg-slate-100 p-4">
      <LoadingSpinner />
      <p class="text-slate-600 mt-4">Carregando mapa...</p>
    </div>

    <div v-else-if="mapError" class="w-full h-full flex flex-col items-center justify-center bg-slate-100 p-4 rounded-lg">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"
        class="w-16 h-16 text-red-500 mb-4">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <h3 class="text-xl font-semibold text-red-700 mb-2">Erro no Mapa</h3>
      <p class="text-slate-600 text-center">{{ mapError }}</p>
      <p class="text-slate-500 text-xs mt-2 text-center">Verifique se a chave de API possui a Maps JavaScript API ativada.</p>
    </div>

    <div ref="mapContainer" class="w-full h-full" :style="{ height: props.height, minHeight: props.height }" />

    <div v-if="pinLocation" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-10">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"
        class="w-10 h-10 text-red-700 drop-shadow-lg fill-red-600">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
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
const mapsApiKey = config.public.googleMapsApiKey;

const mapContainer = ref(null);
const map = ref(null);
const clusterer = ref(null);
const mapError = ref(null);
const isApiLoaded = ref(false);
let listenerRef = null;
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

    if (props.pinLocation) {
      if (listenerRef) {
        listenerRef.remove();
      }
      listenerRef = map.value.addListener('idle', () => {
        const currentCenter = map.value?.getCenter();
        if (currentCenter) {
          emit('pinLocationChange', { latitude: currentCenter.lat(), longitude: currentCenter.lng() });
        }
      });
    }

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

  if (listenerRef) {
    listenerRef.remove();
    listenerRef = null;
  }

  if (newPin) {
    if (!isInitialPanDone) {
      map.value.panTo({ lat: newPin.latitude, lng: newPin.longitude });
      if ((map.value.getZoom() || 0) < 16) {
        map.value.setZoom(16);
      }
      isInitialPanDone = true;
    }

    listenerRef = map.value.addListener('idle', () => {
      const center = map.value?.getCenter();
      if (center) {
        emit('pinLocationChange', { latitude: center.lat(), longitude: center.lng() });
      }
    });
  } else {
    isInitialPanDone = false;
  }
}, { immediate: true });

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
});
</script>

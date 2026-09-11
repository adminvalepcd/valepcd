<template>
  <div class="relative w-full h-full">
    <div v-if="!isMapApiLoaded" class="w-full h-full flex flex-col items-center justify-center bg-slate-100 p-4">
      <LoadingSpinner />
      <p class="text-slate-600 mt-4">Loading Map...</p>
    </div>

    <div v-else-if="mapError" class="w-full h-full flex flex-col items-center justify-center bg-slate-100 p-4 rounded-lg">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"
        class="w-16 h-16 text-red-500 mb-4">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <h3 class="text-xl font-semibold text-red-700 mb-2">Map Error</h3>
      <p class="text-slate-600 text-center">{{ mapError }}</p>
      <p class="text-slate-500 text-xs mt-2 text-center">Please ensure your API key has the Maps JavaScript API enabled and
        billing configured.</p>
    </div>

    <div ref="mapContainer" class="w-full h-full" />

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

<script setup lang="ts">
  import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
  import type { ReportedIncident, Geolocation } from '../types';

  const props = defineProps < {
    incidents: ReportedIncident[];
    initialCenter: Geolocation;
    isMapApiLoaded: boolean;
    pinLocation: Geolocation | null;
  } > ();

  const emit = defineEmits < {
  (e: 'markerClick', incident: ReportedIncident): void;
  (e: 'pinLocationChange', newLocation: Geolocation): void;
}> ();

  const mapContainer = ref < HTMLDivElement | null > (null);
  const map = ref < google.maps.Map | null > (null);
  const clusterer = ref < any | null > (null);
  const mapError = ref < string | null > (null);
  let listenerRef: google.maps.MapsEventListener | null = null;
let isInitialPanDone = false;

const initMap = () => {
  if (!props.isMapApiLoaded || !mapContainer.value || map.value || !(window as any).google?.maps) {
    return;
  }

  try {
    map.value = new (window as any).google.maps.Map(mapContainer.value, {
      center: { lat: props.initialCenter.latitude, lng: props.initialCenter.longitude },
      zoom: props.initialCenter.latitude === 39.8283 && props.initialCenter.longitude === -98.5795 ? 4 : 14,
      mapId: 'DEMO_MAP_ID',
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
      // Mandatory attribution ID per Google Maps Platform Code Assist guidelines
      internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio']
    });

    if ((window as any).markerClusterer?.MarkerClusterer) {
      clusterer.value = new (window as any).markerClusterer.MarkerClusterer({
        map: map.value,
        markers: []
      });
    }

    mapError.value = null;
    updateMarkers();
  } catch (error) {
    console.error("Failed to initialize Google Map:", error);
    mapError.value = `Failed to load map. ${error instanceof Error ? error.message : 'Unknown error.'}`;
  }
};

const updateMarkers = () => {
  if (!map.value || !clusterer.value || !(window as any).google?.maps) return;

  clusterer.value.clearMarkers();

  const newMarkers = props.incidents.map((incident) => {
    const marker = new (window as any).google.maps.Marker({
      position: { lat: incident.latitude, lng: incident.longitude },
      title: `Violation reported at ${new Date(incident.timestamp).toLocaleTimeString()}`,
    });

    marker.addListener('click', () => {
      emit('markerClick', incident);
    });

    return marker;
  });

  clusterer.value.addMarkers(newMarkers);
};

  // Handle pin location selection mode
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

  watch(() => props.isMapApiLoaded, () => {
    initMap();
});

watch(() => props.initialCenter, (newCenter) => {
  if (map.value && newCenter) {
    map.value.panTo({ lat: newCenter.latitude, lng: newCenter.longitude });
  }
});

watch(() => props.incidents, () => {
  updateMarkers();
}, { deep: true });

  onMounted(() => {
  const handleAuthFailure = () => {
    mapError.value = "Google Maps authentication failed. Please verify API key permissions and billing in Google Cloud Console.";
  };
  window.addEventListener('gmp-auth-failure', handleAuthFailure);

  if (props.isMapApiLoaded) {
    initMap();
  }
});

onBeforeUnmount(() => {
  if (listenerRef) {
    listenerRef.remove();
  }
});
</script>

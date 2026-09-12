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
  initialZoom: {
    type: Number,
    default: 15
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
let zoomListenerRef = null;
let isInitialPanDone = false;
let activeMarkers = [];
let activeSpiderLines = [];
let activeSpiderDots = [];

const isReady = computed(() => {
  return (props.isMapApiLoaded || isApiLoaded.value) && !!map.value;
});

const loadClustererScript = () => {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.markerClusterer?.MarkerClusterer) return Promise.resolve();

  return new Promise((resolve) => {
    const existing = document.querySelector('script[src*="markerclusterer"]');
    if (existing) {
      if (window.markerClusterer?.MarkerClusterer) {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => resolve());
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@googlemaps/markerclusterer/dist/index.min.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
};

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

const clearSpiderGraphics = () => {
  activeSpiderLines.forEach(line => line.setMap(null));
  activeSpiderLines = [];
  activeSpiderDots.forEach(dot => dot.setMap(null));
  activeSpiderDots = [];
};

const updateSpiderGraphicsVisibility = () => {
  if (!map.value) return;
  const currentZoom = map.value.getZoom() || 15;
  const showSpider = currentZoom >= 15;
  activeSpiderLines.forEach(line => line.setMap(showSpider ? map.value : null));
  activeSpiderDots.forEach(dot => dot.setMap(showSpider ? map.value : null));
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
      zoom: props.pinLocation ? 17 : props.initialZoom,
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      gestureHandling: 'greedy'
    });

    if (window.markerClusterer?.MarkerClusterer && !props.pinLocation) {
      const clusterOptions = {
        map: map.value,
        markers: [],
        onClusterClick: (event, cluster, mapInstance) => {
          if (!cluster || !mapInstance) return;
          const currentZoom = mapInstance.getZoom() || 14;
          const clusterMarkers = cluster.markers || [];

          // Se já estamos em zoom de bairro (13+) ou se é um grupo de até 8 ocorrências,
          // aproxima direto para o nível de rua (zoom 16+) onde todos os pins se desdobram individualmente
          if (currentZoom >= 13 || clusterMarkers.length <= 8) {
            mapInstance.setCenter(cluster.position);
            mapInstance.setZoom(Math.max(currentZoom + 2, 16));
            return;
          }

          const bounds = cluster.bounds;
          if (bounds) {
            mapInstance.fitBounds(bounds);
            setTimeout(() => {
              if (mapInstance.getZoom() <= currentZoom) {
                mapInstance.setZoom(currentZoom + 2);
              }
            }, 150);
          } else {
            mapInstance.setCenter(cluster.position);
            mapInstance.setZoom(currentZoom + 2);
          }
        }
      };

      if (window.markerClusterer.SuperClusterAlgorithm) {
        clusterOptions.algorithm = new window.markerClusterer.SuperClusterAlgorithm({
          maxZoom: 14, // A partir do zoom 15 desativa totalmente agrupamentos para mostrar pins individuais
          radius: 35
        });
      }

      clusterer.value = new window.markerClusterer.MarkerClusterer(clusterOptions);
    }

    if (zoomListenerRef) {
      zoomListenerRef.remove();
      zoomListenerRef = null;
    }
    zoomListenerRef = map.value.addListener('zoom_changed', () => {
      updateSpiderGraphicsVisibility();
    });

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

/**
 * Desdobra marcadores (efeito spiderfy) que possuem coordenadas idênticas ou muito próximas (< 15 metros).
 * A partir do zoom 15, os marcadores se separam em círculo com linhas visuais conectando ao ponto original.
 */
const getCoordsWithSpiderOffset = (incidents) => {
  if (!incidents || incidents.length === 0) return { positions: [], multiGroups: [] };

  const groups = [];
  const processed = new Set();

  for (let i = 0; i < incidents.length; i++) {
    if (processed.has(i)) continue;
    const group = [i];
    processed.add(i);
    for (let j = i + 1; j < incidents.length; j++) {
      if (processed.has(j)) continue;
      const dLat = (incidents[j].latitude - incidents[i].latitude) * 111320;
      const dLng = (incidents[j].longitude - incidents[i].longitude) * (111320 * Math.cos(incidents[i].latitude * Math.PI / 180));
      const distMeters = Math.sqrt(dLat * dLat + dLng * dLng);
      // Qualquer ponto dentro de 15 metros é agrupado para desdobramento
      if (distMeters < 15) {
        group.push(j);
        processed.add(j);
      }
    }
    groups.push(group);
  }

  const positions = new Array(incidents.length);
  const multiGroups = [];

  for (const group of groups) {
    if (group.length === 1) {
      const idx = group[0];
      positions[idx] = {
        lat: incidents[idx].latitude,
        lng: incidents[idx].longitude,
        isDispersed: false
      };
    } else {
      let centerLat = 0;
      let centerLng = 0;
      for (const idx of group) {
        centerLat += incidents[idx].latitude;
        centerLng += incidents[idx].longitude;
      }
      centerLat /= group.length;
      centerLng /= group.length;

      const count = group.length;
      // Raio em metros: garante separação visual nítida (~40px) no zoom de rua sem afastar do local real
      const radiusMeters = Math.min(18 + count * 2.5, 36);

      multiGroups.push({
        center: { lat: centerLat, lng: centerLng },
        indices: group
      });

      for (let k = 0; k < count; k++) {
        const idx = group[k];
        // Distribuição simétrica em leque circular começando pelo topo (-PI/2)
        const angle = (2 * Math.PI * k) / count - (Math.PI / 2);
        const latOffset = (radiusMeters * Math.cos(angle)) / 111320;
        const lngOffset = (radiusMeters * Math.sin(angle)) / (111320 * Math.cos(centerLat * Math.PI / 180));
        positions[idx] = {
          lat: Number((centerLat + latOffset).toFixed(6)),
          lng: Number((centerLng + lngOffset).toFixed(6)),
          originLat: centerLat,
          originLng: centerLng,
          isDispersed: true
        };
      }
    }
  }

  return { positions, multiGroups };
};

const updateMarkers = () => {
  if (!map.value || !window.google?.maps) return;
  const googleMaps = window.google.maps;

  // Remove e desvincula todos os marcadores anteriores do mapa
  if (activeMarkers.length > 0) {
    activeMarkers.forEach((marker) => {
      marker.setMap(null);
      if (googleMaps.event) {
        googleMaps.event.clearInstanceListeners(marker);
      }
    });
    activeMarkers = [];
  }

  clearSpiderGraphics();

  if (clusterer.value) {
    clusterer.value.clearMarkers();
  }

  const incidents = props.incidents || [];
  const { positions, multiGroups } = getCoordsWithSpiderOffset(incidents);

  const currentZoom = map.value?.getZoom() || 15;
  const showSpider = currentZoom >= 15;

  // Desenha os pontos de ancoragem e linhas conectoras de desdobramento (spiderfy)
  multiGroups.forEach(group => {
    const anchorDot = new googleMaps.Circle({
      center: group.center,
      radius: 2,
      fillColor: '#6366f1',
      fillOpacity: 0.85,
      strokeColor: '#ffffff',
      strokeWeight: 2,
      map: showSpider ? map.value : null,
      zIndex: 10
    });
    activeSpiderDots.push(anchorDot);

    group.indices.forEach(idx => {
      const pos = positions[idx];
      if (pos) {
        const line = new googleMaps.Polyline({
          path: [
            group.center,
            { lat: pos.lat, lng: pos.lng }
          ],
          strokeColor: '#6366f1',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          map: showSpider ? map.value : null,
          zIndex: 9
        });
        activeSpiderLines.push(line);
      }
    });
  });

  const newMarkers = incidents.map((incident, index) => {
    const pos = positions[index] || { lat: incident.latitude, lng: incident.longitude };
    const marker = new googleMaps.Marker({
      position: { lat: pos.lat, lng: pos.lng },
      title: incident.description || (incident.cidade ? `${incident.cidade} - ${incident.estado}` : `Infração registrada em ${new Date(incident.timestamp).toLocaleTimeString()}`),
      map: clusterer.value ? null : map.value
    });

    marker.addListener('click', () => {
      emit('markerClick', incident);
    });

    return marker;
  });

  activeMarkers = newMarkers;

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
    if ((map.value.getZoom() || 0) < props.initialZoom) {
      map.value.setZoom(props.initialZoom);
    }
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
    await Promise.all([loadGoogleMapsScript(), loadClustererScript()]);
    initMap();
  } catch (e) {
    console.error("Falha ao inicializar mapa no onMounted:", e);
  }
});

onBeforeUnmount(() => {
  if (activeMarkers.length > 0) {
    activeMarkers.forEach((marker) => {
      marker.setMap(null);
    });
    activeMarkers = [];
  }
  clearSpiderGraphics();
  if (listenerRef) {
    listenerRef.remove();
    listenerRef = null;
  }
  if (clickListenerRef) {
    clickListenerRef.remove();
    clickListenerRef = null;
  }
  if (zoomListenerRef) {
    zoomListenerRef.remove();
    zoomListenerRef = null;
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

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
import { requestUserLocation } from '~/services/geoService';

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

const emit = defineEmits(['markerClick', 'pinLocationChange', 'boundsChange', 'userLocationFound']);

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
let boundsListenerRef = null;
let isInitialPanDone = false;
let activeMarkers = [];
let activeSpiderLines = [];
let activeSpiderDots = [];
let userLocationMarker = null;
let userLocationHalo = null;

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

const emitVisibleBounds = () => {
  if (!map.value) return;
  const bounds = map.value.getBounds();
  const center = map.value.getCenter();
  if (!bounds) return;
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  if (ne && sw) {
    emit('boundsChange', {
      north: ne.lat(),
      south: sw.lat(),
      east: ne.lng(),
      west: sw.lng(),
      center: center ? { latitude: center.lat(), longitude: center.lng() } : null
    });
  }
};

const updateSpiderGraphicsVisibility = () => {
  if (!map.value) return;
  const currentZoom = map.value.getZoom() || 15;
  const showSpider = currentZoom >= 15;
  activeSpiderLines.forEach(line => line.setMap(showSpider ? map.value : null));
  activeSpiderDots.forEach(dot => dot.setMap(showSpider ? map.value : null));
};

const updateUserLocationDot = (lat, lng) => {
  if (!map.value || !window.google?.maps) return;
  const googleMaps = window.google.maps;
  const pos = { lat, lng };

  if (!userLocationHalo) {
    userLocationHalo = new googleMaps.Circle({
      strokeColor: '#4285F4',
      strokeOpacity: 0.35,
      strokeWeight: 1,
      fillColor: '#4285F4',
      fillOpacity: 0.15,
      map: map.value,
      center: pos,
      radius: 35,
      clickable: false,
      zIndex: 998
    });
  } else {
    userLocationHalo.setCenter(pos);
    userLocationHalo.setMap(map.value);
  }

  if (!userLocationMarker) {
    userLocationMarker = new googleMaps.Marker({
      position: pos,
      map: map.value,
      title: 'Sua localização atual',
      clickable: false,
      zIndex: 999,
      icon: {
        path: googleMaps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: '#4285F4',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2.5
      }
    });
  } else {
    userLocationMarker.setPosition(pos);
    userLocationMarker.setMap(map.value);
  }
};

const createMyLocationControl = (mapInstance, googleMaps) => {
  const controlDiv = document.createElement('div');
  controlDiv.style.margin = '10px';

  const controlButton = document.createElement('button');
  controlButton.type = 'button';
  controlButton.title = 'Centralizar na minha localização';
  controlButton.setAttribute('aria-label', 'Centralizar na minha localização');
  controlButton.style.backgroundColor = '#ffffff';
  controlButton.style.border = 'none';
  controlButton.style.borderRadius = '2px';
  controlButton.style.boxShadow = 'rgba(0, 0, 0, 0.3) 0px 1px 4px -1px';
  controlButton.style.cursor = 'pointer';
  controlButton.style.width = '40px';
  controlButton.style.height = '40px';
  controlButton.style.padding = '0';
  controlButton.style.display = 'flex';
  controlButton.style.alignItems = 'center';
  controlButton.style.justifyContent = 'center';
  controlButton.style.transition = 'background-color 0.15s ease';

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.style.fill = '#666666';
  svg.style.transition = 'fill 0.2s ease, transform 0.3s ease';

  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute(
    'd',
    'M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z'
  );
  svg.appendChild(path);
  controlButton.appendChild(svg);
  controlDiv.appendChild(controlButton);

  controlButton.addEventListener('mouseenter', () => {
    controlButton.style.backgroundColor = '#f8fafc';
    if (svg.style.fill !== 'rgb(26, 115, 232)' && svg.style.fill !== '#1a73e8') {
      svg.style.fill = '#333333';
    }
  });
  controlButton.addEventListener('mouseleave', () => {
    controlButton.style.backgroundColor = '#ffffff';
    if (svg.style.fill !== 'rgb(26, 115, 232)' && svg.style.fill !== '#1a73e8') {
      svg.style.fill = '#666666';
    }
  });

  controlButton.addEventListener('click', async () => {
    svg.style.fill = '#1a73e8';
    svg.style.transform = 'rotate(45deg)';
    try {
      const coords = await requestUserLocation();
      svg.style.transform = 'rotate(0deg)';
      svg.style.fill = '#1a73e8';

      updateUserLocationDot(coords.latitude, coords.longitude);

      mapInstance.panTo({ lat: coords.latitude, lng: coords.longitude });
      if ((mapInstance.getZoom() || 0) < 16) {
        mapInstance.setZoom(16);
      }

      if (props.pinLocation) {
        emit('pinLocationChange', { latitude: coords.latitude, longitude: coords.longitude });
      }
      emit('userLocationFound', { latitude: coords.latitude, longitude: coords.longitude });
    } catch (err) {
      svg.style.transform = 'rotate(0deg)';
      svg.style.fill = '#dc2626';
      console.warn('[MapDisplay] Não foi possível obter GPS pelo botão Minha Localização:', err);
    }
  });

  mapInstance.controls[googleMaps.ControlPosition.RIGHT_BOTTOM].push(controlDiv);
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

    createMyLocationControl(map.value, googleMaps);

    const isDefaultSP = Math.abs(center.lat - (-23.55052)) < 0.0001 && Math.abs(center.lng - (-46.633308)) < 0.0001;
    if (!isDefaultSP && !props.pinLocation) {
      updateUserLocationDot(center.lat, center.lng);
    }

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
      emitVisibleBounds();
    });

    if (boundsListenerRef) {
      boundsListenerRef.remove();
      boundsListenerRef = null;
    }
    boundsListenerRef = map.value.addListener('idle', () => {
      emitVisibleBounds();
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

  // Pino personalizado com a identidade do Vale PCD (Púrpura + Símbolo Internacional de Acessibilidade PcD)
  const pcdPinIcon = {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="32" height="42">
        <defs>
          <filter id="pcd-pin-shadow" x="-20%" y="-10%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.35"/>
          </filter>
        </defs>
        <!-- Sombra no solo -->
        <ellipse cx="16" cy="40" rx="4.5" ry="1.5" fill="#000000" opacity="0.25"/>
        <!-- Corpo do pino no Púrpura Vale PCD -->
        <path d="M16 1C8.82 1 3 6.82 3 14c0 9.5 11.8 23 12.3 23.6.4.4 1 .4 1.4 0C17.2 37 29 23.5 29 14 29 6.82 23.18 1 16 1z" fill="#86007D" stroke="#ffffff" stroke-width="1.8" filter="url(#pcd-pin-shadow)"/>
        <!-- Círculo branco de alto contraste -->
        <circle cx="16" cy="14" r="7.5" fill="#ffffff"/>
        <!-- Símbolo Internacional de Acessibilidade (PcD) -->
        <g transform="translate(10.5, 8.5) scale(0.46)" fill="#86007D">
          <circle cx="12" cy="4" r="2.2"/>
          <path d="M19 13v-2c-1.54.02-3.09-.75-4.07-1.83l-1.29-1.43c-.38-.42-.93-.68-1.53-.74H12c-.35-.04-.71.04-1.04.22-.64.35-1.06 1.01-1.06 1.78V15c0 .55.45 1 1 1s1-.45 1-1v-4.1l1.6 1.6c.33.33.75.52 1.2.55v4.95c0 1.1.9 2 2 2h3c.55 0 1-.45 1-1s-.45-1-1-1h-3v-4.9z"/>
          <path d="M10.8 11.2c-.5.7-.8 1.5-.8 2.4 0 2.2 1.8 4 4 4 .9 0 1.7-.3 2.4-.8l1.5 1.5c-1.1.8-2.4 1.3-3.9 1.3-3.3 0-6-2.7-6-6 0-1.5.5-2.8 1.3-3.9l1.5 1.5z"/>
        </g>
      </svg>
    `),
    scaledSize: new googleMaps.Size(32, 42),
    anchor: new googleMaps.Point(16, 40)
  };

  // Desenha os pontos de ancoragem e linhas conectoras de desdobramento (spiderfy)
  multiGroups.forEach(group => {
    const anchorDot = new googleMaps.Circle({
      center: group.center,
      radius: 2,
      fillColor: '#86007D',
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
          strokeColor: '#86007D',
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
      icon: pcdPinIcon,
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

  emitVisibleBounds();
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
    const isDefaultSP = Math.abs(newCenter.latitude - (-23.55052)) < 0.0001 && Math.abs(newCenter.longitude - (-46.633308)) < 0.0001;
    if (!isDefaultSP) {
      updateUserLocationDot(newCenter.latitude, newCenter.longitude);
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
  if (userLocationMarker) {
    userLocationMarker.setMap(null);
    userLocationMarker = null;
  }
  if (userLocationHalo) {
    userLocationHalo.setMap(null);
    userLocationHalo = null;
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
  if (boundsListenerRef) {
    boundsListenerRef.remove();
    boundsListenerRef = null;
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

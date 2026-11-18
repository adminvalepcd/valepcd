import { inject, provide, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import type { MulteiPanelUserProfile } from '~/services/firebaseService';

/**
 * Contexto compartilhado entre a casca do Painel do Multei (pages/multei/painel.vue)
 * e os componentes de cada aba (components/multei/panel/*).
 *
 * A casca é dona do perfil logado, do anúncio para leitores de tela, do lightbox
 * de fotos e do modal "Abrir local no Multei"; as abas apenas consomem.
 */
export interface MulteiPanelSharedContext {
  userProfile: Ref<MulteiPanelUserProfile | null>;
  isAdminRole: ComputedRef<boolean>;
  announceSr: (msg: string) => void;
  /**
   * Abre o lightbox (diálogo acessível com foco retido, Esc e retorno do foco).
   * `alt` é opcional: descreva a foto (ex.: "Foto da correção da ocorrência na Rua X").
   * Dica: chame a partir de um `<button>` para o foco voltar a ele ao fechar.
   */
  openPanelLightbox: (url?: string, alt?: string) => void;
  openMulteiLocationModalFor: (target: any) => Promise<void>;
}

const MULTEI_PANEL_SHARED_KEY: InjectionKey<MulteiPanelSharedContext> = Symbol('multei-panel-shared');

export const provideMulteiPanelShared = (ctx: MulteiPanelSharedContext): MulteiPanelSharedContext => {
  provide(MULTEI_PANEL_SHARED_KEY, ctx);
  return ctx;
};

export const useMulteiPanelShared = (): MulteiPanelSharedContext => {
  const ctx = inject(MULTEI_PANEL_SHARED_KEY, null);
  if (!ctx) {
    throw new Error('[painel] useMulteiPanelShared() precisa ser usado dentro do Painel do Multei.');
  }
  return ctx;
};

export const getPanelDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const formatPanelIncidentLocation = (item: any) => {
  if (!item) return '';
  const cityState = [item.cidade, item.estado].filter(Boolean).join('/');
  const streetPart = [item.rua, item.bairro].filter(Boolean).join(' - ');
  if (streetPart && cityState) return `${streetPart} (${cityState})`;
  return streetPart || cityState || `Lat ${Number(item.latitude).toFixed(4)}, Lng ${Number(item.longitude).toFixed(4)}`;
};

export const formatPanelDateTime = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

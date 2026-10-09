import { onMounted, onBeforeUnmount, watch, nextTick, type Ref } from 'vue';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

const isElementVisible = (el: HTMLElement): boolean => {
  if (!el) return false;
  if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') {
    return false;
  }
  const style = getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none';
};

export interface UseModalAccessibilityOptions {
  /**
   * Elemento raiz do modal onde o foco ficará retido (Focus Trap)
   */
  modalRef: Ref<HTMLElement | null>;
  /**
   * Opcional: Ref booleana para modais inline controlados por estado dentro da mesma página
   */
  isOpen?: Ref<boolean>;
  /**
   * Seletores de sub-overlays internos (ex: confirmação de denúncia, câmera, zoom de foto)
   * que, quando presentes, devem reter o foco exclusivamente dentro deles.
   */
  subOverlaySelector?: string;
  /**
   * Verifica se o modal pode ser fechado no momento (ex: false durante salvamento/análise)
   */
  canClose?: () => boolean;
  /**
   * Chamado ao pressionar ESC ou o botão Voltar físico/gestual do smartphone.
   * Se retornar `'subview'` (ou `true`), indica que apenas uma sub-tela interna foi fechada
   * e o modal principal continua aberto (mantendo o histórico para o próximo "Voltar").
   * Se retornar `'closed'` (ou `false` / `void`), indica que o modal principal foi fechado.
   */
  onRequestClose: () => 'subview' | 'closed' | boolean | void;
}

export function useModalAccessibility(options: UseModalAccessibilityOptions) {
  const {
    modalRef,
    isOpen,
    subOverlaySelector = '.report-overlay, .switch-natureza-overlay, .photo-expanded-overlay, .camera-overlay, .camera-backdrop',
    canClose = () => true,
    onRequestClose
  } = options;

  const instanceId = `multei-modal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let previouslyFocusedElement: HTMLElement | null = null;
  let closedViaPopState = false;
  let hasPushedHistory = false;
  let isActive = false;

  const getActiveContainer = (): HTMLElement | null => {
    const root = modalRef.value;
    if (!root) return null;
    if (subOverlaySelector) {
      const subOverlays = Array.from(root.querySelectorAll<HTMLElement>(subOverlaySelector)).filter(isElementVisible);
      if (subOverlays.length > 0) {
        return subOverlays[subOverlays.length - 1] || root;
      }
    }
    return root;
  };

  const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isElementVisible);
  };

  const focusInitialElement = () => {
    const container = getActiveContainer();
    if (!container) return;
    const focusables = getFocusableElements(container);
    if (focusables.length > 0) {
      focusables[0]?.focus();
    } else {
      if (!container.hasAttribute('tabindex')) {
        container.setAttribute('tabindex', '-1');
      }
      container.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const container = getActiveContainer();
    if (!container) return;

    if (e.key === 'Escape') {
      if (!canClose()) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const result = onRequestClose();
      if (result === 'subview' || result === true) {
        nextTick(() => focusInitialElement());
      }
      return;
    }

    if (e.key !== 'Tab') return;

    const focusables = getFocusableElements(container);
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }

    const firstEl = focusables[0]!;
    const lastEl = focusables[focusables.length - 1]!;
    const activeEl = document.activeElement as HTMLElement | null;
    const isInside = activeEl ? container.contains(activeEl) : false;

    if (e.shiftKey) {
      if (!isInside || activeEl === firstEl) {
        e.preventDefault();
        lastEl.focus();
      }
    } else {
      if (!isInside || activeEl === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
  };

  const handlePopState = () => {
    if (!hasPushedHistory) return;

    if (!canClose()) {
      // Se estiver salvando/analisando, restaura a entrada no histórico para não fechar nem sair da página
      try {
        window.history.pushState({ multeiModalId: instanceId }, '');
      } catch {}
      return;
    }

    const result = onRequestClose();
    if (result === 'subview' || result === true) {
      // Apenas fechou uma sub-tela interna (ex: câmera ou confirmação); mantém o modal principal no histórico
      try {
        window.history.pushState({ multeiModalId: instanceId }, '');
      } catch {}
      nextTick(() => focusInitialElement());
      return;
    }

    closedViaPopState = true;
    hasPushedHistory = false;
  };

  const activate = () => {
    if (isActive || typeof window === 'undefined' || typeof document === 'undefined') return;
    isActive = true;
    closedViaPopState = false;
    previouslyFocusedElement = document.activeElement as HTMLElement | null;

    try {
      window.history.pushState({ multeiModalId: instanceId }, '');
      hasPushedHistory = true;
    } catch {}

    window.addEventListener('popstate', handlePopState);
    document.addEventListener('keydown', handleKeyDown, true);

    nextTick(() => {
      focusInitialElement();
    });
  };

  const deactivate = () => {
    if (!isActive || typeof window === 'undefined' || typeof document === 'undefined') return;
    isActive = false;

    window.removeEventListener('popstate', handlePopState);
    document.removeEventListener('keydown', handleKeyDown, true);

    if (hasPushedHistory && !closedViaPopState) {
      hasPushedHistory = false;
      try {
        if (window.history.state?.multeiModalId === instanceId) {
          window.history.back();
        }
      } catch {}
    }

    if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
      const toRestore = previouslyFocusedElement;
      previouslyFocusedElement = null;
      nextTick(() => {
        try {
          toRestore.focus();
        } catch {}
      });
    }
  };

  if (isOpen) {
    watch(
      isOpen,
      (val) => {
        if (val) {
          activate();
        } else {
          deactivate();
        }
      },
      { immediate: true }
    );
  } else {
    onMounted(() => {
      activate();
    });
  }

  onBeforeUnmount(() => {
    deactivate();
  });

  return {
    focusInitialElement
  };
}

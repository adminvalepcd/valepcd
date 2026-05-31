<template>
  <div class="app-layout">
    <!-- Atalho de teclado invisível para pular para o conteúdo direto (Acessibilidade) -->
    <a href="#main-content" class="skip-to-content">Pular para o conteúdo principal</a>

    <!-- Header Acessível -->
    <AppHeader />
    
    <!-- Conteúdo Principal da Página -->
    <main id="main-content" class="main-content" role="main" tabindex="-1">
      <slot />
    </main>
    
    <!-- Rodapé -->
    <AppFooter />
  </div>
</template>

<style>
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.main-content {
  flex: 1 0 auto;
  padding-top: 80px; /* Altura de respiro para compensar o Header fixed */
  padding-bottom: 4rem;
}

/* Skip Link - Acessibilidade por teclado */
.skip-to-content {
  position: absolute;
  left: -9999px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;
  z-index: -1;
}

.skip-to-content:focus {
  position: fixed;
  top: 90px;
  left: 20px;
  width: auto;
  height: auto;
  padding: 10px 20px;
  background-color: var(--accent);
  color: black;
  font-weight: bold;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  z-index: 999999;
  outline: none;
}
</style>

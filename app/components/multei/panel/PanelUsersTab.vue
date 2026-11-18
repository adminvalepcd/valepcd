<template>
  <section v-if="active" class="users-management-section" aria-labelledby="painel-users-heading">
    <!-- ABA (EXCLUSIVA ADMIN): USUÁRIOS -->
    <header class="panel-header">
      <div>
        <span class="panel-kicker">Controle de acesso e parcerias</span>
        <h2 id="painel-users-heading" class="panel-main-title">Gestão de usuários</h2>
        <p class="panel-main-subtitle">
          Cadastre pessoas da <strong>administração (Vale PCD)</strong> e das <strong>parcerias municipais</strong>, envie convites de acesso e gerencie permissões, ativação, edição e exclusão.
        </p>
      </div>

      <div class="users-header-actions">
        <button
          type="button"
          class="btn-new-user"
          @click="startCreateUser"
        >
          <span aria-hidden="true">➕</span>
          <span>Incluir usuário</span>
        </button>

        <button
          type="button"
          class="btn-refresh-list"
          :disabled="isLoadingUsers"
          @click="loadPanelUsers"
        >
          <span aria-hidden="true">🔄</span>
          <span>{{ isLoadingUsers ? 'Atualizando...' : 'Atualizar' }}</span>
        </button>
      </div>
    </header>

    <div class="master-detail-grid users-grid">
      <!-- COLUNA ESQUERDA: Lista de Usuários Cadastrados -->
      <aside class="master-column users-list-column" aria-labelledby="painel-users-list-title">
        <div class="users-list-header">
          <h3 id="painel-users-list-title" class="users-list-title">Usuários cadastrados</h3>
          <span class="tab-counter">
            {{ panelUsers.length }}<span class="sr-only"> usuários</span>
          </span>
        </div>

        <div v-if="isLoadingUsers" class="list-empty-state">
          <div class="spinner-circle" aria-hidden="true"></div>
          <p>Carregando lista de usuários...</p>
        </div>

        <div v-else-if="panelUsers.length === 0" class="list-empty-state">
          <span class="empty-icon" aria-hidden="true">👥</span>
          <p class="empty-title">Nenhum usuário encontrado</p>
          <p class="empty-desc">Use o formulário ao lado para incluir o primeiro usuário.</p>
        </div>

        <ul v-else class="report-list users-list">
          <li
            v-for="u in panelUsers"
            :key="u.id"
            class="report-list-item"
          >
            <div
              class="user-item-card"
              :class="{
                'is-selected': editingUserId === u.id,
                'is-inactive': !u.ativo
              }"
              @click="selectUserForEdit(u)"
            >
              <div class="report-item-top">
                <span
                  class="natureza-pill"
                  :class="u.role === 'admin' ? 'pill-role-admin' : 'pill-role-parceria'"
                >
                  <span aria-hidden="true">{{ u.role === 'admin' ? '🛡️' : '🤝' }}</span>
                  {{ u.role === 'admin' ? 'Administração' : 'Parceria municipal' }}
                </span>

                <span
                  class="user-status-pill"
                  :class="u.ativo ? 'status-pill-active' : 'status-pill-inactive'"
                >
                  <span aria-hidden="true">{{ u.ativo ? '🟢' : '🔴' }}</span>
                  {{ u.ativo ? 'Ativo' : 'Inativo' }}
                </span>
              </div>

              <div class="report-item-location user-card-name">
                {{ getUserDisplayName(u) }}
              </div>

              <div class="user-card-email">
                {{ u.email || 'E-mail não informado' }}
              </div>

              <div class="user-card-city">
                <span aria-hidden="true">📍</span>
                {{ [u.cidade, u.estado].filter(Boolean).join(' / ') || 'Cidade/UF não definida' }}
              </div>

              <div class="user-card-quick-actions" @click.stop>
                <button
                  type="button"
                  class="btn-user-quick"
                  @click="selectUserForEdit(u)"
                >
                  <span aria-hidden="true">✏️</span>
                  Editar<span class="sr-only"> {{ getUserDisplayName(u) }}</span>
                </button>

                <button
                  type="button"
                  class="btn-user-quick"
                  :disabled="isSavingUser"
                  @click="handleToggleUserActive(u)"
                >
                  <span aria-hidden="true">{{ u.ativo ? '⏸️' : '▶️' }}</span>
                  {{ u.ativo ? 'Desativar' : 'Ativar' }}<span class="sr-only"> {{ getUserDisplayName(u) }}</span>
                </button>

                <button
                  type="button"
                  class="btn-user-quick btn-user-quick-danger"
                  :disabled="isSavingUser"
                  @click="promptDeleteUser(u)"
                >
                  <span aria-hidden="true">🗑️</span>
                  Excluir<span class="sr-only"> {{ getUserDisplayName(u) }}</span>
                </button>
              </div>
            </div>
          </li>
        </ul>
      </aside>

      <!-- COLUNA DIREITA: Formulário de Inclusão / Edição -->
      <section class="detail-column" aria-labelledby="painel-user-form-title">
        <div class="detail-card user-form-card">
          <div class="user-form-header">
            <div>
              <span class="panel-kicker">
                {{ userFormMode === 'create' ? 'Novo usuário' : 'Edição de usuário' }}
              </span>
              <h3 id="painel-user-form-title" class="user-form-title">
                <template v-if="userFormMode === 'create'">
                  <span aria-hidden="true">➕</span> Incluir novo usuário
                </template>
                <template v-else>
                  <span aria-hidden="true">✏️</span> Editar usuário: {{ `${userForm.nome} ${userForm.sobrenome}`.trim() }}
                </template>
              </h3>
            </div>

            <button
              v-if="userFormMode === 'edit'"
              type="button"
              class="btn-cancel-edit"
              @click="startCreateUser"
            >
              <span aria-hidden="true">➕</span> Incluir outro usuário
            </button>
          </div>

          <form class="user-crud-form" novalidate @submit.prevent="handleSaveUser">
            <div class="user-form-grid">
              <!-- Perfil de acesso -->
              <div class="form-field">
                <label for="user-role" class="field-label">Perfil de acesso *</label>
                <select
                  id="user-role"
                  v-model="userForm.role"
                  class="field-input"
                  :disabled="isSavingUser"
                >
                  <option value="parceria">Parceria municipal</option>
                  <option value="admin">Administração (Vale PCD)</option>
                </select>
              </div>

              <!-- Status Ativo / Desativado -->
              <div class="form-field">
                <label for="user-status" class="field-label">Status da conta *</label>
                <select
                  id="user-status"
                  v-model="userForm.ativo"
                  class="field-input"
                  :disabled="isSavingUser"
                >
                  <option :value="true">Ativo (pode acessar o painel)</option>
                  <option :value="false">Desativado (acesso bloqueado)</option>
                </select>
              </div>

              <!-- Nome -->
              <div class="form-field">
                <label for="user-nome" class="field-label">Nome *</label>
                <input
                  id="user-nome"
                  v-model="userForm.nome"
                  type="text"
                  required
                  autocomplete="off"
                  placeholder="Ex.: Maria"
                  class="field-input"
                  :disabled="isSavingUser"
                />
              </div>

              <!-- Sobrenome -->
              <div class="form-field">
                <label for="user-sobrenome" class="field-label">Sobrenome *</label>
                <input
                  id="user-sobrenome"
                  v-model="userForm.sobrenome"
                  type="text"
                  required
                  autocomplete="off"
                  placeholder="Ex.: Souza"
                  class="field-input"
                  :disabled="isSavingUser"
                />
              </div>

              <!-- E-mail -->
              <div class="form-field">
                <label for="user-email" class="field-label">E-mail de acesso *</label>
                <input
                  id="user-email"
                  v-model="userForm.email"
                  type="email"
                  required
                  autocomplete="off"
                  placeholder="nome@orgao.gov.br"
                  class="field-input"
                  :aria-describedby="userFormMode === 'create' ? 'user-invite-hint' : undefined"
                  :disabled="isSavingUser"
                />
              </div>

              <!-- Convite (no modo Incluir) ou Redefinição de senha (no modo Editar) -->
              <div v-if="userFormMode === 'create'" class="form-field">
                <span class="field-label">Senha</span>
                <p id="user-invite-hint" class="user-invite-hint">
                  <span aria-hidden="true">✉️</span>
                  Não é preciso definir senha. A pessoa receberá um e-mail de convite para criar a própria senha no primeiro acesso.
                </p>
              </div>

              <div v-else class="form-field">
                <span id="user-password-label" class="field-label">Senha</span>
                <button
                  type="button"
                  class="btn-password-reset-mail"
                  aria-describedby="user-password-label"
                  :disabled="isSavingUser || !userForm.email"
                  @click="handleSendPasswordReset()"
                >
                  <span aria-hidden="true">🔑</span>
                  Enviar e-mail de redefinição de senha
                </button>
              </div>

              <!-- Estado (UF) -->
              <div class="form-field">
                <label for="user-estado" class="field-label">Estado (UF) *</label>
                <select
                  id="user-estado"
                  v-model="userForm.estado"
                  class="field-input"
                  :disabled="isSavingUser"
                  @change="handleUserFormEstadoChange"
                >
                  <option value="" disabled>Selecione a UF</option>
                  <option v-for="uf in BRAZIL_STATES" :key="uf" :value="uf">
                    {{ uf }}
                  </option>
                </select>
              </div>

              <!-- Cidade (Search field via API IBGE com a capital como padrão por estado) -->
              <div class="form-field">
                <label for="user-cidade" class="field-label">
                  Cidade *
                </label>
                <MulteiCitySearchField
                  v-model="userForm.cidade"
                  :uf="userForm.estado"
                  input-id="user-cidade"
                  placeholder="Digite para buscar a cidade..."
                  :disabled="isSavingUser"
                  required
                />
              </div>
            </div>

            <p v-if="userFeedbackError" class="login-error-alert" role="alert">
              {{ userFeedbackError }}
            </p>

            <div v-if="userFeedbackSuccess" class="user-success-alert" role="status">
              <p class="user-feedback-text">{{ userFeedbackSuccess }}</p>
              <button
                v-if="inviteResendEmail"
                type="button"
                class="btn-resend-invite"
                :disabled="isSavingUser"
                @click="handleResendInvite"
              >
                Reenviar convite
              </button>
            </div>

            <!-- Confirmação inline de exclusão de usuário -->
            <div v-if="userPendingDelete" class="delete-confirm-banner" role="alertdialog" aria-labelledby="delete-user-confirm-title">
              <p id="delete-user-confirm-title" class="delete-confirm-text">
                <span aria-hidden="true">⚠️</span>
                Confirma a exclusão do acesso de <strong>{{ userPendingDelete.nomeCompleto }}</strong> ({{ userPendingDelete.email }})? A pessoa deixará de acessar o painel.
              </p>
              <div class="delete-confirm-actions">
                <button
                  type="button"
                  class="btn-confirm-delete"
                  :disabled="isSavingUser"
                  @click="confirmDeleteUser"
                >
                  <template v-if="isSavingUser">Excluindo...</template>
                  <template v-else><span aria-hidden="true">🗑️</span> Sim, excluir usuário</template>
                </button>
                <button
                  type="button"
                  class="btn-cancel-delete"
                  :disabled="isSavingUser"
                  @click="userPendingDelete = null"
                >
                  Cancelar
                </button>
              </div>
            </div>

            <div class="user-form-actions">
              <button
                type="submit"
                class="btn-login-submit btn-save-user"
                :disabled="isSavingUser"
              >
                <span v-if="isSavingUser">Salvando...</span>
                <span v-else-if="userFormMode === 'create'">
                  <span aria-hidden="true">✉️</span> Criar usuário e enviar convite
                </span>
                <span v-else>
                  <span aria-hidden="true">💾</span> Salvar alterações
                </span>
              </button>

              <template v-if="userFormMode === 'edit' && selectedManagedUser">
                <button
                  type="button"
                  class="btn-toggle-active-main"
                  :disabled="isSavingUser"
                  @click="handleToggleUserActive(selectedManagedUser)"
                >
                  <span aria-hidden="true">{{ selectedManagedUser.ativo ? '⏸️' : '▶️' }}</span>
                  {{ selectedManagedUser.ativo ? 'Desativar usuário' : 'Ativar usuário' }}
                </button>

                <button
                  type="button"
                  class="btn-delete-user-main"
                  :disabled="isSavingUser"
                  @click="promptDeleteUser(selectedManagedUser)"
                >
                  <span aria-hidden="true">🗑️</span> Excluir usuário
                </button>
              </template>
            </div>
          </form>
        </div>
      </section>
    </div>

    <!-- Manutenção (exclusiva admin): preenche as chaves de cidade para acelerar as consultas por cidade -->
    <section
      v-if="isAdminRole"
      class="detail-card maintenance-card"
      aria-labelledby="painel-maintenance-title"
      :aria-busy="backfillState === 'running' ? 'true' : 'false'"
    >
      <span class="panel-kicker">Manutenção</span>
      <h3 id="painel-maintenance-title" class="maintenance-title">Otimizar consultas por cidade</h3>
      <p class="maintenance-desc">
        Prepara os registros antigos para que a lista de ocorrências de cada cidade carregue mais rápido. Basta fazer uma vez; repetir não causa problemas. Pode levar alguns minutos.
      </p>

      <div v-if="backfillState === 'idle' || backfillState === 'done' || backfillState === 'error'" class="maintenance-actions">
        <button
          ref="backfillStartRef"
          type="button"
          class="btn-maintenance"
          @click="askBackfillConfirmation"
        >
          {{ backfillState === 'done' ? 'Executar novamente' : 'Otimizar consultas por cidade' }}
        </button>
      </div>

      <div v-else-if="backfillState === 'confirm'" class="maintenance-confirm" role="group" aria-labelledby="painel-maintenance-confirm-text">
        <p id="painel-maintenance-confirm-text" class="maintenance-confirm-text">
          Deseja iniciar agora? Mantenha esta aba aberta até o fim do processo.
        </p>
        <div class="maintenance-actions">
          <button
            ref="backfillConfirmRef"
            type="button"
            class="btn-maintenance"
            @click="runBackfill"
          >
            Sim, iniciar
          </button>
          <button type="button" class="btn-cancel-delete" @click="cancelBackfill">
            Cancelar
          </button>
        </div>
      </div>

      <div v-if="backfillState === 'running'" class="maintenance-progress">
        <progress class="maintenance-progress-bar" aria-label="Otimização em andamento"></progress>
        <p class="maintenance-progress-text">
          <template v-if="backfillProgress">
            Verificando {{ getBackfillCollectionLabel(backfillProgress.collection) }}: {{ formatCount(backfillProgress.scanned) }} registros verificados, {{ formatCount(backfillProgress.updated) }} atualizados.
          </template>
          <template v-else>Iniciando...</template>
        </p>
      </div>

      <p v-if="backfillState === 'done' && backfillResult" class="user-success-alert maintenance-result">
        Concluído: {{ formatCount(backfillResult.scanned) }} registros verificados e {{ formatCount(backfillResult.updated) }} atualizados.
      </p>

      <p v-if="backfillState === 'error' && backfillError" class="login-error-alert maintenance-result" role="alert">
        {{ backfillError }}
      </p>
    </section>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import {
  BRAZIL_STATES,
  getCapitalByState
} from '~/services/ibgeService';
import {
  refreshCurrentMulteiPanelProfile,
  fetchPanelUsersFromFirebase,
  createPanelUserInFirebase,
  updatePanelUserInFirebase,
  togglePanelUserActiveInFirebase,
  deletePanelUserFromFirebase,
  sendPanelUserPasswordReset,
  backfillCityKeys,
  type CityKeysBackfillProgress,
  type MulteiPanelUserProfile,
  type MulteiPanelManagedUser
} from '~/services/firebaseService';
import {
  useMulteiPanelShared
} from '~/composables/useMulteiPanelShared';

// Aba "Usuários" (exclusiva Admin). Montada enquanto o admin estiver logado;
// `active` só controla a exibição, para preservar estado do formulário ao trocar de aba.
const props = defineProps<{
  active: boolean;
  /** Chamado quando o admin edita o próprio usuário: a casca atualiza o perfil e recarrega as abas. */
  afterOwnProfileRefresh: (profile: MulteiPanelUserProfile) => Promise<void>;
}>();

const emit = defineEmits<{
  (e: 'users-count', count: number): void;
}>();

const { userProfile, isAdminRole, announceSr } = useMulteiPanelShared();

// Estado de Gestão de Usuários
const panelUsers = ref<MulteiPanelManagedUser[]>([]);
const isLoadingUsers = ref(false);
const isSavingUser = ref(false);
const userFormMode = ref<'create' | 'edit'>('create');
const editingUserId = ref<string | null>(null);
const userFeedbackError = ref('');
const userFeedbackSuccess = ref('');
/** E-mail para o botão "Reenviar convite" (quando o convite automático não pôde ser enviado). */
const inviteResendEmail = ref('');
const userPendingDelete = ref<MulteiPanelManagedUser | null>(null);

const userForm = ref<{
  role: 'admin' | 'parceria';
  nome: string;
  sobrenome: string;
  email: string;
  cidade: string;
  estado: string;
  ativo: boolean;
}>({
  role: 'parceria',
  nome: '',
  sobrenome: '',
  email: '',
  cidade: getCapitalByState('SP'),
  estado: 'SP',
  ativo: true
});

const getUserDisplayName = (u: MulteiPanelManagedUser) =>
  u.nomeCompleto || `${u.nome || ''} ${u.sobrenome || ''}`.trim() || 'Sem nome';

const handleUserFormEstadoChange = () => {
  const cap = getCapitalByState(userForm.value.estado);
  if (cap) {
    userForm.value.cidade = cap;
  }
};

const selectedManagedUser = computed(() =>
  panelUsers.value.find((u) => u.id === editingUserId.value) || null
);

const clearUserFeedback = () => {
  userFeedbackError.value = '';
  userFeedbackSuccess.value = '';
  inviteResendEmail.value = '';
};

const loadPanelUsers = async () => {
  if (!userProfile.value || userProfile.value.role !== 'admin') return;
  isLoadingUsers.value = true;
  try {
    panelUsers.value = await fetchPanelUsersFromFirebase();
  } catch (err: any) {
    console.warn('[painel] Erro ao carregar usuários.', err?.code || '');
    userFeedbackError.value = 'Não foi possível carregar a lista de usuários. Tente novamente.';
  } finally {
    isLoadingUsers.value = false;
  }
};

const startCreateUser = () => {
  userFormMode.value = 'create';
  editingUserId.value = null;
  userPendingDelete.value = null;
  clearUserFeedback();
  userForm.value = {
    role: 'parceria',
    nome: '',
    sobrenome: '',
    email: '',
    cidade: getCapitalByState('SP'),
    estado: 'SP',
    ativo: true
  };
};

const selectUserForEdit = (u: MulteiPanelManagedUser) => {
  const uf = (u.estado || 'SP').trim().toUpperCase();
  userFormMode.value = 'edit';
  editingUserId.value = u.id;
  userPendingDelete.value = null;
  clearUserFeedback();
  userForm.value = {
    role: u.role === 'parceria' ? 'parceria' : 'admin',
    nome: u.nome || '',
    sobrenome: u.sobrenome || '',
    email: u.email || '',
    cidade: u.cidade || getCapitalByState(uf),
    estado: uf,
    ativo: u.ativo !== false
  };
};

/**
 * Mensagens genéricas: não exibe mensagens técnicas do Firebase. Erros de validação do próprio serviço
 * (sem `code`, ex.: "Informe o nome do usuário.") são exibidos como vieram.
 */
const translateUserCrudError = (err: any): string => {
  const code = String(err?.code || '').toLowerCase();
  const raw = `${code} ${err?.message || ''}`.toLowerCase();
  if (code === 'permission_denied' || raw.includes('permission-denied')) {
    return 'Somente administradores podem executar esta ação.';
  }
  if (raw.includes('email-already-in-use')) {
    return 'Não foi possível criar o acesso com este e-mail. Verifique se a pessoa já está na lista ou use outro e-mail.';
  }
  if (raw.includes('invalid-email')) {
    return 'O formato do e-mail informado é inválido.';
  }
  if (raw.includes('network-request-failed')) {
    return 'Falha de conexão com a internet. Verifique sua rede e tente novamente.';
  }
  if (raw.includes('too-many-requests')) {
    return 'Muitas tentativas seguidas. Aguarde alguns instantes e tente novamente.';
  }
  if (!code && typeof err?.message === 'string' && err.message.trim()) {
    return err.message.trim();
  }
  return 'Não foi possível concluir a operação. Tente novamente.';
};

const handleSaveUser = async () => {
  if (isSavingUser.value) return;
  clearUserFeedback();
  userPendingDelete.value = null;

  isSavingUser.value = true;
  try {
    if (userFormMode.value === 'create') {
      // Fluxo de convite: sem senha; o serviço gera uma senha aleatória (nunca exibida) e envia o convite
      const created = await createPanelUserInFirebase({
        role: userForm.value.role,
        nome: userForm.value.nome,
        sobrenome: userForm.value.sobrenome,
        email: userForm.value.email,
        cidade: userForm.value.cidade,
        estado: userForm.value.estado,
        ativo: userForm.value.ativo
      });
      await loadPanelUsers();
      selectUserForEdit(created);
      if (created.inviteSent) {
        userFeedbackSuccess.value = `Usuário "${created.nomeCompleto}" criado. Enviamos um convite para ${created.email} criar a senha de acesso.`;
      } else {
        userFeedbackSuccess.value = `Usuário "${created.nomeCompleto}" criado, mas não foi possível enviar o convite por e-mail agora. Use "Reenviar convite" para tentar de novo.`;
        inviteResendEmail.value = created.email;
      }
      announceSr(userFeedbackSuccess.value);
    } else if (editingUserId.value) {
      await updatePanelUserInFirebase(editingUserId.value, {
        role: userForm.value.role,
        nome: userForm.value.nome,
        sobrenome: userForm.value.sobrenome,
        email: userForm.value.email,
        cidade: userForm.value.cidade,
        estado: userForm.value.estado,
        ativo: userForm.value.ativo
      });
      await loadPanelUsers();
      if (userProfile.value && editingUserId.value === userProfile.value.uid) {
        const refreshed = await refreshCurrentMulteiPanelProfile();
        if (refreshed) {
          await props.afterOwnProfileRefresh(refreshed);
        }
      }
      userFeedbackSuccess.value = 'Dados do usuário atualizados com sucesso.';
      announceSr(userFeedbackSuccess.value);
    }
  } catch (err: any) {
    userFeedbackError.value = translateUserCrudError(err);
  } finally {
    isSavingUser.value = false;
  }
};

const handleToggleUserActive = async (u: MulteiPanelManagedUser) => {
  if (isSavingUser.value) return;
  clearUserFeedback();
  isSavingUser.value = true;
  const nextActive = !u.ativo;
  try {
    await togglePanelUserActiveInFirebase(u.id, nextActive);
    await loadPanelUsers();
    if (editingUserId.value === u.id) {
      userForm.value.ativo = nextActive;
    }
    userFeedbackSuccess.value = nextActive
      ? `Usuário "${u.nomeCompleto}" ativado com sucesso.`
      : `Usuário "${u.nomeCompleto}" desativado com sucesso.`;
    announceSr(userFeedbackSuccess.value);
  } catch (err: any) {
    userFeedbackError.value = translateUserCrudError(err);
  } finally {
    isSavingUser.value = false;
  }
};

const promptDeleteUser = (u: MulteiPanelManagedUser) => {
  clearUserFeedback();
  if (editingUserId.value !== u.id) {
    selectUserForEdit(u);
  }
  userPendingDelete.value = u;
};

const confirmDeleteUser = async () => {
  const target = userPendingDelete.value;
  if (!target || isSavingUser.value) return;
  isSavingUser.value = true;
  clearUserFeedback();
  try {
    await deletePanelUserFromFirebase(target.id);
    const deletedName = target.nomeCompleto;
    userPendingDelete.value = null;
    await loadPanelUsers();
    startCreateUser();
    userFeedbackSuccess.value = `Usuário "${deletedName}" excluído com sucesso.`;
    announceSr(userFeedbackSuccess.value);
  } catch (err: any) {
    userFeedbackError.value = translateUserCrudError(err);
  } finally {
    isSavingUser.value = false;
  }
};

const handleSendPasswordReset = async (options?: { asInvite?: boolean; email?: string }) => {
  const email = (options?.email || userForm.value.email || '').trim();
  if (!email || isSavingUser.value) return;
  clearUserFeedback();
  isSavingUser.value = true;
  try {
    await sendPanelUserPasswordReset(email);
    userFeedbackSuccess.value = options?.asInvite
      ? `Convite reenviado para ${email}.`
      : `E-mail de redefinição de senha enviado para ${email}.`;
    announceSr(userFeedbackSuccess.value);
  } catch (err: any) {
    userFeedbackError.value = translateUserCrudError(err);
    if (options?.asInvite) {
      inviteResendEmail.value = email;
    }
  } finally {
    isSavingUser.value = false;
  }
};

const handleResendInvite = () => {
  const email = inviteResendEmail.value;
  if (!email) return;
  void handleSendPasswordReset({ asInvite: true, email });
};

// ---------------------------------------------------------------------------
// Manutenção: "Otimizar consultas por cidade" (backfill de cidade_key/estado_key, somente admin)
// ---------------------------------------------------------------------------
const backfillState = ref<'idle' | 'confirm' | 'running' | 'done' | 'error'>('idle');
const backfillProgress = ref<CityKeysBackfillProgress | null>(null);
const backfillResult = ref<{ updated: number; scanned: number } | null>(null);
const backfillError = ref('');
const backfillStartRef = ref<HTMLButtonElement | null>(null);
const backfillConfirmRef = ref<HTMLButtonElement | null>(null);

const BACKFILL_COLLECTION_LABELS: Record<string, string> = {
  ocorrencias: 'ocorrências',
  resolvidos: 'resoluções',
  reportadas: 'reportes'
};

const getBackfillCollectionLabel = (collectionName: string) =>
  BACKFILL_COLLECTION_LABELS[collectionName] || 'registros';

const formatCount = (n: number) => Number(n || 0).toLocaleString('pt-BR');

const askBackfillConfirmation = async () => {
  if (!isAdminRole.value) return;
  backfillError.value = '';
  backfillState.value = 'confirm';
  await nextTick();
  backfillConfirmRef.value?.focus();
};

const cancelBackfill = async () => {
  backfillState.value = backfillResult.value ? 'done' : 'idle';
  await nextTick();
  backfillStartRef.value?.focus();
};

const runBackfill = async () => {
  if (!isAdminRole.value || backfillState.value === 'running') return;
  backfillState.value = 'running';
  backfillProgress.value = null;
  backfillResult.value = null;
  backfillError.value = '';
  announceSr('Otimização das consultas por cidade iniciada.');
  try {
    const result = await backfillCityKeys({
      onProgress: (progress) => {
        backfillProgress.value = { ...progress };
      }
    });
    backfillResult.value = { updated: Number(result?.updated || 0), scanned: Number(result?.scanned || 0) };
    backfillState.value = 'done';
    announceSr(
      `Otimização concluída: ${formatCount(backfillResult.value.scanned)} registros verificados e ${formatCount(backfillResult.value.updated)} atualizados.`
    );
  } catch (err: any) {
    const code = String(err?.code || '').toLowerCase();
    backfillError.value =
      code === 'permission_denied' || code.includes('permission-denied')
        ? 'Somente administradores podem executar esta ação.'
        : 'Não foi possível concluir a otimização agora. Tente novamente mais tarde.';
    backfillState.value = 'error';
    console.warn('[painel] Otimização por cidade não concluída.', err?.code || '');
  } finally {
    backfillProgress.value = null;
  }
};

watch(
  () => panelUsers.value.length,
  (count) => emit('users-count', count),
  { immediate: true }
);

const ensureLoaded = async () => {
  if (panelUsers.value.length === 0) {
    await loadPanelUsers();
  }
};

const resetState = () => {
  panelUsers.value = [];
  backfillState.value = 'idle';
  backfillProgress.value = null;
  backfillResult.value = null;
  backfillError.value = '';
};

defineExpose({
  refresh: loadPanelUsers,
  ensureLoaded,
  resetState
});
</script>

<style scoped src="../../../assets/css/multei-panel.css"></style>

<style scoped>
.btn-new-user {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.65rem 1.15rem;
  border-radius: 9999px;
  border: none;
  background: var(--pp-accent);
  color: var(--pp-accent-text);
  font-size: 0.9rem;
  font-weight: 900;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-new-user:hover {
  background: var(--pp-accent-hover);
}

.users-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.95rem 1.1rem;
  border-bottom: 1.5px solid var(--pp-border);
  background: var(--pp-surface-alt);
}

.users-list-title {
  font-size: 0.92rem;
  font-weight: 900;
  color: var(--pp-text-primary);
}

.user-item-card {
  width: 100%;
  text-align: left;
  background: var(--pp-surface);
  border: 2px solid var(--pp-border);
  border-radius: 14px;
  padding: 0.9rem 1rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.user-item-card:hover {
  border-color: var(--pp-border-strong);
}

.user-item-card.is-selected {
  background: var(--pp-selected-bg);
  border-color: var(--pp-selected-border);
}

.user-item-card.is-inactive {
  opacity: 0.78;
}

.pill-role-admin {
  background: var(--pp-selected-bg);
  color: var(--pp-accent);
  border: 1.5px solid var(--pp-selected-border);
}

.pill-role-parceria {
  background: var(--pp-amber-bg);
  color: var(--pp-amber-text);
  border: 1.5px solid var(--pp-amber-border);
}

.user-status-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  font-size: 0.74rem;
  font-weight: 900;
}

.status-pill-active {
  background: var(--pp-green-bg);
  color: var(--pp-green-text);
  border: 1px solid var(--pp-green-border);
}

.status-pill-inactive {
  background: var(--pp-red-bg);
  color: var(--pp-red-text);
  border: 1px solid var(--pp-red-border);
}

.user-card-name {
  margin-bottom: 0.15rem;
}

.user-card-email {
  font-size: 0.82rem;
  color: var(--pp-text-secondary);
  word-break: break-all;
  margin-bottom: 0.25rem;
}

.user-card-city {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--pp-text-primary);
  margin-bottom: 0.65rem;
}

.user-card-quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding-top: 0.55rem;
  border-top: 1px dashed var(--pp-border);
}

.btn-user-quick {
  padding: 0.3rem 0.65rem;
  border-radius: 8px;
  border: 1.5px solid var(--pp-border-strong);
  background: var(--pp-surface-alt);
  color: var(--pp-text-primary);
  font-size: 0.76rem;
  font-weight: 800;
  cursor: pointer;
}

.btn-user-quick:hover:not(:disabled) {
  background: var(--pp-border);
}

.btn-user-quick-danger {
  border-color: var(--pp-red-border);
  color: var(--pp-red-text);
  background: var(--pp-red-bg);
}

.user-form-card {
  padding: 1.5rem;
}

.user-form-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  padding-bottom: 1.15rem;
  margin-bottom: 1.25rem;
  border-bottom: 1.5px solid var(--pp-border);
}

.user-form-title {
  margin: 0.2rem 0 0;
  font-size: 1.35rem;
  font-weight: 900;
  color: var(--pp-text-primary);
}

.user-crud-form {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.user-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.btn-password-reset-mail {
  width: 100%;
  padding: 0.72rem 1rem;
  border-radius: 12px;
  border: 1.5px solid var(--pp-border-strong);
  background: var(--pp-surface-alt);
  color: var(--pp-text-primary);
  font-size: 0.88rem;
  font-weight: 800;
  cursor: pointer;
  text-align: center;
}

.btn-password-reset-mail:hover:not(:disabled) {
  border-color: var(--pp-accent);
}

.delete-confirm-banner {
  padding: 1rem 1.15rem;
  border-radius: 14px;
  background: var(--pp-red-bg);
  border: 2px solid var(--pp-red-border);
  color: var(--pp-red-text);
}

.delete-confirm-text {
  margin: 0 0 0.75rem;
  font-size: 0.92rem;
  line-height: 1.45;
}

.delete-confirm-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.btn-confirm-delete {
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: 1.5px solid var(--pp-red-border);
  background: #dc2626;
  color: #ffffff;
  font-size: 0.86rem;
  font-weight: 900;
  cursor: pointer;
}

.btn-cancel-delete {
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: 1.5px solid var(--pp-border-strong);
  background: var(--pp-surface);
  color: var(--pp-text-primary);
  font-size: 0.86rem;
  font-weight: 800;
  cursor: pointer;
}

.user-form-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding-top: 0.35rem;
}

.btn-save-user {
  flex: 1;
  min-width: 220px;
}

.btn-toggle-active-main {
  padding: 0.82rem 1.15rem;
  border-radius: 14px;
  border: 2px solid var(--pp-border-strong);
  background: var(--pp-surface-alt);
  color: var(--pp-text-primary);
  font-size: 0.9rem;
  font-weight: 800;
  cursor: pointer;
}

.btn-delete-user-main {
  padding: 0.82rem 1.15rem;
  border-radius: 14px;
  border: 2px solid var(--pp-red-border);
  background: var(--pp-red-bg);
  color: var(--pp-red-text);
  font-size: 0.9rem;
  font-weight: 800;
  cursor: pointer;
}

.users-list-title {
  margin: 0;
}

.user-invite-hint {
  margin: 0;
  padding: 0.72rem 0.9rem;
  border-radius: 12px;
  background: var(--pp-surface-alt);
  border: 1.5px dashed var(--pp-border-strong);
  font-size: 0.86rem;
  line-height: 1.45;
  color: var(--pp-text-primary);
}

.user-feedback-text {
  margin: 0;
}

.btn-resend-invite {
  margin-top: 0.6rem;
  padding: 0.45rem 0.95rem;
  border-radius: 9999px;
  border: 1.5px solid var(--pp-green-border);
  background: var(--pp-surface);
  color: var(--pp-text-primary);
  font-size: 0.84rem;
  font-weight: 800;
  cursor: pointer;
}

.btn-resend-invite:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.maintenance-card {
  margin-top: 1.5rem;
  padding: 1.35rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.maintenance-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 900;
  color: var(--pp-text-primary);
}

.maintenance-desc,
.maintenance-confirm-text,
.maintenance-progress-text {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--pp-text-secondary);
}

.maintenance-confirm-text {
  font-weight: 800;
  color: var(--pp-text-primary);
  margin-bottom: 0.6rem;
}

.maintenance-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.btn-maintenance {
  padding: 0.6rem 1.1rem;
  border-radius: 12px;
  border: 2px solid var(--pp-accent);
  background: var(--pp-accent);
  color: var(--pp-accent-text);
  font-size: 0.88rem;
  font-weight: 900;
  cursor: pointer;
}

.btn-maintenance:hover {
  background: var(--pp-accent-hover);
  border-color: var(--pp-accent-hover);
}

.maintenance-progress {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.maintenance-progress-bar {
  width: 100%;
  max-width: 420px;
  height: 0.6rem;
  accent-color: var(--pp-accent);
}

.maintenance-result {
  margin: 0;
}

@media (max-width: 960px) {
  .user-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>

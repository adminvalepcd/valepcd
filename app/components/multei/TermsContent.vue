<template>
  <div class="multei-terms-doc">
    <header class="terms-doc-header">
      <component :is="headingTag" :id="titleId" class="terms-doc-main-title">
        TERMOS DE USO E POLÍTICA DE PRIVACIDADE DO MULTEI
      </component>
      <p class="terms-doc-lead">
        Bem-vindo ao Multei! O Multei é um mapa interativo de mobilidade urbana e inteligência de dados cívicos, criado e mantido pela ONG Vale PcD. Nossa missão é mapear e registrar, de forma anônima e colaborativa, infrações de trânsito em vagas reservadas para pessoas com deficiência (PcD) e pessoas idosas, auxiliando na geração de estatísticas para a melhoria da fiscalização urbana.
      </p>
      <p class="terms-doc-consent">
        Ao acessar e enviar informações para o site
        <NuxtLink to="/multei" class="terms-doc-link" @click="$emit('navigate-map')">www.valepcd.com.br/multei</NuxtLink>,
        você concorda com os termos abaixo.
      </p>
    </header>

    <section id="termos-de-uso" class="terms-part-section" aria-labelledby="heading-parte-1">
      <div class="terms-part-banner">
        <span class="terms-part-tag">Parte 1</span>
        <h2 v-if="headingTag === 'h1'" id="heading-parte-1" class="terms-part-title">PARTE 1: TERMOS DE USO</h2>
        <h3 v-else id="heading-parte-1" class="terms-part-title">PARTE 1: TERMOS DE USO</h3>
      </div>

      <div class="terms-clauses-list">
        <article class="terms-clause-card">
          <h3 v-if="headingTag === 'h1'" class="terms-clause-title">1. Natureza do Serviço e Ausência de Fins Lucrativos</h3>
          <h4 v-else class="terms-clause-title">1. Natureza do Serviço e Ausência de Fins Lucrativos</h4>
          <p>
            O Multei é um projeto social mantido pela ONG Vale PcD, sem fins lucrativos. Qualquer eventual recurso financeiro arrecadado será destinado exclusivamente à manutenção técnica da plataforma e ao apoio de outros projetos sociais da Vale PcD (como o programa de Psicoterapia para pessoas LGBTQIAPN+ e/ou com deficiência). O Multei não é um órgão autuador, não tem vínculo com departamentos de trânsito (Detran, BHTRANS, etc.) e não emite multas oficiais. Os dados gerados servem apenas para inteligência e estatística de fiscalização.
          </p>
        </article>

        <article class="terms-clause-card">
          <h3 v-if="headingTag === 'h1'" class="terms-clause-title">2. Responsabilidade da Pessoa Usuária (Quem faz a denúncia)</h3>
          <h4 v-else class="terms-clause-title">2. Responsabilidade da Pessoa Usuária (Quem faz a denúncia)</h4>
          <ul class="terms-subitems">
            <li>
              <strong>Segurança Física e Exercício da Cidadania:</strong> Embora o registro de imagens em vias públicas para documentar infrações seja um direito amparado pela lei (liberdade de informação e exercício da cidadania), o Multei e a ONG Vale PcD não têm como garantir a segurança física de quem usa a plataforma na rua. Nunca se coloque em risco para realizar uma denúncia. O ato de fotografar no espaço público ocorre por conta e risco de quem denuncia. A plataforma não se responsabiliza por eventuais conflitos, agressões, danos materiais (como a quebra de um celular) ou danos morais decorrentes de atritos com motoristas ou terceiros no momento do registro. Recomendamos sempre manter a discrição e colocar a sua segurança e integridade em primeiro lugar.
            </li>
            <li>
              <strong>Uso Adequado:</strong> Você se compromete a enviar apenas fotografias reais e inalteradas de veículos estacionados irregularmente. É terminantemente proibido o envio de imagens falsas, discriminatórias, pornográficas ou que não tenham relação com o objetivo do projeto. Também é expressamente proibido o envio de imagens total ou parcialmente geradas por Inteligência Artificial, bem como fotos reais que tenham sido manipuladas ou retocadas (seja por Inteligência Artificial ou programas de edição de imagem, mesmo que a intenção seja apenas apagar ou alterar um pequeno detalhe da foto original). A integridade do nosso mapa depende da veracidade absoluta dos registros.
            </li>
          </ul>
        </article>

        <article class="terms-clause-card">
          <h3 v-if="headingTag === 'h1'" class="terms-clause-title">3. Moderação Comunitária e Inteligência Artificial</h3>
          <h4 v-else class="terms-clause-title">3. Moderação Comunitária e Inteligência Artificial</h4>
          <ul class="terms-subitems">
            <li>
              <strong>Filtro Automatizado:</strong> O Multei utiliza Inteligência Artificial para analisar automaticamente as imagens antes da publicação. Imagens identificadas como impróprias são bloqueadas instantaneamente.
            </li>
            <li>
              <strong>Licença de Uso:</strong> Ao enviar uma imagem para o Multei, você concede à ONG Vale PcD uma autorização irrestrita, gratuita e definitiva para exibir, processar e gerar relatórios estatísticos a partir desses dados.
            </li>
            <li>
              <strong>Reporte de Abusos:</strong> Qualquer pessoa pode denunciar uma publicação no mapa. Publicações que receberem denúncias da comunidade serão ocultadas automaticamente até que passem por avaliação de uma pessoa moderadora da nossa equipe.
            </li>
          </ul>
        </article>

        <article class="terms-clause-card">
          <h3 v-if="headingTag === 'h1'" class="terms-clause-title">4. Restrição de Idade</h3>
          <h4 v-else class="terms-clause-title">4. Restrição de Idade</h4>
          <p>
            O uso da plataforma para envio de denúncias é recomendado para maiores de 18 (dezoito) anos. O Multei não coleta dados de registro (como data de nascimento), mas pressupõe que pessoas menores de idade estejam utilizando a ferramenta sob a supervisão de uma pessoa responsável legal.
          </p>
        </article>

        <article class="terms-clause-card">
          <h3 v-if="headingTag === 'h1'" class="terms-clause-title">5. Disponibilidade do Sistema ("No estado em que se encontra")</h3>
          <h4 v-else class="terms-clause-title">5. Disponibilidade do Sistema ("No estado em que se encontra")</h4>
          <p>
            O Multei é fornecido exatamente no estado em que se encontra. Por ser um projeto de impacto social mantido por doações e parcerias, não garantimos que os servidores estarão disponíveis sem interrupções, não garantimos o tempo em que o site ficará no ar ou o armazenamento vitalício do mapa. O sistema pode ser retirado do ar temporária ou definitivamente a qualquer momento, sem necessidade de aviso prévio e sem que isso gere qualquer direito a indenização.
          </p>
        </article>
      </div>
    </section>

    <section id="politica-de-privacidade" class="terms-part-section" aria-labelledby="heading-parte-2">
      <div class="terms-part-banner">
        <span class="terms-part-tag">Parte 2</span>
        <h2 v-if="headingTag === 'h1'" id="heading-parte-2" class="terms-part-title">PARTE 2: POLÍTICA DE PRIVACIDADE</h2>
        <h3 v-else id="heading-parte-2" class="terms-part-title">PARTE 2: POLÍTICA DE PRIVACIDADE</h3>
      </div>

      <p class="terms-part-intro">
        A transparência é o nosso maior pilar. Desenvolvemos o Multei com foco em Privacidade desde a Concepção (um modelo onde a proteção de dados é a prioridade desde o desenho inicial do projeto) para proteger tanto quem denuncia quanto quem é denunciado.
      </p>

      <div class="terms-clauses-list">
        <article class="terms-clause-card">
          <h3 v-if="headingTag === 'h1'" class="terms-clause-title">1. Proteção Total dos Dados (Rostos e Placas)</h3>
          <h4 v-else class="terms-clause-title">1. Proteção Total dos Dados (Rostos e Placas)</h4>
          <p>O Multei não armazena dados que possam identificar pessoas.</p>
          <ul class="terms-subitems">
            <li>
              <strong>Censura Imediata:</strong> Assim que uma foto é enviada, a nossa Inteligência Artificial aplica uma tarja (censura) automática sobre qualquer rosto humano e sobre a placa do veículo diretamente na imagem.
            </li>
            <li>
              <strong>O que é salvo:</strong> Apenas a imagem já censurada é enviada e armazenada no nosso banco de dados. Nós nunca armazenamos ou guardamos a versão original (sem tarja) da foto.
            </li>
          </ul>
        </article>

        <article class="terms-clause-card">
          <h3 v-if="headingTag === 'h1'" class="terms-clause-title">2. Dados de Quem Denuncia e Rastreabilidade</h3>
          <h4 v-else class="terms-clause-title">2. Dados de Quem Denuncia e Rastreabilidade</h4>
          <p>O envio de dados no Multei é 100% isolado e anônimo.</p>
          <ul class="terms-subitems">
            <li>Nós não exigimos criação de conta, não pedimos seu nome, e-mail ou telefone.</li>
            <li>
              O sistema captura apenas dados de conexão temporários (necessários para o envio técnico da foto) e, somente após a sua autorização, as coordenadas de geolocalização (GPS) do momento da infração.
            </li>
            <li>
              <strong>Proteção contra retaliação:</strong> Como não guardamos nenhum vínculo entre o seu celular/computador e a denúncia após o fechamento do site, é tecnicamente impossível que o Multei identifique quem foi a pessoa autora de uma denúncia específica.
            </li>
          </ul>
        </article>

        <article class="terms-clause-card">
          <h3 v-if="headingTag === 'h1'" class="terms-clause-title">3. Direito de Exclusão (Esquecimento)</h3>
          <h4 v-else class="terms-clause-title">3. Direito de Exclusão (Esquecimento)</h4>
          <p>
            De acordo com o Artigo 12 da Lei Geral de Proteção de Dados, dados anonimizados não são considerados dados pessoais.
          </p>
          <ul class="terms-subitems">
            <li>
              <strong>Exclusão pelo Mapa:</strong> Como não existe uma conta de usuário ou lista de "Minhas Denúncias", a única forma de excluir uma imagem já publicada é localizando o ponto específico da infração no mapa público e utilizando o botão de reporte/exclusão.
            </li>
            <li>
              <strong>Irreversibilidade:</strong> Devido à natureza estritamente anônima do envio, não podemos atender a pedidos de exclusão enviados por e-mail (ex: "apaguem a foto que enviei ontem"), pois não temos como provar tecnicamente que a foto listada no banco de dados pertence à pessoa que está solicitando a remoção.
            </li>
          </ul>
        </article>

        <article class="terms-clause-card">
          <h3 v-if="headingTag === 'h1'" class="terms-clause-title">4. Infraestrutura e Servidores Fora do País</h3>
          <h4 v-else class="terms-clause-title">4. Infraestrutura e Servidores Fora do País</h4>
          <p>
            Para processar a censura inteligente e manter o mapa no ar, o Multei utiliza a infraestrutura de serviços de computação em nuvem de grande porte. Ao usar o Multei, você está ciente de que os dados de tráfego (sempre tornados anônimos antes de serem salvos) podem ser processados em servidores localizados fora do Brasil. Esses parceiros tecnológicos possuem rigorosos protocolos globais de segurança e não utilizam as fotos censuradas do projeto para fins próprios.
          </p>
        </article>

        <article class="terms-clause-card">
          <h3 v-if="headingTag === 'h1'" class="terms-clause-title">5. Uso de Cookies e Tecnologias de Rastreamento</h3>
          <h4 v-else class="terms-clause-title">5. Uso de Cookies e Tecnologias de Rastreamento</h4>
          <p>
            O Multei utiliza "cookies" (pequenos arquivos de texto salvos no seu navegador) e tecnologias semelhantes para garantir o funcionamento do site, medir o desempenho e exibir anúncios.
          </p>
          <ul class="terms-subitems">
            <li>
              <strong>Cookies Essenciais e de Desempenho:</strong> Utilizamos serviços como a Vercel para hospedar o site e entender métricas técnicas (como tempo de carregamento da página e prevenção de ataques). Esses cookies não rastreiam quem você é, apenas garantem que o site funcione de forma rápida e segura.
            </li>
            <li>
              <strong>Cookies de Publicidade (Google AdSense):</strong> Para ajudar a custear a manutenção do projeto, exibimos anúncios fornecidos pelo Google AdSense. O Google e seus parceiros utilizam cookies para exibir anúncios relevantes com base nas suas visitas anteriores ao nosso site ou a outros sites na internet.
            </li>
            <li>
              <strong>Seu Controle:</strong> Você pode desativar o uso de cookies de publicidade personalizada acessando as "Configurações de Anúncios" da sua conta Google, ou configurar o seu próprio navegador para bloquear todos os cookies.
            </li>
          </ul>
        </article>
      </div>
    </section>

    <footer class="terms-contact-box">
      <p class="terms-contact-text">
        <strong>Contato:</strong> Para dúvidas sobre impacto social, parcerias com o poder público ou sobre nossa atuação, entre em contato pelo e-mail:
        <a href="mailto:multei@valepcd.com.br" class="terms-doc-link">multei@valepcd.com.br</a>
      </p>
    </footer>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    headingTag?: 'h1' | 'h2';
    titleId?: string;
  }>(),
  {
    headingTag: 'h1',
    titleId: 'multei-terms-main-title'
  }
);

defineEmits<{
  (e: 'navigate-map'): void;
}>();
</script>

<style scoped>
.multei-terms-doc {
  --td-text-primary: #0f172a;
  --td-text-secondary: #334155;
  --td-surface: #ffffff;
  --td-surface-alt: #f8fafc;
  --td-border: #cbd5e1;
  --td-accent: #6b0064;
  --td-tag-bg: rgba(134, 0, 125, 0.1);
  --td-tag-text: #580052;

  display: flex;
  flex-direction: column;
  gap: 2rem;
  color: var(--td-text-primary);
}

:global([data-theme="dark"]) .multei-terms-doc,
:global(.theme-dark) .multei-terms-doc {
  --td-text-primary: #f8fafc;
  --td-text-secondary: #cbd5e1;
  --td-surface: #171c26;
  --td-surface-alt: #0f131a;
  --td-border: #334155;
  --td-accent: #f0abfc;
  --td-tag-bg: rgba(240, 171, 252, 0.14);
  --td-tag-text: #f5d0fe;
}

.terms-doc-header {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.terms-doc-main-title {
  font-size: clamp(1.45rem, 3.2vw, 2.15rem);
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.015em;
  color: var(--td-text-primary);
  margin: 0;
}

.terms-doc-lead,
.terms-doc-consent,
.terms-part-intro {
  font-size: 1rem;
  line-height: 1.7;
  color: var(--td-text-secondary);
  margin: 0;
}

.terms-doc-consent {
  font-weight: 600;
  color: var(--td-text-primary);
  padding: 0.85rem 1.1rem;
  border-radius: 12px;
  background: var(--td-surface-alt);
  border-left: 4px solid var(--td-accent);
}

.terms-doc-link {
  color: var(--td-accent);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.terms-part-section {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
  scroll-margin-top: 96px;
}

.terms-part-banner {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid var(--td-border);
}

.terms-part-tag {
  display: inline-block;
  font-size: 0.74rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.25rem 0.7rem;
  border-radius: 9999px;
  background: var(--td-tag-bg);
  color: var(--td-tag-text);
}

.terms-part-title {
  font-size: clamp(1.2rem, 2.4vw, 1.5rem);
  font-weight: 800;
  color: var(--td-text-primary);
  margin: 0;
}

.terms-clauses-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.terms-clause-card {
  background: var(--td-surface);
  border: 1.5px solid var(--td-border);
  border-radius: 16px;
  padding: 1.35rem 1.45rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.terms-clause-title {
  font-size: 1.06rem;
  font-weight: 800;
  color: var(--td-text-primary);
  margin: 0;
  line-height: 1.35;
}

.terms-clause-card p {
  margin: 0;
  font-size: 0.96rem;
  line-height: 1.68;
  color: var(--td-text-secondary);
}

.terms-subitems {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.terms-subitems li {
  font-size: 0.96rem;
  line-height: 1.68;
  color: var(--td-text-secondary);
}

.terms-subitems strong,
.terms-contact-text strong {
  color: var(--td-text-primary);
}

.terms-contact-box {
  background: var(--td-surface-alt);
  border: 1.5px solid var(--td-border);
  border-radius: 16px;
  padding: 1.25rem 1.45rem;
}

.terms-contact-text {
  margin: 0;
  font-size: 0.98rem;
  line-height: 1.65;
  color: var(--td-text-secondary);
}

@media (max-width: 640px) {
  .terms-clause-card,
  .terms-contact-box {
    padding: 1.1rem 1.05rem;
  }
}
</style>

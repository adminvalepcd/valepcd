<template>
  <div class="privacy-page container">
    <!-- Portuguese Template -->
    <section v-if="locale === 'pt'" class="section privacy-section" aria-labelledby="privacy-title-pt">
      <span class="badge">Termos e Diretrizes</span>
      <h1 id="privacy-title-pt" class="title">
        Política de <span class="gradient-text">Privacidade</span> e Cookies
      </h1>
      
      <div class="privacy-meta text-muted">
        <p><strong>Última atualização:</strong> Novembro de 2023</p>
      </div>

      <div class="grid-layout">
        <div class="content-rich text-muted">
          <p class="intro-lead">
            Na Vale PCD, respeitamos a sua privacidade e protegemos seus dados. Elaboramos este documento para explicar como tratamos e protegemos os Dados Pessoais, quais são seus direitos e como você pode exercê-los. Se tiver dúvidas, por favor, entre em contato pelos canais indicados no item 9 desta Política de Privacidade e Cookies.
          </p>

          <nav class="index-box glass" aria-label="Sumário da política de privacidade">
            <h2 class="index-title">Navegue pelos tópicos:</h2>
            <ol class="index-list">
              <li><a href="#item-1-pt" class="index-link">1. Conceitos Básicos: O que você precisa saber para entender esta Política</a></li>
              <li><a href="#item-2-pt" class="index-link">2. Como a Vale PCD coleta Dados Pessoais</a></li>
              <li><a href="#item-3-pt" class="index-link">3. Quais dados são tratados e para quais finalidades</a></li>
              <li><a href="#item-4-pt" class="index-link">4. Com quem a Vale PCD compartilha dados</a></li>
              <li><a href="#item-5-pt" class="index-link">5. Quando a Vale PCD transfere dados para outros países</a></li>
              <li><a href="#item-6-pt" class="index-link">6. Quais são os direitos do titular de dados</a></li>
              <li><a href="#item-7-pt" class="index-link">7. Por quanto tempo os dados serão armazenados</a></li>
              <li><a href="#item-8-pt" class="index-link">8. Quais são as responsabilidades da Vale PCD e como os seus dados são protegidos</a></li>
              <li><a href="#item-9-pt" class="index-link">9. Como falar com a Vale PCD sobre seus dados</a></li>
              <li><a href="#item-10-pt" class="index-link">10. Como e quando esta Política pode ser alterada</a></li>
            </ol>
          </nav>

          <div class="policy-clauses">
            <article id="item-1-pt" class="policy-article">
              <h2>1. Conceitos Básicos: O que você precisa saber para entender esta Política</h2>
              <p>
                Você tem direito à privacidade e à proteção dos seus dados pessoais. Para ajudar nisso, apresentamos alguns conceitos essenciais:
              </p>
              <ul>
                <li><strong>Bases Legais:</strong> São as razões legais que autorizam o tratamento de Dados Pessoais, como consentimento, cumprimento de contrato ou obrigação legal.</li>
                <li><strong>Cookies:</strong> Pequenos arquivos que ajudam a entender como você interage com as plataformas da Vale PCD, tornando a experiência mais eficiente.</li>
                <li><strong>Dados de Analytics:</strong> Informações sobre o uso dos sites e aplicativos para compreender o comportamento dos usuários.</li>
                <li><strong>Dados do Dispositivo de Acesso:</strong> Informações coletadas por cookies ou tecnologias similares, como IP, data e hora de acesso, localização, tipo de navegador.</li>
                <li><strong>Dado Pessoal:</strong> Informação que identifica uma pessoa, como nome, RG, CPF, telefone ou e-mail.</li>
                <li><strong>Plataformas:</strong> Aplicativos, sites e plataformas da Vale PCD.</li>
              </ul>
            </article>

            <article id="item-2-pt" class="policy-article">
              <h2>2. Como a Vale PCD coleta Dados Pessoais</h2>
              <p>
                Seus dados são coletados ao interagir conosco, como preenchimento de formulários, contato, compras, participação em eventos ou uso de nossos serviços. Também coletamos dados por meio de cookies, essenciais para funcionalidades do site.
              </p>
            </article>

            <article id="item-3-pt" class="policy-article">
              <h2>3. Quais dados são tratados e para quais finalidades</h2>
              <p>
                Tratamos dados como nome, e-mail, CPF, dados de navegação, dados de pagamento, entre outros. As finalidades incluem acesso às plataformas, analytics, marketing, entre outros, sempre com bases legais adequadas.
              </p>
            </article>

            <article id="item-4-pt" class="policy-article">
              <h2>4. Com quem a Vale PCD compartilha os seus dados</h2>
              <p>
                Não compartilhamos seus dados com nenhuma empresa ou parceiros da Vale PCD, sempre respeitando as bases legais e garantindo a proteção dos seus dados.
              </p>
            </article>

            <article id="item-5-pt" class="policy-article">
              <h2>5. Quando a Vale PCD transfere dados para outros países</h2>
              <p>
                Podemos transferir dados para outros países com proteção adequada, sempre em conformidade com a legislação de proteção de dados.
              </p>
            </article>

            <article id="item-6-pt" class="policy-article">
              <h2>6. Quais são os direitos do titular de dados</h2>
              <p>
                Você tem direito de confirmar, acessar, retificar, excluir, opor, solicitar anonimização, bloqueio, eliminação, portabilidade, retirar consentimento e obter informações sobre o uso compartilhado de dados - realize sua solicitação através da página de <NuxtLink :to="localePath('/contato')" class="link-underlined">Fale Conosco</NuxtLink>.
              </p>
            </article>

            <article id="item-7-pt" class="policy-article">
              <h2>7. Por quanto tempo os dados serão armazenados</h2>
              <p>
                Os dados são mantidos pelo tempo necessário para cumprir as finalidades, inclusive obrigações legais.
              </p>
            </article>

            <article id="item-8-pt" class="policy-article">
              <h2>8. Quais são as responsabilidades da Vale PCD e como os seus dados são protegidos</h2>
              <p>
                Implementamos medidas técnicas e organizacionais para proteger seus dados contra incidentes de segurança. Apesar disso, não podemos garantir total segurança devido a fatores externos.
              </p>
            </article>

            <article id="item-9-pt" class="policy-article">
              <h2>9. Como falar com a Vale PCD sobre seus Dados</h2>
              <p>
                Se tiver dúvidas, entre em contato através de nossa página de <NuxtLink :to="localePath('/contato')" class="link-underlined">Fale Conosco</NuxtLink>.
              </p>
            </article>

            <article id="item-10-pt" class="policy-article">
              <h2>10. Como e quando esta Política pode ser alterada</h2>
              <p>
                Esta Política pode passar por atualizações. Alterações relevantes serão informadas.
              </p>
            </article>

            <div class="policy-signature">
              <p><strong>Vale PCD</strong>, novembro de 2023.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- English Template -->
    <section v-else-if="locale === 'en'" class="section privacy-section" aria-labelledby="privacy-title-en">
      <span class="badge">Terms & Guidelines</span>
      <h1 id="privacy-title-en" class="title">
        Privacy and <span class="gradient-text">Cookies</span> Policy
      </h1>
      
      <div class="privacy-meta text-muted">
        <p><strong>Last updated:</strong> November 2023</p>
      </div>

      <div class="grid-layout">
        <div class="content-rich text-muted">
          <p class="intro-lead">
            At Vale PCD, we respect your privacy and protect your personal data. We have drafted this document to explain how we process and protect your Personal Data, what your rights are, and how you can exercise them. If you have any questions, please contact us through the channels indicated in Section 9 of this Privacy and Cookies Policy.
          </p>

          <nav class="index-box glass" aria-label="Privacy policy summary">
            <h2 class="index-title">Table of Contents:</h2>
            <ol class="index-list">
              <li><a href="#item-1-en" class="index-link">1. Basic Concepts: What you need to know to understand this Policy</a></li>
              <li><a href="#item-2-en" class="index-link">2. How Vale PCD collects Personal Data</a></li>
              <li><a href="#item-3-en" class="index-link">3. What data is processed and for what purposes</a></li>
              <li><a href="#item-4-en" class="index-link">4. Who Vale PCD shares data with</a></li>
              <li><a href="#item-5-en" class="index-link">5. When Vale PCD transfers data to other countries</a></li>
              <li><a href="#item-6-en" class="index-link">6. What are the rights of the data subject</a></li>
              <li><a href="#item-7-en" class="index-link">7. How long the data will be stored</a></li>
              <li><a href="#item-8-en" class="index-link">8. What are the responsibilities of Vale PCD and how your data is protected</a></li>
              <li><a href="#item-9-en" class="index-link">9. How to contact Vale PCD about your data</a></li>
              <li><a href="#item-10-en" class="index-link">10. How and when this Policy can be modified</a></li>
            </ol>
          </nav>

          <div class="policy-clauses">
            <article id="item-1-en" class="policy-article">
              <h2>1. Basic Concepts: What you need to know to understand this Policy</h2>
              <p>
                You have the right to privacy and the protection of your personal data. To help with this, we present some essential concepts:
              </p>
              <ul>
                <li><strong>Legal Bases:</strong> These are the legal grounds that authorize the processing of Personal Data, such as consent, contract performance, or legal obligation.</li>
                <li><strong>Cookies:</strong> Small files that help understand how you interact with Vale PCD's platforms, making your experience more efficient.</li>
                <li><strong>Analytics Data:</strong> Information about the use of websites and applications to understand user behavior.</li>
                <li><strong>Access Device Data:</strong> Information collected by cookies or similar technologies, such as IP address, date and time of access, location, and browser type.</li>
                <li><strong>Personal Data:</strong> Information that identifies a person, such as name, ID, CPF, phone number, or email.</li>
                <li><strong>Platforms:</strong> Vale PCD's applications, websites, and platforms.</li>
              </ul>
            </article>

            <article id="item-2-en" class="policy-article">
              <h2>2. How Vale PCD collects Personal Data</h2>
              <p>
                Your data is collected when you interact with us, such as when filling out forms, contacting us, making purchases, participating in events, or using our services. We also collect data through cookies, which are essential for website functionality.
              </p>
            </article>

            <article id="item-3-en" class="policy-article">
              <h2>3. What data is processed and for what purposes</h2>
              <p>
                We process data such as name, email, CPF, browsing data, payment data, among others. Purposes include accessing platforms, analytics, marketing, among others, always under the appropriate legal bases.
              </p>
            </article>

            <article id="item-4-en" class="policy-article">
              <h2>4. Who Vale PCD shares data with</h2>
              <p>
                We do not share your data with any company or partners of Vale PCD, always respecting legal bases and ensuring the protection of your data.
              </p>
            </article>

            <article id="item-5-en" class="policy-article">
              <h2>5. When Vale PCD transfers data to other countries</h2>
              <p>
                We may transfer data to other countries with adequate protection, always in compliance with data protection laws.
              </p>
            </article>

            <article id="item-6-en" class="policy-article">
              <h2>6. What are the rights of the data subject</h2>
              <p>
                You have the right to confirm, access, rectify, delete, object, request anonymization, blocking, elimination, portability, withdraw consent, and obtain information about the shared use of data. Please submit your request through our <NuxtLink :to="localePath('/contato')" class="link-underlined">Contact Us</NuxtLink> page.
              </p>
            </article>

            <article id="item-7-en" class="policy-article">
              <h2>7. How long the data will be stored</h2>
              <p>
                Data is kept for as long as necessary to fulfill the purposes, including legal obligations.
              </p>
            </article>

            <article id="item-8-en" class="policy-article">
              <h2>8. What are the responsibilities of Vale PCD and how your data is protected</h2>
              <p>
                We implement technical and organizational measures to protect your data against security incidents. Despite this, we cannot guarantee absolute security due to external factors.
              </p>
            </article>

            <article id="item-9-en" class="policy-article">
              <h2>9. How to contact Vale PCD about your data</h2>
              <p>
                If you have any questions, please get in touch through our <NuxtLink :to="localePath('/contato')" class="link-underlined">Contact Us</NuxtLink> page.
              </p>
            </article>

            <article id="item-10-en" class="policy-article">
              <h2>10. How and when this Policy can be modified</h2>
              <p>
                This Policy may undergo updates. Relevant changes will be communicated.
              </p>
            </article>

            <div class="policy-signature">
              <p><strong>Vale PCD</strong>, November 2023.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Spanish Template -->
    <section v-else-if="locale === 'es'" class="section privacy-section" aria-labelledby="privacy-title-es">
      <span class="badge">Términos y Directrices</span>
      <h1 id="privacy-title-es" class="title">
        Política de <span class="gradient-text">Privacidad</span> y Cookies
      </h1>
      
      <div class="privacy-meta text-muted">
        <p><strong>Última actualización:</strong> Noviembre de 2023</p>
      </div>

      <div class="grid-layout">
        <div class="content-rich text-muted">
          <p class="intro-lead">
            En Vale PCD, respetamos su privacidad y protegemos sus datos personales. Hemos redactado este documento para explicar cómo tratamos y protegemos sus Datos Personales, cuáles son sus derechos y cómo puede ejercerlos. Si tiene alguna pregunta, póngase en contacto con nosotros a través de los canales indicados en la Sección 9 de esta Política de Privacidad y Cookies.
          </p>

          <nav class="index-box glass" aria-label="Sumario de la política de privacidad">
            <h2 class="index-title">Tabla de Contenidos:</h2>
            <ol class="index-list">
              <li><a href="#item-1-es" class="index-link">1. Conceptos Básicos: Lo que necesita saber para entender esta Política</a></li>
              <li><a href="#item-2-es" class="index-link">2. Cómo recolecta Vale PCD los Datos Personales</a></li>
              <li><a href="#item-3-es" class="index-link">3. Qué datos se tratan y para qué fines</a></li>
              <li><a href="#item-4-es" class="index-link">4. Con quién comparte Vale PCD sus datos</a></li>
              <li><a href="#item-5-es" class="index-link">5. Cuándo transfiere Vale PCD datos a otros países</a></li>
              <li><a href="#item-6-es" class="index-link">6. Cuáles son los derechos del titular de los datos</a></li>
              <li><a href="#item-7-es" class="index-link">7. Por cuánto tiempo se almacenarán los datos</a></li>
              <li><a href="#item-8-es" class="index-link">8. Cuáles son las responsabilidades de Vale PCD y cómo se protegen sus datos</a></li>
              <li><a href="#item-9-es" class="index-link">9. Cómo hablar con Vale PCD sobre sus datos</a></li>
              <li><a href="#item-10-es" class="index-link">10. Cómo y cuándo se puede modificar esta Política</a></li>
            </ol>
          </nav>

          <div class="policy-clauses">
            <article id="item-1-es" class="policy-article">
              <h2>1. Conceptos Básicos: Lo que necesita saber para entender esta Política</h2>
              <p>
                Tiene derecho a la privacidad y a la protección de sus datos personales. Para ayudar a comprenderlo, presentamos algunos conceptos esenciales:
              </p>
              <ul>
                <li><strong>Bases Legales:</strong> Son los fundamentos legales que autorizan el tratamiento de Datos Personales, como el consentimiento, la ejecución de un contrato o una obligación legal.</li>
                <li><strong>Cookies:</strong> Pequeños archivos que ayudan a entender cómo interactúa con las plataformas de Vale PCD, haciendo que su experiencia sea más eficiente.</li>
                <li><strong>Datos de Analytics:</strong> Información sobre el uso de los sitios web y aplicaciones para comprender el comportamiento de los usuarios.</li>
                <li><strong>Datos del Dispositivo de Acceso:</strong> Información recopilada por cookies o tecnologías similares, como IP, fecha y hora de acceso, ubicación y tipo de navegador.</li>
                <li><strong>Datos Personales:</strong> Información que identifica a una persona, como nombre, documento de identidad, CPF, teléfono o correo electrónico.</li>
                <li><strong>Plataformas:</strong> Aplicaciones, sitios web y plataformas de Vale PCD.</li>
              </ul>
            </article>

            <article id="item-2-es" class="policy-article">
              <h2>2. Cómo recolecta Vale PCD los Datos Personales</h2>
              <p>
                Sus datos se recopilan al interactuar con nosotros, como al completar formularios, ponerse en contacto, realizar compras, participar en eventos o utilizar nuestros servicios. También recopilamos datos a través de cookies, que son esenciales para la funcionalidad del sitio web.
              </p>
            </article>

            <article id="item-3-es" class="policy-article">
              <h2>3. Qué datos se tratan y para qué fines</h2>
              <p>
                Tratamos datos como nombre, correo electrónico, CPF, datos de navegación, datos de pago, entre otros. Los fines incluyen el acceso a las plataformas, análisis, marketing, entre otros, siempre bajo las bases legales adecuadas.
              </p>
            </article>

            <article id="item-4-es" class="policy-article">
              <h2>4. Con quién comparte Vale PCD sus datos</h2>
              <p>
                No compartimos sus datos con ninguna empresa o socio de Vale PCD, respetando siempre las bases legales y garantizando la protección de sus datos.
              </p>
            </article>

            <article id="item-5-es" class="policy-article">
              <h2>5. Cuándo transfiere Vale PCD datos a otros países</h2>
              <p>
                Podemos transferir datos a otros países con la protección adecuada, siempre en conformidad con las leyes de protección de datos.
              </p>
            </article>

            <article id="item-6-es" class="policy-article">
              <h2>6. Cuáles son los derechos del titular de los datos</h2>
              <p>
                Tiene derecho a confirmar, acceder, rectificar, eliminar, oponerse, solicitar la anonimización, bloqueo, eliminación, portabilidad, retirar el consentimiento y obtener información sobre el uso compartido de datos; realice su solicitud a través de nuestra página de <NuxtLink :to="localePath('/contato')" class="link-underlined">Contacto</NuxtLink>.
              </p>
            </article>

            <article id="item-7-es" class="policy-article">
              <h2>7. Por cuánto tempo se almacenarán los datos</h2>
              <p>
                Los datos se conservan durante el tiempo necesario para cumplir con los fines previstos, incluidas las obligaciones legales.
              </p>
            </article>

            <article id="item-8-es" class="policy-article">
              <h2>8. Cuáles son las responsabilidades de Vale PCD y cómo se protegen sus datos</h2>
              <p>
                Implementamos medidas técnicas y organizativas para proteger sus datos contra incidentes de seguridad. A pesar de ello, no podemos garantizar una seguridad absoluta debido a factores externos.
              </p>
            </article>

            <article id="item-9-es" class="policy-article">
              <h2>9. Cómo hablar con Vale PCD sobre sus datos</h2>
              <p>
                Si tiene alguna duda, póngase en contacto con nosotros a través de nuestra página de <NuxtLink :to="localePath('/contato')" class="link-underlined">Contacto</NuxtLink>.
              </p>
            </article>

            <article id="item-10-es" class="policy-article">
              <h2>10. Cómo y cuándo se puede modificar esta Política</h2>
              <p>
                Esta Política puede sufrir actualizaciones. Las modificaciones relevantes serán comunicadas.
              </p>
            </article>

            <div class="policy-signature">
              <p><strong>Vale PCD</strong>, noviembre de 2023.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
const { locale } = useI18n()
const localePath = useLocalePath()

// Dynamic SEO Meta Tags based on locale
const seoMap = {
  pt: {
    title: 'Política de Privacidade e Cookies | Vale PCD',
    description: 'Conheça como a ONG Vale PCD coleta, protege e utiliza seus dados pessoais em conformidade com a LGPD.'
  },
  en: {
    title: 'Privacy and Cookies Policy | Vale PCD',
    description: 'Learn how the NGO Vale PCD collects, protects, and uses your personal data in compliance with LGPD.'
  },
  es: {
    title: 'Política de Privacidad y Cookies | Vale PCD',
    description: 'Conozca cómo la ONG Vale PCD recopila, protege y utiliza sus datos personales en conformidad con la LGPD.'
  }
}

useSeoMeta({
  title: () => seoMap[locale.value]?.title || seoMap.pt.title,
  description: () => seoMap[locale.value]?.description || seoMap.pt.description
})
</script>

<style scoped>
.privacy-page {
  padding: 3rem 1rem 6rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 4rem;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.title {
  font-size: clamp(2rem, 4vw, 3.2rem);
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: -0.02em;
  max-width: 900px;
}

.privacy-meta {
  font-size: 1rem;
  border-left: 3px solid var(--primary);
  padding-left: 1rem;
  margin-top: -1rem;
}

.intro-lead {
  font-size: 1.25rem;
  line-height: 1.7;
  color: var(--text);
  margin-bottom: 2.5rem;
}

.content-rich {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.index-box {
  padding: 2rem;
  border-radius: var(--radius-lg);
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(18, 22, 33, 0.4);
}

.index-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 1.2rem;
}

.index-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.index-link {
  color: var(--primary);
  font-size: 1rem;
  text-decoration: none;
  transition: color var(--transition-fast);
  font-weight: 500;
}

.index-link:hover {
  color: var(--secondary);
}

.policy-clauses {
  display: flex;
  flex-direction: column;
  gap: 3.5rem;
  margin-top: 2rem;
}

.policy-article {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  scroll-margin-top: 100px;
}

.policy-article h2 {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.5rem;
}

.policy-article p {
  font-size: 1.1rem;
  line-height: 1.7;
}

.policy-article ul {
  list-style-type: disc;
  padding-left: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.policy-article li {
  font-size: 1.05rem;
  line-height: 1.6;
}

.link-underlined {
  color: var(--secondary);
  text-decoration: none;
  font-weight: 600;
  border-bottom: 2px solid rgba(219, 39, 119, 0.2);
  transition: border-color var(--transition-fast);
}

.link-underlined:hover {
  border-color: var(--secondary);
}

.policy-signature {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px dashed var(--border);
  font-size: 1.1rem;
}
</style>

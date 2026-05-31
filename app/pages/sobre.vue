<template>
  <div class="sobre-page container">
    <section class="section history-section" aria-labelledby="sobre-title">
      <span class="badge">Nossa História</span>
      <h1 id="sobre-title" class="title">
        Tudo começou em <span class="gradient-text">2020</span> com o desejo de transformar a realidade das pessoas LGBTI+ com deficiência
      </h1>
      
      <div class="grid-layout">
        <div class="content-rich text-muted">
          <p>
            O <strong>Vale PCD</strong> surgiu a partir da inquietação de não existir um coletivo que falasse sobre a interseccionalidade das pessoas com deficiência que são LGBTQIA+, além de não ser um assunto levado em consideração dentro da comunidade.
          </p>
          <p>
            Conseguimos criar forma dentro do programa de embaixadores da <a href="https://www.todxs.org/" target="_blank" rel="noreferrer noopener" class="link-underlined">TODXS Brasil</a>, em 2019. Em 2020, com o apoio do Programa Impacto, lançamos o Vale e conseguimos recursos para impulsionar o projeto.
          </p>
          <p>
            Hoje, toda a nossa diretoria e produtores de conteúdo são formados por PCDs LGBTQIA+ e somos referência em inclusão e em trabalhos direcionados para os dois recortes.
          </p>
        </div>
        
        <div class="info-box glass">
          <div class="info-item">
            <h3>Nossa Missão</h3>
            <p>Promover a visibilidade e a inclusão das pessoas com deficiência LGBTI+ dentro da comunidade, por meio de projetos e da conscientização nas redes sociais.</p>
          </div>
          
          <div class="info-item">
            <h3>Nossa Visão</h3>
            <p>Ser referência em acessibilidade e empoderar pessoas com deficiência LGBTI+ a socializar com a comunidade ocupando espaços para que possam ser vistas e incluídas.</p>
          </div>

          <div class="info-item">
            <h3>Nossos Valores</h3>
            <p>Respeitar a pluralidade e enfatizar o protagonismo dos sujeitos, enquanto seres sociais e interseccionais.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="section team-section" aria-labelledby="team-title">
      <div class="text-center">
        <span class="badge">Quem Faz Acontecer</span>
        <h2 id="team-title" class="section-title">Nossa Equipe</h2>
      </div>
      
      <div class="team-grid">
        <div class="team-card glass" v-for="member in team" :key="member.name">
          <div class="avatar-container">
            <img :src="member.image" :alt="'Foto de ' + member.name" class="avatar" loading="lazy" />
            <div class="avatar-gradient"></div>
          </div>
          <h3 class="member-name">{{ member.name }}</h3>
          <p class="member-role" v-if="member.role">{{ member.role }}</p>
        </div>
      </div>
    </section>

    <section class="section media-section" aria-labelledby="media-title">
      <div class="media-card glass">
        <div class="media-content">
          <span class="badge">Na Mídia</span>
          <h2 id="media-title" class="media-heading">Entrevista com Priscila Siqueira</h2>
          <p class="text-muted">
            Confira a entrevista realizada pela <strong>TV Pernambuco</strong> com Priscila Siqueira, uma das idealizadoras do projeto Vale PCD, falando sobre inclusão, representatividade e a história do coletivo.
          </p>
          <div class="media-action">
            <a href="https://www.youtube.com/@pcdvale" target="_blank" rel="noreferrer noopener" class="btn btn-primary">
              <span>Assistir no Canal do YouTube</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
const team = [
  {
    name: 'Alexsandro Sousa',
    role: 'Co-idealizador & Diretor',
    image: 'https://static.wixstatic.com/media/acd625_e33e0b315b3a449aa072037cb98aeda1~mv2.jpeg/v1/crop/x_43,y_279,w_857,h_857/fill/w_200,h_200,al_c,q_80,usm_0.66_1.00_0.01/WhatsApp%20Image%202022-09-26%20at%2013_33_14.jpeg'
  },
  {
    name: 'Beto Maia',
    role: 'Co-idealizador & Diretor',
    image: 'https://static.wixstatic.com/media/acd625_0e753b340d274702a062918b66a8305f~mv2.jpeg/v1/crop/x_48,y_530,w_605,h_604/fill/w_200,h_200,al_c,q_80,usm_0.66_1.00_0.01/WhatsApp%20Image%202022-08-29%20at%2014_23_40.jpeg'
  },
  {
    name: 'Jonas Marssaro',
    role: 'Co-idealizador & Diretor',
    image: 'https://static.wixstatic.com/media/acd625_79ce0c1d8c7547deb58e28e14906ebcf~mv2.jpeg/v1/crop/x_0,y_163,w_970,h_970/fill/w_200,h_200,al_c,q_80,usm_0.66_1.00_0.01/WhatsApp%20Image%202022-10-06%20at%2022_01_25.jpeg'
  },
  {
    name: 'Priscila Siqueira',
    role: 'Co-idealizadora & Diretora',
    image: 'https://static.wixstatic.com/media/acd625_94ca0b765630455488fe4e7c377bb1ac~mv2.jpeg/v1/crop/x_51,y_84,w_922,h_922/fill/w_200,h_200,al_c,q_80,usm_0.66_1.00_0.01/WhatsApp%20Image%202022-09-22%20at%2009_08_50%20(1).jpeg'
  }
]
</script>

<style scoped>
.sobre-page {
  padding: 3rem 1rem 6rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 6rem;
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

.grid-layout {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 4rem;
  align-items: start;
}

@media (max-width: 960px) {
  .grid-layout {
    grid-template-columns: 1fr;
    gap: 3rem;
  }
}

.content-rich {
  display: flex;
  flex-direction: column;
  gap: 1.8rem;
}

.content-rich p {
  font-size: 1.2rem;
  line-height: 1.8;
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

.info-box {
  padding: 2.5rem;
  border-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  background: linear-gradient(135deg, rgba(109, 40, 217, 0.03), rgba(219, 39, 119, 0.03));
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.info-item h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--primary);
  margin-bottom: 0.6rem;
  letter-spacing: -0.01em;
}

.info-item p {
  font-size: 1.05rem;
  line-height: 1.6;
  color: var(--text-muted);
}

/* Team Section */
.text-center {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.section-title {
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  font-weight: 800;
  letter-spacing: -0.01em;
}

.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 2.5rem;
}

.team-card {
  padding: 2rem;
  border-radius: var(--radius-xl);
  text-align: center;
  transition: transform var(--transition-normal), box-shadow var(--transition-normal);
  border: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.team-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
}

.avatar-container {
  position: relative;
  width: 150px;
  height: 150px;
  margin-bottom: 1.5rem;
  border-radius: 50%;
  overflow: hidden;
  padding: 4px;
  background: linear-gradient(135deg, var(--primary), var(--secondary));
}

.avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  border: 4px solid var(--bg);
}

.avatar-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.4));
  pointer-events: none;
  border-radius: 50%;
}

.member-name {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0.4rem;
}

.member-role {
  font-size: 0.95rem;
  color: var(--text-muted);
}

/* Media Section */
.media-card {
  border-radius: var(--radius-2xl);
  padding: 4rem 3rem;
  background: linear-gradient(135deg, rgba(109, 40, 217, 0.05), rgba(219, 39, 119, 0.02));
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.media-content {
  max-width: 750px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  align-items: center;
  text-align: center;
}

.media-heading {
  font-size: clamp(1.6rem, 2.5vw, 2.2rem);
  font-weight: 800;
  margin-top: 0.5rem;
}

.media-content p {
  font-size: 1.15rem;
  line-height: 1.7;
}

.media-action {
  margin-top: 1.5rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.8rem 2rem;
  border-radius: var(--radius-lg);
  font-weight: 600;
  text-decoration: none;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  color: #ffffff;
  box-shadow: 0 8px 20px rgba(109, 40, 217, 0.25);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(109, 40, 217, 0.35);
}
</style>


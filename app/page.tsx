import Film from "@/components/film/Film";
import CoffeeSpill from "@/components/CoffeeSpill";
import ScrollEffects from "@/components/ScrollEffects";
import SmoothScroll from "@/components/SmoothScroll";
import SoisSymbol from "@/components/SoisSymbol";

const MANIFESTO =
  "Dois sóis se encontrando como um só. Quatro amigos, quatro histórias e um destino em comum: servir café com a energia e o calor únicos de Goa.";

const VALORES = ["Amizade", "Conexão", "Energia", "Tropical", "Elegância", "Autenticidade", "Naturalidade"];

// Cardápio provisório — substituir quando o menu oficial ficar pronto.
const CARDAPIO = [
  { nome: "Espresso Sóis", desc: "Blend da casa, curto e intenso, com notas de cacau e caramelo.", tag: "Quente" },
  { nome: "Cold Brew da Casa", desc: "Extração a frio por 18 horas, servido sobre gelo cristalino.", tag: "Gelado" },
  { nome: "Latte de Coco", desc: "Espresso, leite vaporizado e coco tostado de Goa.", tag: "Assinatura" },
  { nome: "Mocha de Cardamomo", desc: "Chocolate meio amargo, espresso e um toque de cardamomo.", tag: "Assinatura" },
  { nome: "Cappuccino", desc: "Espresso, leite e espuma sedosa na medida certa.", tag: "Quente" },
  { nome: "Espresso Tônica", desc: "Tônica gelada, laranja e um shot de espresso por cima.", tag: "Gelado" },
];

function Marquee() {
  const items = [...VALORES, ...VALORES];
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee__track">
        {[0, 1].map((k) => (
          <div className="marquee__group" key={k}>
            {items.map((v, i) => (
              <span key={i}>
                {v}
                <SoisSymbol className="marquee__sun" topColor="currentColor" bottomColor="currentColor" strokeWidth={9} />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <SmoothScroll />
      <ScrollEffects />

      <header className="nav">
        <a className="nav__brand" href="#inicio" aria-label="Sóis — início">
          <SoisSymbol className="nav__symbol" strokeWidth={9} />
          <span>SÓIS</span>
        </a>
        <nav className="nav__links" aria-label="Principal">
          <a href="#copo">A casa</a>
          <a href="#manifesto">Manifesto</a>
          <a href="#cardapio">Cardápio</a>
          <a href="#visite">Visite</a>
        </nav>
        <a className="btn btn--small btn--bordo" href="#cardapio">
          Cardápio
        </a>
      </header>

      <main>
        <Film />

        {/* 03 — O copo (cena 3b provisória: foto da marca até chegar o vídeo em alta) */}
        <section className="copo" id="copo">
          <div className="copo__media">
            <img data-zoom src="/img/copos-padrao.jpg" alt="Cold brew no copo bordô da Sóis com o padrão de sóis" />
          </div>
          <div className="copo__text">
            <p className="kicker kicker--light" data-reveal>
              06 — A casa veste bordô
            </p>
            <h2 className="display display--light" data-reveal="0.1">
              Nosso sol
              <br />
              <em>em cada copo.</em>
            </h2>
            <p className="lead lead--light" data-reveal="0.2">
              Bordô, creme e o símbolo de dois sóis que viraram um. Cada copo que sai do balcão leva um pedaço da
              nossa história.
            </p>
          </div>
        </section>

        <Marquee />

        <section className="manifesto" id="manifesto">
          <SoisSymbol className="manifesto__symbol" />
          <p className="kicker" data-reveal>
            Manifesto
          </p>
          <p className="manifesto__text" data-words>
            {MANIFESTO.split(" ").map((w, i) => (
              <span className="w" key={i}>
                {w}{" "}
              </span>
            ))}
          </p>
          <p className="manifesto__sign" data-reveal>
            Good coffee · Bright people · Same sun
          </p>
        </section>

        <CoffeeSpill />

        <section className="cardapio" id="cardapio">
          <div className="cardapio__head">
            <p className="kicker kicker--light" data-reveal>
              07 — Para beber
            </p>
            <h2 className="display display--light" data-reveal="0.1">
              Cardápio
            </h2>
            <p className="cardapio__note" data-reveal="0.2">
              Prévia — o cardápio completo chega em breve.
            </p>
          </div>
          <ul className="cardapio__grid">
            {CARDAPIO.map((item, i) => (
              <li className="card" key={item.nome} data-reveal={(i % 3) * 0.08}>
                <SoisSymbol className="card__sun" />
                <span className="card__tag">{item.tag}</span>
                <h3 className="card__name">{item.nome}</h3>
                <p className="card__desc">{item.desc}</p>
              </li>
            ))}
          </ul>
          <div className="cardapio__photo">
            <img data-parallax="8" src="/img/copos-mesa.jpg" alt="Copo plástico com cold brew, copo bordô e cardápio da Sóis" />
          </div>
        </section>

        <section className="casa" id="visite">
          <div className="casa__media">
            <img data-parallax="10" src="/img/casa-placa.jpg" alt="Placa redonda da Sóis na fachada, com palmeiras e o mar ao fundo" />
          </div>
          <div className="casa__card" data-reveal>
            <p className="kicker">08 — Visite</p>
            <h2 className="display">
              Sob o sol
              <br />
              <em>de Goa.</em>
            </h2>
            <dl className="casa__info">
              <div>
                <dt>Endereço</dt>
                <dd>Em breve</dd>
              </div>
              <div>
                <dt>Horário</dt>
                <dd>Em breve</dd>
              </div>
            </dl>
            <div className="casa__actions">
              <a className="btn btn--bordo" href="#" aria-disabled="true">
                Como chegar
              </a>
              <a className="btn btn--ghost" href="#" aria-disabled="true">
                Instagram
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <SoisSymbol className="footer__symbol" topColor="var(--laranja)" bottomColor="var(--creme)" />
        <p className="footer__brand">SÓIS</p>
        <p className="footer__sub">
          Café <i aria-hidden="true">·</i> Goa
        </p>
        <p className="footer__slogan">Good coffee, bright people, same sun.</p>
        <p className="footer__legal">© {new Date().getFullYear()} Sóis Café · Goa</p>
      </footer>
    </>
  );
}

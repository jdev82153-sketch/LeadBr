const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

/* =========================================================
   LEAD BR
   Frontend + busca real através de /api/leads na Vercel
   A chave da SerpApi NUNCA fica neste arquivo.
========================================================= */

const store = {
  get(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  }
};

let state = {
  name: store.get("leadbr_name", ""),
  saved: store.get("leadbr_saved", []),
  results: []
};

/* =========================================================
   UTILITÁRIOS
========================================================= */

function initials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "LB"
  );
}

function greeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";

  return "Boa noite";
}

function showToast(message) {
  const toast = $("#toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(window.leadBrToastTimer);

  window.leadBrToastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

function escapeHTML(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[char]
  );
}

function normalizeUrl(url = "") {
  if (!url) return "";

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `https://${url}`;
}

/* =========================================================
   NAVEGAÇÃO
========================================================= */

function go(page) {
  $$(".page").forEach((element) => {
    element.classList.remove("active-page");
  });

  const target = $(`#page-${page}`);

  if (target) {
    target.classList.add("active-page");
  }

  $$(".nav-item").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });

  history.replaceState(null, "", `#${page}`);

  $(".sidebar")?.classList.remove("open");

  if (page === "saved") {
    renderSaved();
  }

  updateUI();
}

/* =========================================================
   INTERFACE
========================================================= */

function updateUI() {
  const name = state.name || "Visitante";

  const greetingElement = $("#greeting");
  const sideName = $("#sideName");
  const avatar = $("#avatar");
  const settingsName = $("#settingsName");

  if (greetingElement) {
    greetingElement.textContent = `${greeting()}, ${name}.`;
  }

  if (sideName) {
    sideName.textContent = name;
  }

  if (avatar) {
    avatar.textContent = initials(name);
  }

  if (settingsName) {
    settingsName.value = state.name;
  }

  const total =
    state.results.length + state.saved.length;

  const hot =
    state.results.filter((lead) => lead.score >= 80).length +
    state.saved.filter((lead) => lead.score >= 80).length;

  const noSite =
    state.results.filter((lead) => !lead.hasSite).length +
    state.saved.filter((lead) => !lead.hasSite).length;

  const saved = state.saved.length;

  if ($("#statTotal")) {
    $("#statTotal").textContent = total;
  }

  if ($("#statHot")) {
    $("#statHot").textContent = hot;
  }

  if ($("#statNoSite")) {
    $("#statNoSite").textContent = noSite;
  }

  if ($("#statSaved")) {
    $("#statSaved").textContent = saved;
  }
}

/* =========================================================
   BUSCA REAL
========================================================= */

/*
  IMPORTANTE:

  Esta função NÃO chama a SerpApi diretamente.

  Ela chama:

      /api/leads

  Essa rota fica na Vercel e é responsável por usar:

      process.env.SERPAPI_KEY

  Assim sua chave não fica exposta no navegador.
*/

async function fetchLeads({
  city = "",
  niche = "",
  amount = 10,
  locationType = "city"
}) {
  if (!niche.trim()) {
    throw new Error("Digite um nicho para buscar.");
  }

  const params = new URLSearchParams();

  params.set("niche", niche.trim());
  params.set("amount", String(amount || 10));
  params.set("locationType", locationType || "city");

  if (locationType !== "brasil") {
    params.set("city", city.trim());
  }

  const response = await fetch(
    `/api/leads?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    }
  );

  let data = {};

  try {
    data = await response.json();
  } catch {
    throw new Error(
      "A resposta do servidor não pôde ser interpretada."
    );
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
        `Erro no servidor (${response.status}).`
    );
  }

  if (!Array.isArray(data.leads)) {
    return [];
  }

  return data.leads;
}

/* =========================================================
   CLASSIFICAÇÃO DOS LEADS
========================================================= */

function badge(score) {
  if (score >= 80) {
    return `<span class="badge hot">🔥 QUENTE</span>`;
  }

  if (score >= 50) {
    return `<span class="badge medium">🟡 MÉDIO</span>`;
  }

  return `<span class="badge low">⚪ FRACO</span>`;
}

/* =========================================================
   CARD DO LEAD
========================================================= */

function leadCard(lead) {
  const saved = state.saved.some(
    (item) => String(item.id) === String(lead.id)
  );

  const website = lead.url
    ? normalizeUrl(lead.url)
    : "";

  const websiteButton = website
    ? `
      <a
        class="secondary-btn"
        href="${escapeHTML(website)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        🌐 Site
      </a>
    `
    : "";

  const mapsButton = lead.mapsUrl
    ? `
      <a
        class="secondary-btn"
        href="${escapeHTML(lead.mapsUrl)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        📍 Maps
      </a>
    `
    : "";

  const issues = Array.isArray(lead.issues)
    ? lead.issues
    : [];

  return `
    <article class="lead-card">

      <div class="lead-top">

        <div>

          <div class="lead-name">
            ${escapeHTML(lead.name || "Empresa")}
          </div>

          <div class="lead-meta">
            ${escapeHTML(lead.niche || "")}
            ${lead.city ? " · " + escapeHTML(lead.city) : ""}
          </div>

        </div>

        ${badge(Number(lead.score) || 0)}

      </div>

      <div class="lead-score">
        ${Number(lead.score) || 0}
        <small>/100 potencial</small>
      </div>

      <div class="issues">

        ${
          issues.length
            ? issues
                .map(
                  (issue) =>
                    `<span class="issue">${escapeHTML(issue)}</span>`
                )
                .join("")
            : `<span class="issue">Análise básica concluída</span>`
        }

      </div>

      <div class="lead-meta">

        ${
          lead.hasSite
            ? "🌐 Site identificado"
            : "❌ Sem site identificado"
        }

        ${
          lead.rating
            ? ` · ⭐ ${escapeHTML(lead.rating)}`
            : ""
        }

        ${
          lead.reviews
            ? ` · ${escapeHTML(lead.reviews)} avaliações`
            : ""
        }

      </div>

      ${
        lead.phone
          ? `
            <div class="lead-meta">
              📞 ${escapeHTML(lead.phone)}
            </div>
          `
          : ""
      }

      <div class="lead-actions">

        <button
          class="secondary-btn"
          onclick="openAnalysis('${String(lead.id).replace(/'/g, "\\'")}')"
        >
          Analisar
        </button>

        ${websiteButton}

        ${mapsButton}

        <button
          class="${
            saved
              ? "secondary-btn"
              : "primary-btn"
          }"
          onclick="toggleSave('${String(lead.id).replace(/'/g, "\\'")}')"
        >
          ${saved ? "✓ Salvo" : "☆ Salvar"}
        </button>

      </div>

    </article>
  `;
}

/* =========================================================
   RESULTADOS
========================================================= */

function renderResults() {
  const resultsElement = $("#results");

  if (!resultsElement) return;

  if (!state.results.length) {
    resultsElement.innerHTML = `
      <div
        class="empty-state"
        style="
          grid-column:1/-1;
          padding:45px;
          text-align:center;
          color:#747e91;
          background:#0d1119;
          border:1px solid #202634;
          border-radius:15px;
        "
      >
        Nenhum lead encontrado.
      </div>
    `;
  } else {
    resultsElement.innerHTML =
      state.results.map(leadCard).join("");
  }

  const resultsHead = $("#resultsHead");

  if (resultsHead) {
    resultsHead.classList.toggle(
      "hidden",
      state.results.length === 0
    );
  }

  if ($("#resultCount")) {
    $("#resultCount").textContent =
      `${state.results.length} oportunidades encontradas`;
  }

  updateUI();
}

function renderSaved() {
  const container = $("#savedResults");

  if (!container) return;

  if (!state.saved.length) {
    container.innerHTML = `
      <div
        class="empty-state"
        style="
          grid-column:1/-1;
          padding:45px;
          text-align:center;
          color:#747e91;
          background:#0d1119;
          border:1px solid #202634;
          border-radius:15px;
        "
      >

        Nenhum lead salvo ainda.

        <br>
        <br>

        <button
          class="primary-btn"
          data-page-target="search"
        >
          Encontrar leads
        </button>

      </div>
    `;

    return;
  }

  container.innerHTML =
    state.saved.map(leadCard).join("");
}

/* =========================================================
   SALVAR LEAD
========================================================= */

function toggleSave(id) {
  const allLeads = [
    ...state.results,
    ...state.saved
  ];

  const lead = allLeads.find(
    (item) => String(item.id) === String(id)
  );

  if (!lead) return;

  const index = state.saved.findIndex(
    (item) => String(item.id) === String(id)
  );

  if (index >= 0) {
    state.saved.splice(index, 1);

    showToast(
      "Lead removido dos salvos."
    );
  } else {
    state.saved.push(lead);

    showToast(
      "Lead salvo com sucesso."
    );
  }

  store.set(
    "leadbr_saved",
    state.saved
  );

  renderResults();
  renderSaved();
  updateUI();
}

window.toggleSave = toggleSave;

/* =========================================================
   ANÁLISE
========================================================= */

function openAnalysis(id) {
  const lead = [
    ...state.results,
    ...state.saved
  ].find(
    (item) => String(item.id) === String(id)
  );

  if (!lead) return;

  const issues = Array.isArray(lead.issues)
    ? lead.issues
    : [];

  const siteUrl = lead.url
    ? normalizeUrl(lead.url)
    : "";

  $("#modalContent").innerHTML = `

    <span class="eyebrow">
      ANÁLISE DO LEAD
    </span>

    <h2 style="margin:8px 0">
      ${escapeHTML(lead.name || "Empresa")}
    </h2>

    <p
      style="
        color:#747e91;
        font-size:12px;
      "
    >
      ${escapeHTML(lead.city || "")}
      ·
      ${escapeHTML(lead.niche || "")}
    </p>

    <div class="analysis-score">
      ${Number(lead.score) || 0}
      <small
        style="
          font-size:12px;
          color:#707a8d;
        "
      >
        / 100
      </small>
    </div>

    <p
      style="
        color:#9ca5b6;
        line-height:1.6;
        font-size:13px;
      "
    >
      ${escapeHTML(
        lead.description ||
          "Análise disponível para este lead."
      )}
    </p>

    <div>

      ${
        issues.length
          ? issues
              .map(
                (issue) => `
                  <div class="analysis-row">

                    <span>
                      ${escapeHTML(issue)}
                    </span>

                    <strong>
                      ${
                        Number(lead.score) >= 80
                          ? "Oportunidade"
                          : "Revisar"
                      }
                    </strong>

                  </div>
                `
              )
              .join("")
          : ""
      }

    </div>

    <div class="analysis-row">

      <span>
        Site
      </span>

      <strong>

        ${
          siteUrl
            ? `
              <a
                href="${escapeHTML(siteUrl)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir site
              </a>
            `
            : "Não identificado"
        }

      </strong>

    </div>

    <div class="analysis-row">

      <span>
        Telefone
      </span>

      <strong>
        ${escapeHTML(
          lead.phone || "Não informado"
        )}
      </strong>

    </div>

    ${
      lead.rating
        ? `
          <div class="analysis-row">

            <span>
              Avaliação
            </span>

            <strong>
              ⭐ ${escapeHTML(lead.rating)}
            </strong>

          </div>
        `
        : ""
    }

    ${
      lead.reviews
        ? `
          <div class="analysis-row">

            <span>
              Avaliações
            </span>

            <strong>
              ${escapeHTML(lead.reviews)}
            </strong>

          </div>
        `
        : ""
    }

  `;

  $("#leadModal").classList.remove("hidden");
}

window.openAnalysis = openAnalysis;

/* =========================================================
   EXECUTAR BUSCA
========================================================= */

async function runSearch(
  city,
  niche,
  amount,
  locationType
) {
  const status = $("#searchStatus");

  if (!niche || !niche.trim()) {
    showToast(
      "Digite um nicho antes de buscar."
    );

    return;
  }

  if (
    locationType !== "brasil" &&
    (!city || !city.trim())
  ) {
    showToast(
      "Digite uma cidade ou escolha Todo Brasil."
    );

    return;
  }

  if (status) {
    status.classList.remove("hidden");

    status.textContent =
      "🔎 Procurando empresas reais...";
  }

  if ($("#results")) {
    $("#results").innerHTML = "";
  }

  if ($("#resultsHead")) {
    $("#resultsHead").classList.add("hidden");
  }

  try {
    state.results = await fetchLeads({
      city,
      niche,
      amount,
      locationType
    });

    if (status) {
      status.textContent =
        `✓ Busca concluída. ${state.results.length} empresas encontradas.`;
    }

    renderResults();

    if (state.results.length) {
      showToast(
        `${state.results.length} leads encontrados!`
      );
    } else {
      showToast(
        "Nenhuma empresa encontrada nessa busca."
      );
    }

  } catch (error) {

    console.error(
      "Lead BR:",
      error
    );

    state.results = [];

    if (status) {
      status.textContent =
        `❌ ${error.message}`;
    }

    renderResults();

    showToast(
      "Erro ao buscar leads."
    );
  }
}

/* =========================================================
   BUSCA RÁPIDA DA HOME
========================================================= */

function startSearchFromInputs() {
  go("search");

  const quickCity =
    $("#quickCity")?.value || "";

  const quickNiche =
    $("#quickNiche")?.value || "";

  if ($("#cityInput")) {
    $("#cityInput").value =
      quickCity;
  }

  if ($("#nicheInput")) {
    $("#nicheInput").value =
      quickNiche;
  }

  runSearch(
    quickCity,
    quickNiche,
    $("#amountInput")?.value || 10,
    $("#locationType")?.value || "city"
  );
}

/* =========================================================
   EVENTOS
========================================================= */

const nameForm = $("#nameForm");

if (nameForm) {
  nameForm.addEventListener(
    "submit",
    (event) => {

      event.preventDefault();

      const name =
        $("#nameInput")?.value.trim();

      if (!name) {
        showToast(
          "Digite seu nome para continuar."
        );

        return;
      }

      state.name = name;

      store.set(
        "leadbr_name",
        state.name
      );

      $("#onboarding")?.classList.add(
        "hidden"
      );

      $("#app")?.classList.remove(
        "hidden"
      );

      updateUI();

      showToast(
        `Bem-vindo ao Lead BR, ${name}!`
      );
    }
  );
}

/* Busca rápida */

$("#quickSearchBtn")?.addEventListener(
  "click",
  startSearchFromInputs
);

/* Busca principal */

$("#searchBtn")?.addEventListener(
  "click",
  () => {

    runSearch(
      $("#cityInput")?.value || "",
      $("#nicheInput")?.value || "",
      $("#amountInput")?.value || 10,
      $("#locationType")?.value || "city"
    );

  }
);

/* Limpar resultados */

$("#clearResults")?.addEventListener(
  "click",
  () => {

    state.results = [];

    renderResults();

    $("#searchStatus")?.classList.add(
      "hidden"
    );

    showToast(
      "Resultados limpos."
    );
  }
);

/* Cidade / Todo Brasil */

$("#locationType")?.addEventListener(
  "change",
  () => {

    const isBrazil =
      $("#locationType").value === "brasil";

    const field =
      $("#locationField");

    if (field) {
      field.style.display =
        isBrazil
          ? "none"
          : "block";
    }

  }
);

/* Leads salvos */

$("#savedResults")?.addEventListener(
  "click",
  (event) => {

    const button =
      event.target.closest(
        "[data-page-target]"
      );

    if (!button) return;

    go(
      button.dataset.pageTarget
    );
  }
);

/* Navegação */

$$(
  "[data-page], [data-page-target]"
).forEach(
  (button) => {

    button.addEventListener(
      "click",
      () => {

        go(
          button.dataset.page ||
          button.dataset.pageTarget
        );

      }
    );

  }
);

/* Menu mobile */

$("#mobileMenu")?.addEventListener(
  "click",
  () => {

    $(".sidebar")?.classList.toggle(
      "open"
    );

  }
);

/* Tema */

$("#themeBtn")?.addEventListener(
  "click",
  () => {

    document.body.classList.toggle(
      "light"
    );

    store.set(
      "leadbr_light",
      document.body.classList.contains(
        "light"
      )
    );

  }
);

/* Ir para busca */

$("#topSearch")?.addEventListener(
  "click",
  () => go("search")
);

/* Alterar nome */

$("#saveNameBtn")?.addEventListener(
  "click",
  () => {

    const name =
      $("#settingsName")?.value.trim();

    if (!name) {
      showToast(
        "Digite um nome válido."
      );

      return;
    }

    state.name = name;

    store.set(
      "leadbr_name",
      state.name
    );

    updateUI();

    showToast(
      "Nome atualizado."
    );
  }
);

/*
  Essas configurações continuam disponíveis
  caso você queira usar outras APIs futuramente.
*/

$("#saveApiBtn")?.addEventListener(
  "click",
  () => {

    store.set(
      "leadbr_business_api",
      $("#businessApi")?.value || ""
    );

    store.set(
      "leadbr_site_api",
      $("#siteApi")?.value || ""
    );

    showToast(
      "Configurações salvas neste navegador."
    );

  }
);

/* Mostrar / esconder senha */

$$(".reveal-btn").forEach(
  (button) => {

    button.addEventListener(
      "click",
      () => {

        const input =
          $("#" + button.dataset.target);

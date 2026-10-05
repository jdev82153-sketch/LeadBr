function send(res, status, body) {
  return res.status(status).json(body);
}

function clean(value, max = 160) {
  return String(value || "").trim().slice(0, max);
}

async function inspectWebsite(website) {
  if (!website) {
    return {
      website: "",
      siteOk: false,
      https: false,
      hasViewport: false,
      htmlBytes: 0
    };
  }

  let url = website;

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LeadBR/1.0)"
      }
    });

    const contentType = response.headers.get("content-type") || "";
    const html = contentType.includes("text/html")
      ? await response.text()
      : "";

    return {
      website: response.url || url,
      siteOk: response.ok,
      https: (response.url || url).startsWith("https://"),
      hasViewport: /<meta[^>]+name=["']viewport["'][^>]*>/i.test(html),
      htmlBytes: Buffer.byteLength(html, "utf8")
    };

  } catch {
    return {
      website: url,
      siteOk: false,
      https: url.startsWith("https://"),
      hasViewport: false,
      htmlBytes: 0
    };

  } finally {
    clearTimeout(timeout);
  }
}

function analyzeSite(info) {

  if (!info.website) {
    return {
      score: 96,
      hasSite: false,
      issues: ["Sem site", "Oportunidade alta"],
      description:
        "Empresa sem website informado. Excelente oportunidade para oferecer criação de site."
    };
  }

  let score = 0;
  const issues = [];

  if (!info.siteOk) {
    score += 30;
    issues.push("Site indisponível");
  }

  if (!info.https) {
    score += 15;
    issues.push("Sem HTTPS");
  }

  if (!info.hasViewport) {
    score += 18;
    issues.push("Mobile não identificado");
  }

  if (info.htmlBytes > 1500000) {
    score += 8;
    issues.push("Página pesada");
  }

  if (score === 0) {
    score = 38;
    issues.push("Site ativo");
  }

  score = Math.min(100, score);

  return {
    score,
    hasSite: true,
    issues,
    description:
      score >= 80
        ? "Grande oportunidade para abordagem comercial."
        : score >= 50
        ? "Existem sinais de melhoria no site."
        : "Site ativo com presença digital básica."
  };
}

async function searchSerpApi(query, apiKey) {

  const url = new URL("https://serpapi.com/search");

  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("type", "search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "pt-BR");
  url.searchParams.set("gl", "br");
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url);

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(
      data.error || "Erro retornado pela SerpApi."
    );
  }

  return data;
}

module.exports = async (req, res) => {

  if (req.method !== "GET") {
    return send(res, 405, {
      error: "Método não permitido."
    });
  }

  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    return send(res, 500, {
      error: "SERPAPI_KEY não configurada na Vercel."
    });
  }

  const niche = clean(req.query.niche, 80);
  const city = clean(req.query.city, 120);
  const locationType = clean(req.query.locationType, 30);

  let amount =
    parseInt(req.query.amount, 10) || 10;

  amount = Math.max(1, Math.min(amount, 100));

  if (!niche) {
    return send(res, 400, {
      error: "Informe um nicho."
    });
  }

  let query = niche;

  if (locationType === "brasil") {

    query = `${niche} Brasil`;

  } else if (city) {

    query = `${niche} em ${city}`;

  }

  try {

    const data = await searchSerpApi(
      query,
      apiKey
    );

    const results =
      Array.isArray(data.local_results)
        ? data.local_results
        : [];

    const leads = [];

    for (
      const item of results.slice(0, amount)
    ) {

      const website =
        item.website ||
        item.links?.website ||
        "";

      const inspected =
        await inspectWebsite(website);

      const analysis =
        analyzeSite(inspected);

      leads.push({

        id:
          item.data_cid ||
          Date.now() + Math.random(),

        name:
          clean(item.title),

        city:
          clean(item.address, 220),

        niche,

        score:
          analysis.score,

        hasSite:
          analysis.hasSite,

        url:
          inspected.website,

        phone:
          clean(
            item.phone ||
            "Não informado",
            80
          ),

        issues:
          analysis.issues,

        description:
          analysis.description,

        rating:
          item.rating || null,

        reviews:
          item.reviews || 0,

        type:
          clean(item.type || "", 100),

        openState:
          clean(
            item.open_state || "",
            100
          ),

        mapsUrl:
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${item.title} ${item.address || ""}`
          )}`

      });
    }

    leads.sort(
      (a, b) => b.score - a.score
    );

    return send(res, 200, {
      query,
      count: leads.length,
      leads
    });

  } catch (error) {

    console.error(error);

    return send(res, 500, {
      error:
        error.message ||
        "Erro ao buscar leads."
    });

  }

};

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const store = {
  get(key, fallback=null){ try { const v=localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value){ localStorage.setItem(key, JSON.stringify(value)); },
  remove(key){ localStorage.removeItem(key); }
};

let state = {
  name: store.get("leadbr_name", ""),
  saved: store.get("leadbr_saved", []),
  results: []
};

function initials(name){
  return name.trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()).join("") || "LB";
}
function greeting(){
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}
function showToast(msg){
  const t=$("#toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(window.toastTimer); window.toastTimer=setTimeout(()=>t.classList.remove("show"),2600);
}
function go(page){
  $$(".page").forEach(p=>p.classList.remove("active-page"));
  $(`#page-${page}`).classList.add("active-page");
  $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  history.replaceState(null,"",`#${page}`);
  $(".sidebar")?.classList.remove("open");
  if(page==="saved") renderSaved();
}
function updateUI(){
  const name=state.name || "Visitante";
  $("#greeting").textContent=`${greeting()}, ${name}.`;
  $("#sideName").textContent=name;
  $("#avatar").textContent=initials(name);
  $("#settingsName").value=state.name;
  $("#statTotal").textContent=state.results.length + state.saved.length;
  $("#statHot").textContent=state.results.filter(x=>x.score>=80).length + state.saved.filter(x=>x.score>=80).length;
  $("#statNoSite").textContent=state.results.filter(x=>!x.hasSite).length + state.saved.filter(x=>!x.hasSite).length;
  $("#statSaved").textContent=state.saved.length;
}
function escapeHTML(str=""){
  return String(str).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}

/* A camada de dados abaixo é um mock local para a interface funcionar imediatamente.
   Troque fetchLeads() pela chamada ao seu backend quando conectar uma API real. */
const businessNames = [
  "Clínica Vida", "Espaço Saúde", "Academia Movimento", "Studio Bella", "Restaurante Sabor",
  "Clínica Integrar", "Odonto Prime", "Boutique Essencial", "Centro Fitness", "Instituto Viver",
  "Salão Concept", "Ponto da Moda", "Clínica Equilíbrio", "Studio Corpo & Saúde", "Casa Gourmet"
];
const nichesDefault = ["clínica","academia","salão","restaurante","loja","consultório"];

function mockLead(i, city, niche){
  const noSite = i % 4 === 0;
  const old = i % 4 === 1;
  const mobile = i % 3 !== 0;
  let score = noSite ? 94 : old ? 82 : mobile ? 64 : 42;
  const issues = noSite ? ["Sem site","Oportunidade alta"] : old ? ["Design antigo","Performance"] : mobile ? ["Mobile parcial"] : ["Site ativo"];
  const base = businessNames[i % businessNames.length];
  const n = niche?.trim() || nichesDefault[i % nichesDefault.length];
  return {
    id: `${Date.now()}-${i}-${Math.random().toString(16).slice(2)}`,
    name: `${base} ${n && !base.toLowerCase().includes(n.toLowerCase()) ? "" : ""}`.trim(),
    city: city || "Brasil",
    niche:n,
    score,
    hasSite:!noSite,
    url:noSite ? "" : `https://www.exemplo-${i+1}.com.br`,
    phone:"(00) 00000-0000",
    issues,
    description:noSite ? "Empresa sem site identificado. Excelente oportunidade para oferecer criação de site." : old ? "Site identificado com sinais de design antigo e oportunidades de melhoria." : "Empresa encontrada com presença digital. Vale revisar o site antes da abordagem."
  };
}
async function fetchLeads({city,niche,amount,locationType}){
  await new Promise(r=>setTimeout(r,850));
  const count=Math.min(Number(amount)||10,100);
  return Array.from({length:count},(_,i)=>mockLead(i, locationType==="brasil" ? "Todo Brasil" : city, niche));
}
function badge(score){
  return score>=80 ? `<span class="badge hot">🔥 QUENTE</span>` : score>=50 ? `<span class="badge medium">🟡 MÉDIO</span>` : `<span class="badge low">⚪ FRACO</span>`;
}
function leadCard(lead){
  const saved=state.saved.some(x=>x.id===lead.id);
  return `<article class="lead-card">
    <div class="lead-top"><div><div class="lead-name">${escapeHTML(lead.name)}</div><div class="lead-meta">${escapeHTML(lead.niche)} · ${escapeHTML(lead.city)}</div></div>${badge(lead.score)}</div>
    <div class="lead-score">${lead.score}<small>/100 potencial</small></div>
    <div class="issues">${lead.issues.map(x=>`<span class="issue">${escapeHTML(x)}</span>`).join("")}</div>
    <div class="lead-meta">${lead.hasSite ? "🌐 Site identificado" : "❌ Sem site identificado"}</div>
    <div class="lead-actions">
      <button class="secondary-btn" onclick="openAnalysis('${lead.id}')">Analisar</button>
      <button class="${saved?"secondary-btn":"primary-btn"}" onclick="toggleSave('${lead.id}')">${saved?"✓ Salvo":"☆ Salvar"}</button>
    </div>
  </article>`;
}
function renderResults(){
  $("#results").innerHTML=state.results.map(leadCard).join("");
  $("#resultsHead").classList.toggle("hidden",state.results.length===0);
  $("#resultCount").textContent=`${state.results.length} oportunidades encontradas`;
  updateUI();
}
function renderSaved(){
  $("#savedResults").innerHTML=state.saved.length ? state.saved.map(leadCard).join("") : `<div class="empty-state" style="grid-column:1/-1;padding:45px;text-align:center;color:#747e91;background:#0d1119;border:1px solid #202634;border-radius:15px">Nenhum lead salvo ainda.<br><br><button class="primary-btn" data-page-target="search">Encontrar leads</button></div>`;
}
function toggleSave(id){
  const lead=[...state.results,...state.saved].find(x=>x.id===id);
  if(!lead) return;
  const idx=state.saved.findIndex(x=>x.id===id);
  if(idx>=0){state.saved.splice(idx,1);showToast("Lead removido dos salvos.");}
  else {state.saved.push(lead);showToast("Lead salvo com sucesso.");}
  store.set("leadbr_saved",state.saved); renderResults(); renderSaved(); updateUI();
}
window.toggleSave=toggleSave;

function openAnalysis(id){
  const lead=[...state.results,...state.saved].find(x=>x.id===id); if(!lead)return;
  $("#modalContent").innerHTML=`<span class="eyebrow">ANÁLISE DO LEAD</span>
    <h2 style="margin:8px 0">${escapeHTML(lead.name)}</h2>
    <p style="color:#747e91;font-size:12px">${escapeHTML(lead.city)} · ${escapeHTML(lead.niche)}</p>
    <div class="analysis-score">${lead.score}<small style="font-size:12px;color:#707a8d"> / 100</small></div>
    <p style="color:#9ca5b6;line-height:1.6;font-size:13px">${escapeHTML(lead.description)}</p>
    <div>${lead.issues.map(x=>`<div class="analysis-row"><span>${escapeHTML(x)}</span><strong>${lead.score>=80?"Oportunidade":"Revisar"}</strong></div>`).join("")}</div>
    <div class="analysis-row"><span>Site</span><strong>${lead.hasSite?escapeHTML(lead.url):"Não identificado"}</strong></div>
    <div class="analysis-row"><span>Contato</span><strong>${lead.phone}</strong></div>`;
  $("#leadModal").classList.remove("hidden");
}
window.openAnalysis=openAnalysis;

async function runSearch(city,niche,amount,locationType){
  $("#searchStatus").classList.remove("hidden");
  $("#searchStatus").textContent="🔎 Procurando empresas e analisando oportunidades...";
  $("#results").innerHTML="";
  state.results=await fetchLeads({city,niche,amount,locationType});
  $("#searchStatus").textContent=`✓ Busca concluída. ${state.results.length} empresas processadas.`;
  renderResults();
}
function startSearchFromInputs(){
  go("search");
  $("#cityInput").value=$("#quickCity").value;
  $("#nicheInput").value=$("#quickNiche").value;
  runSearch($("#cityInput").value,$("#nicheInput").value,$("#amountInput").value,$("#locationType").value);
}

$("#nameForm").addEventListener("submit",e=>{
  e.preventDefault();
  state.name=$("#nameInput").value.trim();
  if(!state.name)return;
  store.set("leadbr_name",state.name);
  $("#onboarding").classList.add("hidden"); $("#app").classList.remove("hidden"); updateUI();
});
$("#quickSearchBtn").addEventListener("click",startSearchFromInputs);
$("#searchBtn").addEventListener("click",()=>runSearch($("#cityInput").value,$("#nicheInput").value,$("#amountInput").value,$("#locationType").value));
$("#clearResults").addEventListener("click",()=>{state.results=[];renderResults();$("#searchStatus").classList.add("hidden")});
$("#locationType").addEventListener("change",()=>{$("#locationField").style.display=$("#locationType").value==="brasil"?"none":"block"});
$("#savedResults").addEventListener("click",e=>{if(e.target.matches("[data-page-target]"))go(e.target.dataset.pageTarget)});
$$("[data-page], [data-page-target]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.page||b.dataset.pageTarget)));
$("#mobileMenu").addEventListener("click",()=>$(".sidebar").classList.toggle("open"));
$("#themeBtn").addEventListener("click",()=>{document.body.classList.toggle("light");store.set("leadbr_light",document.body.classList.contains("light"));});
$("#topSearch").addEventListener("click",()=>go("search"));
$("#saveNameBtn").addEventListener("click",()=>{const n=$("#settingsName").value.trim();if(n){state.name=n;store.set("leadbr_name",n);updateUI();showToast("Nome atualizado.");}});
$("#saveApiBtn").addEventListener("click",()=>{store.set("leadbr_business_api",$("#businessApi").value);store.set("leadbr_site_api",$("#siteApi").value);showToast("Configurações salvas neste navegador.");});
$$(".reveal-btn").forEach(b=>b.addEventListener("click",()=>{const i=$("#"+b.dataset.target);i.type=i.type==="password"?"text":"password"}));
$("#clearSavedBtn").addEventListener("click",()=>{if(confirm("Apagar todos os leads salvos?")){state.saved=[];store.set("leadbr_saved",[]);renderSaved();updateUI();showToast("Leads salvos apagados.");}});
$("#resetBtn").addEventListener("click",()=>{if(confirm("Resetar o Lead BR neste navegador?")){localStorage.clear();location.reload();}});
$("#logoutBtn").addEventListener("click",()=>{$("#app").classList.add("hidden");$("#onboarding").classList.remove("hidden");$("#nameInput").value="";});
$$("[data-close-modal]").forEach(x=>x.addEventListener("click",()=>$("#leadModal").classList.add("hidden")));
document.addEventListener("keydown",e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();go("search")} if(e.key==="Escape")$("#leadModal").classList.add("hidden")});

(function init(){
  if(store.get("leadbr_light",false))document.body.classList.add("light");
  $("#businessApi").value=store.get("leadbr_business_api","");
  $("#siteApi").value=store.get("leadbr_site_api","");
  if(state.name){$("#onboarding").classList.add("hidden");$("#app").classList.remove("hidden");updateUI();}
  const hash=location.hash.replace("#","");
  if(state.name && ["dashboard","search","saved","settings"].includes(hash))go(hash);
})();

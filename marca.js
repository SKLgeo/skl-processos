// Marca do escritório: o sistema é do cliente. Nome, logo e cores da tela (e do e-mail do dia e dos alertas) vêm de
// proc_escritorios.config.marca = { nome, logo, cor_primaria, cor_destaque }. Sem marca, fica o visual padrão.
// Tela de entrada: usa a marca do link do cliente (…/?e=<slug>) ou a última marca usada neste aparelho.
(() => {
  "use strict";
  const P = window.SKLProc; const { esc } = P;
  const PADRAO = { nome: "SKL Processos", logo: "icone.png", cor_primaria: "#1f4d2e", cor_destaque: "#d9a21b" };
  const CHAVE = "skl_proc_marca";
  const $ = (id) => document.getElementById(id);

  const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [ (n >> 16) & 255, (n >> 8) & 255, n & 255 ]; };
  const rgbHex = (r) => "#" + r.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const misturar = (a, b, t) => { const x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map((v, i) => v + (y[i] - v) * t)); };
  const luminancia = (h) => { const [ r, g, b ] = hexRgb(h).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
  P.corClaraDemais = (h) => /^#[0-9a-f]{6}$/i.test(h || "") && luminancia(h) > .4;

  const lerLocal = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const gravarLocal = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* */ } };

  // aplica na tela: cores (variáveis do CSS), logo, nome, título da aba e ícone
  P.aplicarMarca = (m, nomeEscritorio) => {
    const nome = m?.nome || nomeEscritorio || PADRAO.nome;
    const logo = m?.logo || PADRAO.logo;
    const c1 = /^#[0-9a-f]{6}$/i.test(m?.cor_primaria || "") ? m.cor_primaria : PADRAO.cor_primaria;
    const c2 = /^#[0-9a-f]{6}$/i.test(m?.cor_destaque || "") ? m.cor_destaque : PADRAO.cor_destaque;
    const raiz = document.documentElement.style;
    raiz.setProperty("--mata", c1);
    raiz.setProperty("--mata-escuro", misturar(c1, "#000000", .25));
    raiz.setProperty("--campo", misturar(c1, "#ffffff", .3));
    raiz.setProperty("--dourado", c2);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", c1);
    document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach((l) => { l.href = logo; });
    document.querySelectorAll(".lateral-marca img, .login-icone").forEach((i) => { i.src = logo; });
    const forte = document.querySelector(".lateral-marca strong"); if (forte) forte.textContent = nome;
    const h1 = document.querySelector(".login-marca h1"); if (h1) h1.textContent = nome;
    document.title = nome;
    P.marcaAtual = { nome, logo, cor_primaria: c1, cor_destaque: c2 };
  };

  // antes de entrar: marca do link do cliente ou a última deste aparelho
  (async () => {
    let guardada = null;
    try { guardada = JSON.parse(lerLocal(CHAVE) || "null"); } catch { /* */ }
    if (guardada) P.aplicarMarca(guardada);
    let slug = null;
    try { slug = new URLSearchParams(location.search).get("e"); } catch { /* file: */ }
    if (!slug) return;
    const { data } = await P.sb.rpc("proc_marca_publica", { p_slug: slug });
    if (data) { P.aplicarMarca(data); gravarLocal(CHAVE, JSON.stringify(data)); }
  })().catch(() => {});

  document.addEventListener("skl-proc-entrou", () => {
    const E = P.estado.escritorio; const m = E?.config?.marca || null;
    P.aplicarMarca(m, E?.nome);
    const sub = $("nomeEscritorio"); if (sub) sub.textContent = "Gestão de processos";
    gravarLocal(CHAVE, JSON.stringify({ ...(m || {}), nome: m?.nome || E?.nome }));
  });

  // logo: reduz no aparelho para no máximo 512 px (PNG, mantém o fundo transparente)
  async function reduzirLogo(arquivo) {
    const url = URL.createObjectURL(arquivo);
    try {
      const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error("Imagem inválida.")); i.src = url; });
      const f = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * f); c.height = Math.round(img.naturalHeight * f);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return await new Promise((ok) => c.toBlob(ok, "image/png"));
    } finally { URL.revokeObjectURL(url); }
  }

  // Configurações → Escritório → Marca
  P.renderConfigMarca = (el) => {
    const E = P.estado.escritorio; const pode = P.pode("configurar");
    const m = E.config?.marca || {};
    let rasc = { nome: m.nome || "", logo: m.logo || "", cor_primaria: m.cor_primaria || PADRAO.cor_primaria, cor_destaque: m.cor_destaque || PADRAO.cor_destaque };
    const desenhar = () => {
      const clara = P.corClaraDemais(rasc.cor_primaria);
      el.innerHTML = `<div class="cartao"><h3>Marca do escritório</h3>
        <p class="ajuda">O sistema é do seu escritório: o nome, a logo e as cores abaixo aparecem na tela de todos da equipe, no e-mail do dia e nos alertas do celular.</p>
        <div class="marca-grade">
          <div class="marca-campos">
            <label>Nome que aparece no sistema<input type="text" id="mcNome" maxlength="80" value="${esc(rasc.nome)}" placeholder="${esc(E.nome)}" ${pode ? "" : "disabled"}></label>
            <div class="marca-logo-linha">
              <img src="${esc(rasc.logo || PADRAO.logo)}" alt="" class="marca-logo-mini">
              ${pode ? `<label class="botao">Escolher logo<input type="file" id="mcLogo" accept="image/png,image/jpeg,image/webp" hidden></label>
                ${rasc.logo ? `<button type="button" class="link-botao" data-m="semLogo">tirar a logo</button>` : ""}` : ""}
            </div>
            <p class="sub">PNG com fundo transparente fica melhor. A imagem é reduzida para 512 px.</p>
            <div class="marca-cores">
              <label>Cor principal<input type="color" id="mcCor1" value="${esc(rasc.cor_primaria)}" ${pode ? "" : "disabled"}></label>
              <label>Cor de destaque<input type="color" id="mcCor2" value="${esc(rasc.cor_destaque)}" ${pode ? "" : "disabled"}></label>
            </div>
            ${clara ? `<p class="aviso">A cor principal está clara: o texto branco do menu e dos botões fica difícil de ler. Prefira uma cor mais escura.</p>` : ""}
          </div>
          <div class="marca-previa">
            <div class="marca-previa-lateral"><img src="${esc(rasc.logo || PADRAO.logo)}" alt=""><strong>${esc(rasc.nome || E.nome)}</strong></div>
            <div class="marca-previa-corpo"><span class="marca-previa-botao">Botão</span><span class="marca-previa-titulo">Título</span></div>
          </div>
        </div>
        ${pode ? `<div class="acoes"><button type="button" class="botao-principal" data-m="salvar">Salvar marca</button>
          <button type="button" class="link-botao" data-m="padrao">voltar ao visual padrão</button></div>` : ""}</div>`;
      const pv = el.querySelector(".marca-previa");
      pv.style.setProperty("--p1", rasc.cor_primaria); pv.style.setProperty("--p2", rasc.cor_destaque);
      if (!pode) return;
      el.querySelector("#mcNome").oninput = (e) => { rasc.nome = e.target.value; el.querySelector(".marca-previa-lateral strong").textContent = rasc.nome || E.nome; };
      el.querySelector("#mcCor1").oninput = (e) => { rasc.cor_primaria = e.target.value; pv.style.setProperty("--p1", rasc.cor_primaria); };
      el.querySelector("#mcCor1").onchange = () => desenhar();
      el.querySelector("#mcCor2").oninput = (e) => { rasc.cor_destaque = e.target.value; pv.style.setProperty("--p2", rasc.cor_destaque); };
      el.querySelector("#mcLogo").onchange = async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        try {
          if (f.size > 8 * 1024 * 1024) throw new Error("Imagem muito grande (máximo 8 MB).");
          const blob = await reduzirLogo(f);
          const caminho = `${E.id}/logo-${Date.now()}.png`;
          const { error } = await P.sb.storage.from("proc-marcas").upload(caminho, blob, { contentType: "image/png", upsert: false });
          if (error) throw error;
          rasc.logo = P.sb.storage.from("proc-marcas").getPublicUrl(caminho).data.publicUrl;
          desenhar(); P.toast("Logo carregada. Clique em Salvar marca.");
        } catch (err) { P.toast("Não deu para carregar a logo: " + P.msgErro(err), 7000); }
      };
    };
    el.onclick = async (e) => {
      const b = e.target.closest("[data-m]"); if (!b) return;
      try {
        if (b.dataset.m === "semLogo") { rasc.logo = ""; desenhar(); return; }
        const marca = b.dataset.m === "padrao" ? null : { nome: rasc.nome.trim(), logo: rasc.logo, cor_primaria: rasc.cor_primaria, cor_destaque: rasc.cor_destaque };
        if (b.dataset.m === "padrao" && !confirm("Voltar ao visual padrão (sem logo e cores do escritório)?")) return;
        const { data, error } = await P.sb.rpc("proc_definir_marca", { p_escritorio: E.id, p_marca: marca });
        if (error) throw error;
        E.config = data.config;
        // apaga as logos antigas que não estão mais em uso
        const atual = E.config?.marca?.logo || "";
        const { data: arqs } = await P.sb.storage.from("proc-marcas").list(E.id);
        const velhas = (arqs || []).map((a) => `${E.id}/${a.name}`).filter((c) => !atual.endsWith("/" + c));
        if (velhas.length) await P.sb.storage.from("proc-marcas").remove(velhas);
        P.aplicarMarca(E.config?.marca || null, E.nome);
        gravarLocal(CHAVE, JSON.stringify({ ...(E.config?.marca || {}), nome: E.config?.marca?.nome || E.nome }));
        if (b.dataset.m === "padrao") rasc = { nome: "", logo: "", cor_primaria: PADRAO.cor_primaria, cor_destaque: PADRAO.cor_destaque };
        desenhar(); P.toast("Marca salva. Quem estiver com o sistema aberto vê a nova marca ao entrar de novo.");
      } catch (err) { P.toast(P.msgErro(err), 7000); }
    };
    desenhar();
  };
})();

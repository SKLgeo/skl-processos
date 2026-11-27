// Marca do escritório: o sistema é do cliente. Nome, logo e cores da tela (e do e-mail do dia e dos alertas) vêm de
// proc_escritorios.config.marca = { nome, logo, cor_primaria, cor_destaque }. Sem marca, fica o visual padrão.
// A marca é aplicada pela SKL na implantação do cliente (o cliente não edita): ver supabase/migrations/skl_processos_marca_so_skl.sql.
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

})();

// SKL Processos — núcleo: entrada, escritório, dados em memória, tempo real, menu, formulários e utilidades.
// Cada tela fica no seu arquivo (hoje.js, processos.js, cadastros.js, agenda.js, financeiro.js,
// configuracoes.js, tutoriais.js, busca.js) e se registra com P.pagina(...).
(() => {
  "use strict";
  const APP_VERSION = "1.0.0";
  const CFG = window.SKL_PROC_CONFIG;
  const NO_PC = !!window.sklDesktop;
  const LINK = CFG.link || "";

  const sb = window.supabase.createClient(CFG.supabase_url, CFG.supabase_anon_key, {
    auth: { storageKey: "sklproc-auth", persistSession: true, autoRefreshToken: true, detectSessionInUrl: !NO_PC },
  });

  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const lerLocal = (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };
  const gravarLocal = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* sem armazenamento */ } };

  const P = window.SKLProc = {
    APP_VERSION, sb, $, esc, lerLocal, gravarLocal, NO_PC, LINK,
    estado: { usuario: null, escritorios: [], escritorio: null, perm: {}, equipe: [], pagina: "hoje", param: null },
    dados: {}, paginas: {},
  };

  // ---------------- rótulos ----------------
  P.R = {
    papel: { administrador: "Administrador", tecnico: "Técnico", financeiro: "Financeiro", consulta: "Consulta" },
    sitProjeto: { ativo: "Ativo", pausado: "Pausado", concluido: "Concluído", cancelado: "Cancelado" },
    sitServico: { nao_iniciado: "Não iniciado", em_andamento: "Em andamento", aguardando: "Aguardando", concluido: "Concluído", cancelado: "Cancelado" },
    sitEtapa: { pendente: "Pendente", andamento: "Em andamento", concluida: "Concluída", nao_aplica: "Não se aplica" },
    quemAge: { escritorio: "Escritório", cliente: "Cliente", cartorio: "Cartório", prefeitura: "Prefeitura", orgao: "Órgão", confrontante: "Confrontante", terceiro: "Terceiro" },
    orgao: { cartorio: "Cartório", incra_sigef: "INCRA / SIGEF", intermat: "INTERMAT", prefeitura: "Prefeitura", ambiental: "Órgão ambiental", outro: "Outro" },
    sitProtocolo: { em_analise: "Em análise", exigencia: "Em exigência", deferido: "Deferido", indeferido: "Indeferido", registrado: "Registrado", cancelado: "Cancelado" },
    sitExigencia: { aberta: "Aberta", cumprida: "Cumprida", cancelada: "Cancelada" },
    docTipo: { planta: "Planta", memorial: "Memorial", art_trt: "ART/TRT", requerimento: "Requerimento", carta_anuencia: "Carta de anuência", planilha_sigef: "Planilha SIGEF", relatorio: "Relatório", outro: "Outro" },
    docSit: { elaboracao: "Em elaboração", enviado_assinatura: "Enviado p/ assinatura", assinado: "Assinado", protocolado: "Protocolado", entregue: "Entregue" },
    anuencia: { pendente: "Pendente", assinou: "Assinou", recusou: "Recusou", notificar_cartorio: "Notificar pelo cartório", nao_precisa: "Não precisa" },
    papelParte: { confrontante: "Confrontante", anuente: "Anuente", cliente: "Cliente (assina)" },
    papelImovel: { proprietario: "Proprietário", possuidor: "Possuidor", representante: "Representante", outro: "Outro" },
    evento: { desmembramento: "Desmembramento", remembramento: "Remembramento", retificacao: "Retificação", unificacao: "Unificação", outro: "Outro" },
    tipoComp: { campo: "Campo", reuniao: "Reunião", cartorio: "Cartório", orgao: "Órgão", outro: "Outro" },
    sitComp: { agendado: "Agendado", feito: "Feito", cancelado: "Cancelado" },
    tipoCusta: { cartorio: "Cartório", emolumentos: "Emolumentos", art_trt: "ART/TRT", taxa_orgao: "Taxa de órgão", deslocamento: "Deslocamento", terceirizado: "Terceirizado", outro: "Outro" },
    unidade: { m2: "m²", ha: "ha", alq_mineiro: "alq. mineiro", alq_goiano: "alq. goiano", alq_paulista: "alq. paulista", alq_baiano: "alq. baiano", alq_norte: "alq. do norte" },
    tipoServico: {
      georreferenciamento_rural: "Georreferenciamento rural", georreferenciamento_urbano: "Georreferenciamento urbano",
      desmembramento: "Desmembramento", remembramento: "Remembramento", unificacao: "Unificação", retificacao_urbana: "Retificação urbana",
      intermat: "INTERMAT", levantamento: "Levantamento topográfico", usucapiao: "Usucapião", car: "CAR", dla: "DLA", prad: "PRAD",
      apf: "APF", licenciamento: "Licenciamento ambiental", outorga: "Outorga de água", outro: "Outro",
    },
  };
  P.AMBIENTAIS = new Set([ "car", "dla", "prad", "apf", "licenciamento", "outorga" ]);
  P.areaDoServico = (s) => {
    const m = s.modelo_id && P.porId("modelos", s.modelo_id);
    if (m?.area) return m.area;
    return P.AMBIENTAIS.has(s.tipo) ? "ambiental" : "agrimensura";
  };
  P.opcoes = (mapa) => Object.entries(mapa);

  // ---------------- utilidades ----------------
  let toastTimer = null;
  P.toast = (msg, ms = 3800) => {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  };
  P.hojeISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  P.somarDias = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  P.dataBR = (iso) => { if (!iso) return ""; const [ a, m, d ] = String(iso).slice(0, 10).split("-"); return `${d}/${m}/${a}`; };
  P.dataHoraBR = (ts) => { if (!ts) return ""; const d = new Date(ts); return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };
  P.diasAte = (iso) => Math.round((new Date(String(iso).slice(0, 10) + "T12:00:00") - new Date(P.hojeISO() + "T12:00:00")) / 86400000);
  P.quando = (iso) => {
    if (!iso) return { txt: "sem data", atrasado: true };
    const dias = P.diasAte(iso);
    if (dias < 0) return { txt: `atrasado ${-dias} dia${dias === -1 ? "" : "s"}`, atrasado: true };
    if (dias === 0) return { txt: "hoje", atrasado: false, hoje: true };
    if (dias === 1) return { txt: "amanhã", atrasado: false };
    return { txt: P.dataBR(iso), atrasado: false };
  };
  P.moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  P.numero = (v, casas = 2) => (v == null || v === "") ? "" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: casas });
  P.area = (v, u) => v == null ? "" : `${P.numero(v, 4)} ${P.R.unidade[u] || u || ""}`.trim();
  P.semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  P.contem = (texto, busca) => !busca || P.semAcento(texto).includes(P.semAcento(busca));
  P.nomeUsuario = (uid) => (uid && P.estado.equipe.find((u) => u.usuario_id === uid)?.nome) || (uid ? "—" : "");
  P.pode = (chave) => !!P.estado.perm?.[chave];
  P.selo = (txt, cls = "") => `<span class="selo ${cls}">${esc(txt)}</span>`;
  P.vazio = (txt) => `<div class="vazio">${esc(txt)}</div>`;

  // ---------------- pasta do processo ----------------
  const CHAVE_PASTA = "skl_proc_pasta_raiz";
  P.pastaRaiz = () => lerLocal(CHAVE_PASTA);
  P.definirPastaRaiz = (v) => gravarLocal(CHAVE_PASTA, v);
  P.ehAbsoluto = (c) => /^[a-zA-Z]:[\\/]/.test(c) || /^\\\\/.test(c);
  P.caminhoCompleto = (pasta, sub) => {
    let p = String(pasta || "").trim();
    if (!p) return "";
    if (!P.ehAbsoluto(p)) {
      const raiz = P.pastaRaiz().replace(/[\\/]+$/, "");
      if (!raiz) return "";
      p = `${raiz}\\${p.replace(/^[\\/]+/, "")}`;
    }
    if (sub) p = `${p.replace(/[\\/]+$/, "")}\\${String(sub).replace(/^[\\/]+/, "")}`;
    return p;
  };
  P.abrirPasta = async (pasta, sub) => {
    let caminho = P.caminhoCompleto(pasta, sub);
    if (!NO_PC) { P.toast(caminho ? `Pasta: ${caminho} (abre só no programa do computador)` : "Pasta não informada.", 6000); return; }
    if (!String(pasta || "").trim()) { P.toast("Este processo não tem pasta informada."); return; }
    if (!caminho) { P.toast("Configure a pasta raiz deste computador em Configurações."); return; }
    if (sub && /\.[a-z0-9]{2,5}$/i.test(sub)) caminho = caminho.replace(/[\\/][^\\/]+$/, ""); // arquivo: abre a pasta dele
    const r = await window.sklDesktop.abrirPasta(caminho);
    if (!r.ok) P.toast(r.erro === "PASTA_NAO_ENCONTRADA" ? `Pasta não encontrada neste computador: ${caminho}` : `Não abriu a pasta: ${r.erro}`, 6000);
  };

  // ---------------- dados em memória ----------------
  const TABELAS = {
    pessoas: "proc_pessoas", imoveis: "proc_imoveis", imovel_pessoas: "proc_imovel_pessoas", matriculas: "proc_matriculas",
    matricula_origens: "proc_matricula_origens", projetos: "proc_projetos", projeto_imoveis: "proc_projeto_imoveis",
    modelos: "proc_modelos", servicos: "proc_servicos", servico_etapas: "proc_servico_etapas", pendencias: "proc_pendencias",
    protocolos: "proc_protocolos", exigencias: "proc_exigencias", documentos: "proc_documentos", partes: "proc_partes",
    compromissos: "proc_compromissos", custas: "proc_custas", contas: "proc_contas", notas: "proc_notas", recebiveis: "proc_recebiveis",
  };
  const FINANCEIRAS = new Set([ "contas", "notas", "recebiveis" ]);
  async function lerTabela(nome) {
    if (FINANCEIRAS.has(nome) && !P.pode("ver_financeiro")) return [];
    const todos = []; const passo = 1000;
    for (let de = 0; de < 50000; de += passo) {
      const { data, error } = await sb.from(TABELAS[nome]).select("*").eq("escritorio_id", P.estado.escritorio.id).range(de, de + passo - 1);
      if (error) throw error;
      todos.push(...data);
      if (data.length < passo) break;
    }
    return todos;
  }
  P.carregar = async (nomes) => {
    const lista = nomes || Object.keys(TABELAS);
    const res = await Promise.all(lista.map(lerTabela));
    lista.forEach((n, i) => { P.dados[n] = res[i]; });
    indexar();
  };
  let indice = {};
  function indexar() {
    indice = {};
    for (const [ n, linhas ] of Object.entries(P.dados)) indice[n] = new Map((linhas || []).map((l) => [ l.id, l ]));
  }
  P.porId = (tabela, id) => (id && indice[tabela]?.get(id)) || null;

  // ---------------- gravação ----------------
  const ERROS = {
    FORBIDDEN: "Você não tem permissão para isso.", VERSION_CONFLICT: "Alguém alterou isto agora há pouco. Atualizei a tela; confira e tente de novo.",
    DOCUMENTO_TRAVADO: "Documento protocolado/entregue fica travado: crie uma nova versão.", NAO_ENCONTRADO: "Registro não encontrado.",
    NAO_ALTERA_A_SI_MESMO: "Você não pode mudar o próprio tipo de acesso.", SENHA_CURTA: "A senha precisa de pelo menos 6 caracteres.",
    EMAIL_INVALIDO: "E-mail inválido.", CONTA_COMPARTILHADA: "Essa conta também é usada em outro sistema ou escritório: a senha só pode ser trocada pela própria pessoa (Esqueci minha senha).",
    TEXTO_OBRIGATORIO: "Escreva o texto.", PAPEL_INVALIDO: "Tipo de acesso inválido.",
  };
  P.msgErro = (e) => {
    const m = String(e?.message || e?.erro || e || "");
    for (const [ k, v ] of Object.entries(ERROS)) if (m.includes(k)) return v;
    if (/foreign key/i.test(m)) return "Registro ligado a outro que não existe mais. Atualize a tela.";
    if (/fetch|network|Failed to/i.test(m)) return "Sem conexão com o servidor. Confira a internet.";
    return m || "Erro inesperado.";
  };
  P.salvar = async (tabela, dados, { recarregar = true } = {}) => {
    const corpo = { ...dados, escritorio_id: P.estado.escritorio.id };
    for (const k of Object.keys(corpo)) if (corpo[k] === undefined) delete corpo[k];
    if (!corpo.id) delete corpo.id;
    const { data, error } = await sb.rpc("proc_salvar", { p_tabela: tabela, p_dados: corpo });
    if (error) {
      if (String(error.message).includes("VERSION_CONFLICT")) await P.carregar([ tabela ]);
      throw new Error(P.msgErro(error));
    }
    if (recarregar) await P.carregar([ tabela ]);
    return data;
  };
  P.excluir = async (tabela, id, recarregar) => {
    const { error } = await sb.rpc("proc_excluir", { p_tabela: tabela, p_id: id });
    if (error) throw new Error(P.msgErro(error));
    await P.carregar(recarregar || Object.keys(TABELAS));
  };
  P.anotar = async (projetoId, texto, servicoId) => {
    const { error } = await sb.rpc("proc_anotar", { p_projeto: projetoId, p_texto: texto, p_servico: servicoId || null });
    if (error) throw new Error(P.msgErro(error));
  };
  P.historico = async (filtro) => {
    let q = sb.from("proc_historico").select("*").eq("escritorio_id", P.estado.escritorio.id).order("created_at", { ascending: false }).limit(300);
    for (const [ k, v ] of Object.entries(filtro)) q = q.eq(k, v);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  };

  // ---------------- formulário genérico (diálogo) ----------------
  // campos: [{id, rotulo, tipo: text|textarea|number|date|datetime|select|checkbox|email|tel, opcoes:[[v,l]], obrig, ajuda, largura:'inteira'}]
  P.form = ({ titulo, subtitulo, campos, valores = {}, salvarTexto = "Salvar", aoSalvar, aoExcluir, excluirTexto = "Excluir" }) => new Promise((resolve) => {
    const d = document.createElement("dialog");
    d.className = "form-dialog";
    const html = campos.map((c) => {
      if (c.tipo === "titulo") return `<h3 class="form-secao">${esc(c.rotulo)}</h3>`;
      let v = valores[c.id]; if (v == null) v = c.padrao ?? "";
      const req = c.obrig ? "required" : "";
      const larg = c.largura === "inteira" || c.tipo === "textarea" ? "inteira" : "";
      let entrada = "";
      if (c.tipo === "textarea") entrada = `<textarea name="${c.id}" rows="${c.linhas || 3}" ${req}>${esc(v)}</textarea>`;
      else if (c.tipo === "select") {
        const ops = (typeof c.opcoes === "function" ? c.opcoes() : c.opcoes) || [];
        entrada = `<select name="${c.id}" ${req}>${c.vazio !== false ? `<option value="">${esc(c.vazio || "—")}</option>` : ""}${ops.map(([ ov, ol ]) => `<option value="${esc(ov)}" ${String(ov) === String(v) ? "selected" : ""}>${esc(ol)}</option>`).join("")}</select>`;
      } else if (c.tipo === "checkbox") entrada = `<span class="check"><input type="checkbox" name="${c.id}" ${v ? "checked" : ""}> ${esc(c.texto || "")}</span>`;
      else if (c.tipo === "datetime") {
        let vv = ""; if (v) { const dt = new Date(v); dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset()); vv = dt.toISOString().slice(0, 16); }
        entrada = `<input type="datetime-local" name="${c.id}" value="${vv}" ${req}>`;
      } else entrada = `<input type="${c.tipo === "number" ? "number" : c.tipo || "text"}" ${c.tipo === "number" ? `step="${c.passo || "any"}"` : ""} name="${c.id}" value="${esc(c.tipo === "date" ? String(v).slice(0, 10) : v)}" ${req} ${c.placeholder ? `placeholder="${esc(c.placeholder)}"` : ""}>`;
      return `<label class="${larg}">${esc(c.rotulo)}${c.obrig ? " *" : ""}${entrada}${c.ajuda ? `<small>${esc(c.ajuda)}</small>` : ""}</label>`;
    }).join("");
    d.innerHTML = `<form method="dialog" class="form-corpo">
      <header><h2>${esc(titulo)}</h2>${subtitulo ? `<p class="ajuda">${esc(subtitulo)}</p>` : ""}</header>
      <div class="form-campos">${html}</div>
      <p class="erro" hidden></p>
      <footer>
        ${aoExcluir ? `<button type="button" class="botao perigo" data-f="excluir">${esc(excluirTexto)}</button>` : ""}
        <span class="espaco"></span>
        <button type="button" class="botao" data-f="cancelar">Cancelar</button>
        <button type="submit" class="botao-principal" data-f="salvar">${esc(salvarTexto)}</button>
      </footer></form>`;
    document.body.appendChild(d);
    const fechar = (r) => { d.close(); d.remove(); resolve(r); };
    const erro = d.querySelector(".erro");
    d.addEventListener("cancel", (e) => { e.preventDefault(); fechar(null); });
    d.querySelector('[data-f="cancelar"]').onclick = () => fechar(null);
    if (aoExcluir) d.querySelector('[data-f="excluir"]').onclick = async () => {
      if (!confirm("Excluir mesmo? Isto não pode ser desfeito.")) return;
      try { await aoExcluir(); fechar("excluido"); } catch (e) { erro.textContent = P.msgErro(e); erro.hidden = false; }
    };
    d.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target; const out = {};
      for (const c of campos) {
        if (c.tipo === "titulo") continue;
        const el = f.elements[c.id];
        if (c.tipo === "checkbox") out[c.id] = el.checked;
        else if (c.tipo === "number") out[c.id] = el.value === "" ? null : Number(el.value);
        else if (c.tipo === "datetime") out[c.id] = el.value ? new Date(el.value).toISOString() : null;
        else out[c.id] = el.value.trim() === "" ? null : el.value.trim();
      }
      const bt = d.querySelector('[data-f="salvar"]'); bt.disabled = true; erro.hidden = true;
      try { const r = aoSalvar ? await aoSalvar(out) : out; fechar(r ?? out); }
      catch (err) { erro.textContent = P.msgErro(err); erro.hidden = false; bt.disabled = false; }
    };
    d.showModal();
    d.querySelector("input,select,textarea")?.focus();
  });

  // listas de opções usadas nos formulários
  P.opPessoas = () => (P.dados.pessoas || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((p) => [ p.id, p.nome + (p.apelido ? ` (${p.apelido})` : "") ]);
  P.opImoveis = () => (P.dados.imoveis || []).slice().sort((a, b) => a.denominacao.localeCompare(b.denominacao, "pt-BR")).map((i) => [ i.id, `${i.denominacao}${i.municipio ? " — " + i.municipio : ""}` ]);
  P.opEquipe = () => P.estado.equipe.filter((u) => u.ativo).map((u) => [ u.usuario_id, u.nome ]);
  P.opMatriculas = () => (P.dados.matriculas || []).map((m) => [ m.id, `Matrícula ${m.numero}${m.cartorio ? " — " + m.cartorio : ""}` ]);

  // pessoa nova rápida (usada dentro de outros formulários)
  P.novaPessoa = async (nomeInicial) => {
    const r = await P.form({
      titulo: "Nova pessoa", campos: P.camposPessoa(), valores: { nome: nomeInicial || "", tipo: "pf" },
      aoSalvar: (v) => P.salvar("pessoas", v),
    });
    return r && r.id ? r : null;
  };
  P.camposPessoa = () => [
    { id: "tipo", rotulo: "Tipo", tipo: "select", opcoes: [ [ "pf", "Pessoa física" ], [ "pj", "Empresa" ] ], vazio: false },
    { id: "nome", rotulo: "Nome", obrig: true },
    { id: "apelido", rotulo: "Apelido / como chamam" },
    { id: "documento", rotulo: "CPF ou CNPJ" },
    { id: "celular", rotulo: "Celular / WhatsApp", tipo: "tel" },
    { id: "telefone", rotulo: "Outro telefone", tipo: "tel" },
    { id: "email", rotulo: "E-mail", tipo: "email" },
    { id: "observacoes", rotulo: "Observações", tipo: "textarea" },
  ];

  // ---------------- páginas e menu ----------------
  const MENU = [
    [ "hoje", "Hoje" ], [ "processos", "Processos" ], [ "imoveis", "Imóveis" ], [ "pessoas", "Pessoas" ],
    [ "agenda", "Agenda" ], [ "financeiro", "Financeiro" ], [ "tutoriais", "Tutoriais" ], [ "config", "Configurações" ],
  ];
  P.pagina = (nome, def) => { P.paginas[nome] = def; };
  function montarMenu() {
    $("menu").innerHTML = MENU.filter(([ n ]) => n !== "financeiro" || P.pode("ver_financeiro") || P.pode("lancar_custas"))
      .map(([ n, t ]) => `<button type="button" data-pagina="${n}">${t}</button>`).join("");
    $("paginas").innerHTML = MENU.map(([ n ]) => `<div id="page-${n}" class="pagina" hidden></div>`).join("");
  }
  $("menu").addEventListener("click", (e) => { const p = e.target.closest("[data-pagina]")?.dataset.pagina; if (p) P.ir(p); });
  P.ir = (pagina, param = null, { historico = true } = {}) => {
    if (!P.paginas[pagina] || !$("page-" + pagina)) pagina = "hoje";
    P.estado.pagina = pagina; P.estado.param = param;
    for (const b of $("menu").querySelectorAll("[data-pagina]")) b.classList.toggle("ativo", b.dataset.pagina === pagina);
    for (const el of $("paginas").children) el.hidden = el.id !== "page-" + pagina;
    $("tituloPagina").textContent = P.paginas[pagina].titulo;
    if (historico) { try { history.pushState({ pagina, param }, ""); } catch { /* file: */ } }
    P.redesenhar();
    window.scrollTo(0, 0);
  };
  P.redesenhar = () => {
    const pg = P.estado.pagina; const def = P.paginas[pg]; const el = $("page-" + pg);
    if (!def || !el) return;
    try { const r = def.render(el, P.estado.param); if (r?.catch) r.catch((e) => { el.innerHTML = P.vazio("Erro: " + P.msgErro(e)); }); }
    catch (e) { console.error(e); el.innerHTML = P.vazio("Erro ao montar a tela: " + P.msgErro(e)); }
  };
  window.addEventListener("popstate", (e) => {
    if (document.querySelector("dialog[open]")) return;
    const s = e.state; if (s?.pagina && P.estado.escritorio) P.ir(s.pagina, s.param, { historico: false });
  });
  P.abrirProjeto = (id, aba) => P.ir("processos", { projeto: id, aba });
  P.abrirImovel = (id) => P.ir("imoveis", { imovel: id });
  P.abrirPessoa = (id) => P.ir("pessoas", { pessoa: id });

  // A política de segurança da página (CSP) não deixa usar style="" no HTML: larguras/alturas vêm de data-*
  // e são aplicadas por JS (permitido) sempre que uma tela é desenhada.
  new MutationObserver(() => {
    document.querySelectorAll("[data-largura]").forEach((el) => { el.style.width = el.dataset.largura + "%"; el.removeAttribute("data-largura"); });
    document.querySelectorAll("[data-altura]").forEach((el) => { el.style.height = el.dataset.altura + "%"; el.removeAttribute("data-altura"); });
  }).observe(document.body, { childList: true, subtree: true });

  // ---------------- tempo real ----------------
  let canal = null; let timerRt = null; let pendenteRt = false;
  function ligarTempoReal() {
    if (canal) sb.removeChannel(canal);
    const E = P.estado.escritorio.id;
    canal = sb.channel("proc-" + E);
    for (const t of Object.values(TABELAS)) {
      canal.on("postgres_changes", { event: "*", schema: "public", table: t, filter: `escritorio_id=eq.${E}` }, () => agendarAtualizacao());
    }
    canal.subscribe((st) => {
      const el = $("statusConexao");
      el.classList.toggle("on", st === "SUBSCRIBED");
      el.title = st === "SUBSCRIBED" ? "Conectado: o que outro computador alterar aparece aqui" : "Reconectando…";
    });
  }
  function agendarAtualizacao() {
    clearTimeout(timerRt);
    timerRt = setTimeout(async () => {
      if (document.querySelector("dialog[open]")) { pendenteRt = true; return; }
      try { await P.carregar(); P.redesenhar(); } catch { /* tenta no próximo aviso */ }
    }, 700);
  }
  document.addEventListener("close", () => { if (pendenteRt) { pendenteRt = false; agendarAtualizacao(); } }, true);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && P.estado.escritorio) agendarAtualizacao(); });

  // ---------------- entrada ----------------
  function mostrar(view) { for (const v of [ "loginView", "escolhaView", "appView" ]) $(v).hidden = v !== view; }
  $("versaoLogin").textContent = "v" + APP_VERSION;
  $("versaoApp").textContent = "SKL Processos v" + APP_VERSION;
  $("loginEmail").value = lerLocal("skl_proc_ultimo_email");
  $("loginVerSenha").addEventListener("click", () => {
    const i = $("loginSenha"); const ver = i.type === "password";
    i.type = ver ? "text" : "password"; $("loginVerSenha").textContent = ver ? "Ocultar" : "Mostrar";
  });
  const erroLogin = (m) => { $("loginErro").textContent = m; $("loginErro").hidden = !m; };
  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault(); erroLogin(""); $("loginAviso").hidden = true;
    const bt = $("loginEntrar"); bt.disabled = true; bt.textContent = "Entrando…";
    try {
      const { error } = await sb.auth.signInWithPassword({ email: $("loginEmail").value.trim(), password: $("loginSenha").value });
      if (error) throw error;
      gravarLocal("skl_proc_ultimo_email", $("loginEmail").value.trim());
      $("loginSenha").value = "";
      await entrar();
    } catch (err) {
      const m = String(err?.message || err);
      erroLogin(/invalid login/i.test(m) ? "E-mail ou senha incorretos." : P.msgErro(err));
    } finally { bt.disabled = false; bt.textContent = "Entrar"; }
  });
  $("loginEsqueci").addEventListener("click", async () => {
    const email = $("loginEmail").value.trim();
    if (!email) { erroLogin("Escreva seu e-mail no campo acima e toque de novo em \"Esqueci minha senha\"."); return; }
    erroLogin("");
    const { error } = await sb.auth.resetPasswordForEmail(email, LINK ? { redirectTo: LINK } : undefined);
    if (error) { erroLogin(P.msgErro(error)); return; }
    $("loginAviso").textContent = `Se ${email} tiver acesso, chega um e-mail com o link para criar uma senha nova. Confira também o spam.`;
    $("loginAviso").hidden = false;
  });
  sb.auth.onAuthStateChange((ev) => {
    if (ev === "PASSWORD_RECOVERY") { mostrar("loginView"); $("loginForm").hidden = true; $("novaSenhaForm").hidden = false; }
  });
  $("novaSenhaForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const a = $("novaSenha1").value, b = $("novaSenha2").value, er = $("novaSenhaErro");
    er.hidden = true;
    if (a.length < 6) { er.textContent = "A senha precisa de pelo menos 6 caracteres."; er.hidden = false; return; }
    if (a !== b) { er.textContent = "As duas senhas não são iguais."; er.hidden = false; return; }
    const { error } = await sb.auth.updateUser({ password: a });
    if (error) { er.textContent = P.msgErro(error); er.hidden = false; return; }
    $("novaSenhaForm").hidden = true; $("loginForm").hidden = false;
    try { history.replaceState(null, "", location.pathname); } catch { /* */ }
    P.toast("Senha nova salva.");
    await entrar();
  });

  async function sair() {
    if (canal) { sb.removeChannel(canal); canal = null; }
    await sb.auth.signOut({ scope: "local" }).catch(() => {});
    P.estado.usuario = null; P.estado.escritorio = null; P.dados = {};
    mostrar("loginView");
  }
  P.sair = sair;
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-acao]")?.dataset.acao;
    if (a === "sair") sair();
    if (a === "trocar") { gravarLocal("skl_proc_escritorio", ""); mostrarEscolha(); }
  });

  async function entrar() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { mostrar("loginView"); return; }
    P.estado.usuario = session.user;
    const { data, error } = await sb.from("proc_escritorio_usuarios")
      .select("escritorio_id, papel, proc_escritorios(id, nome, ativo, config, cidade, uf, cnpj)")
      .eq("usuario_id", session.user.id).eq("ativo", true);
    if (error) {
      if (/fetch|network|Failed/i.test(error.message)) { erroLogin("Sem conexão com o servidor. Tentando de novo…"); mostrar("loginView"); setTimeout(entrar, 8000); return; }
      erroLogin(error.message); mostrar("loginView"); return;
    }
    P.estado.escritorios = (data || []).filter((r) => r.proc_escritorios && r.proc_escritorios.ativo !== false)
      .map((r) => ({ ...r.proc_escritorios, papel: r.papel }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    if (!P.estado.escritorios.length) {
      erroLogin("Seu login não tem acesso a nenhum escritório no SKL Processos.");
      await sb.auth.signOut({ scope: "local" }); mostrar("loginView"); return;
    }
    const guardado = P.estado.escritorios.find((x) => x.id === lerLocal("skl_proc_escritorio"));
    if (guardado || P.estado.escritorios.length === 1) await abrirEscritorio(guardado || P.estado.escritorios[0]);
    else mostrarEscolha();
  }
  function mostrarEscolha() {
    $("escolhaLista").innerHTML = P.estado.escritorios.map((x) =>
      `<button type="button" data-esc="${esc(x.id)}"><strong>${esc(x.nome)}</strong><br><small>${esc(P.R.papel[x.papel] || x.papel)}</small></button>`).join("");
    mostrar("escolhaView");
  }
  $("escolhaLista").addEventListener("click", (e) => {
    const x = P.estado.escritorios.find((y) => y.id === e.target.closest("[data-esc]")?.dataset.esc);
    if (x) abrirEscritorio(x);
  });
  P.recarregarEquipe = async () => {
    const { data } = await sb.rpc("proc_equipe", { p_escritorio: P.estado.escritorio.id });
    P.estado.equipe = data || [];
  };
  async function abrirEscritorio(x) {
    P.estado.escritorio = x;
    gravarLocal("skl_proc_escritorio", x.id);
    $("nomeEscritorio").textContent = x.nome;
    $("botaoTrocar").hidden = P.estado.escritorios.length < 2;
    $("paginas").innerHTML = P.vazio("Carregando…");
    mostrar("appView");
    const { data: perm } = await sb.rpc("proc_minhas_permissoes", { p_escritorio: x.id });
    P.estado.perm = perm || {};
    await P.recarregarEquipe();
    const eu = P.estado.equipe.find((u) => u.usuario_id === P.estado.usuario.id);
    $("nomeUsuario").textContent = `${eu?.nome || P.estado.usuario.email} · ${P.R.papel[P.estado.perm.papel] || ""}`;
    montarMenu();
    try { await P.carregar(); } catch (e) { $("paginas").innerHTML = P.vazio("Não carregou os dados: " + P.msgErro(e)); return; }
    ligarTempoReal();
    P.ir("hoje");
  }
  P.iniciar = async () => {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (location.hash.includes("type=recovery")) return; // a tela de nova senha aparece pelo evento PASSWORD_RECOVERY
      if (session) await entrar(); else mostrar("loginView");
    } catch { mostrar("loginView"); }
  };
})();

// SKL Processos — Processos: lista, quadro por situação do serviço e a ficha completa do processo.
(() => {
  "use strict";
  const P = window.SKLProc; const { esc } = P;
  const filtro = { busca: "", situacao: "ativo", area: "", tipoImovel: "", meus: false, visao: P.lerLocal("skl_proc_visao") || "lista" };
  const abaPadrao = () => P.lerLocal("skl_proc_aba") || "servicos";
  P.abrirProcessosCom = (opcoes) => { Object.assign(filtro, { busca: "", area: "", tipoImovel: "", meus: false }, opcoes); P.ir("processos"); };

  // imóveis do cliente escolhido primeiro (no "Novo processo"), com "Mostrar todos…"
  const imoveisDoCliente = (cli, todos) => {
    const novo = [ [ "__novo", "+ Cadastrar novo imóvel…" ] ];
    if (!cli || cli === "__nova" || todos) return [ ...novo, ...P.opImoveis() ];
    const ids = new Set((P.dados.imovel_pessoas || []).filter((x) => x.pessoa_id === cli).map((x) => x.imovel_id));
    const meus = P.opImoveis().filter(([ id ]) => ids.has(id));
    return [ ...novo, ...meus, [ "__todos", meus.length ? "Mostrar todos os imóveis…" : "Este cliente ainda não tem imóvel · mostrar todos…" ] ];
  };

  // ======================= LISTA / QUADRO =======================
  function projetosFiltrados() {
    const eu = P.estado.usuario.id;
    return (P.dados.projetos || []).filter((p) => {
      if (filtro.situacao && p.situacao !== filtro.situacao) return false;
      const servs = P.servicosDoProjeto(p.id);
      if (filtro.area && !servs.some((s) => P.areaDoServico(s) === filtro.area)) return false;
      const imvs = P.imoveisDoProjeto(p.id);
      if (filtro.tipoImovel && !imvs.some((i) => i.tipo === filtro.tipoImovel)) return false;
      if (filtro.meus && p.responsavel_id !== eu && !servs.some((s) => s.responsavel_id === eu)
        && !(P.dados.pendencias || []).some((x) => x.projeto_id === p.id && x.situacao === "aberta" && x.acompanha_id === eu)) return false;
      if (filtro.busca) {
        const cli = P.clienteDe(p);
        const txt = [ p.codigo, p.titulo, cli?.nome, cli?.apelido, ...imvs.map((i) => `${i.denominacao} ${i.municipio}`), ...servs.map((s) => s.titulo) ].join(" ");
        if (!P.contem(txt, filtro.busca)) return false;
      }
      return true;
    }).sort((a, b) => (b.codigo || "").localeCompare(a.codigo || ""));
  }

  function proximaAcao(p) {
    const pend = (P.dados.pendencias || []).filter((x) => x.projeto_id === p.id && x.situacao === "aberta")
      .sort((a, b) => (a.conferir_em || "0").localeCompare(b.conferir_em || "0"))[0];
    if (pend) return { txt: pend.descricao, quem: P.quemAgeTexto(pend), q: P.quando(pend.conferir_em || pend.prazo) };
    const s = P.servicosDoProjeto(p.id).find((x) => x.proxima_acao && ![ "concluido", "cancelado" ].includes(x.situacao));
    return s ? { txt: s.proxima_acao, quem: "", q: null } : null;
  }

  function renderLista(el) {
    const lista = projetosFiltrados();
    const lim = P.limiteParado();
    const linhas = lista.map((p) => {
      const cli = P.clienteDe(p); const imvs = P.imoveisDoProjeto(p.id); const servs = P.servicosDoProjeto(p.id);
      const pa = proximaAcao(p); const parado = p.situacao === "ativo" ? P.diasParado(p.id) : 0;
      const areas = new Set(servs.map(P.areaDoServico));
      return `<li class="proc-item clicavel" data-projeto="${p.id}">
        <div class="proc-cab">${P.selo(p.codigo || "")}<strong>${esc(p.titulo)}</strong>
          ${p.situacao !== "ativo" ? P.selo(P.R.sitProjeto[p.situacao], "sit-" + p.situacao) : ""}
          ${[ ...areas ].map((a) => P.selo(a === "ambiental" ? "Ambiental" : "Agrimensura", a)).join("")}
          ${parado >= lim ? P.selo(`parado há ${parado} dias`, "alerta") : ""}</div>
        <div class="sub">${esc(cli?.nome || "sem cliente")}${imvs.length ? " · " + imvs.map((i) => `${esc(i.denominacao)} ${P.selo(i.tipo === "rural" ? "Rural" : "Urbano", i.tipo)}`).join(", ") : ""}</div>
        <div class="proc-servs">${servs.map((s) => {
          const at = P.etapaAtual(s.id); const pr = P.progresso(s.id);
          return `<span class="serv-chip sit-${s.situacao}">${esc(s.titulo)} · ${esc(P.R.sitServico[s.situacao])}${at && ![ "concluido", "cancelado" ].includes(s.situacao) ? ` — ${esc(at.nome)}` : ""}${pr ? ` (${pr.feitas}/${pr.total})` : ""}</span>`;
        }).join("")}</div>
        ${pa ? `<div class="sub prox">Próxima ação: <strong>${esc(pa.txt)}</strong>${pa.quem ? ` · quem age: ${esc(pa.quem)}` : ""}${pa.q ? ` · <span class="${pa.q.atrasado ? "txt-alerta" : ""}">${esc(pa.q.txt)}</span>` : ""}</div>` : ""}
        <div class="sub">Responsável: ${esc(P.nomeUsuario(p.responsavel_id))}${p.previsao ? ` · previsão ${esc(P.dataBR(p.previsao))}` : ""}</div>
      </li>`;
    });
    return `<div class="cartao"><ul class="lista-proc">${linhas.join("") || `<li>${P.vazio("Nenhum processo com esses filtros.")}</li>`}</ul></div>`;
  }

  const COLUNAS = [ "nao_iniciado", "em_andamento", "aguardando", "concluido" ];
  function renderQuadro() {
    const ids = new Set(projetosFiltrados().map((p) => p.id));
    const servs = (P.dados.servicos || []).filter((s) => ids.has(s.projeto_id));
    const podeMover = P.pode("editar_processos");
    return `<div class="quadro">${COLUNAS.map((c) => {
      const cards = servs.filter((s) => s.situacao === c);
      return `<div class="coluna" data-coluna="${c}"><h3>${esc(P.R.sitServico[c])} <span class="contador">${cards.length}</span></h3>
        ${cards.map((s) => {
          const p = P.porId("projetos", s.projeto_id); const at = P.etapaAtual(s.id); const pr = P.progresso(s.id);
          return `<div class="card-serv ${P.areaDoServico(s)}" ${podeMover ? 'draggable="true"' : ""} data-servico="${s.id}" data-projeto="${s.projeto_id}">
            <div>${P.selo(p?.codigo || "")}<strong>${esc(s.titulo)}</strong></div>
            <div class="sub">${esc(p?.titulo || "")}</div>
            ${at && c !== "concluido" ? `<div class="sub">Etapa: ${esc(at.nome)}${pr ? ` (${pr.feitas}/${pr.total})` : ""}</div>` : ""}
            <div class="sub">${esc(P.nomeUsuario(s.responsavel_id))}</div>
            ${podeMover ? `<select class="mover" data-mover="${s.id}" aria-label="Mudar situação">${COLUNAS.concat("cancelado").map((o) => `<option value="${o}" ${o === s.situacao ? "selected" : ""}>${esc(P.R.sitServico[o])}</option>`).join("")}</select>` : ""}
          </div>`;
        }).join("") || `<div class="vazio pequeno">—</div>`}</div>`;
    }).join("")}</div>`;
  }

  async function moverServico(id, situacao) {
    const s = P.porId("servicos", id); if (!s || s.situacao === situacao) return;
    const extra = {};
    if (situacao === "concluido" && !s.concluido_em) extra.concluido_em = P.hojeISO();
    if (situacao === "em_andamento" && !s.iniciado_em) extra.iniciado_em = P.hojeISO();
    try { await P.salvar("servicos", { id, version: s.version, situacao, ...extra }); P.redesenhar(); P.toast(`${s.titulo}: ${P.R.sitServico[situacao]}`); }
    catch (e) { P.toast(e.message); P.redesenhar(); }
  }

  function renderPaginaLista(el) {
    el.innerHTML = `
      <div class="barra-filtros">
        <input type="search" id="pfBusca" placeholder="Filtrar por código, cliente, imóvel, serviço…" value="${esc(filtro.busca)}">
        <select id="pfSit"><option value="">Todas as situações</option>${P.opcoes(P.R.sitProjeto).map(([ v, l ]) => `<option value="${v}" ${filtro.situacao === v ? "selected" : ""}>${l}</option>`).join("")}</select>
        <select id="pfArea"><option value="">Agrimensura e ambiental</option><option value="agrimensura" ${filtro.area === "agrimensura" ? "selected" : ""}>Só agrimensura</option><option value="ambiental" ${filtro.area === "ambiental" ? "selected" : ""}>Só ambiental</option></select>
        <select id="pfTipo"><option value="">Rural e urbano</option><option value="rural" ${filtro.tipoImovel === "rural" ? "selected" : ""}>Rural</option><option value="urbano" ${filtro.tipoImovel === "urbano" ? "selected" : ""}>Urbano</option></select>
        <label class="check"><input type="checkbox" id="pfMeus" ${filtro.meus ? "checked" : ""}> Só os meus</label>
        <span class="espaco"></span>
        <div class="alternar"><button type="button" data-visao="lista" class="${filtro.visao === "lista" ? "ativo" : ""}">Lista</button><button type="button" data-visao="quadro" class="${filtro.visao === "quadro" ? "ativo" : ""}">Quadro</button></div>
        ${P.pode("editar_processos") ? `<button type="button" class="botao-principal" id="pfNovo">+ Novo processo</button>` : ""}
      </div>
      <div id="pfConteudo">${filtro.visao === "quadro" ? renderQuadro() : renderLista()}</div>`;
    const atual = () => { el.querySelector("#pfConteudo").innerHTML = filtro.visao === "quadro" ? renderQuadro() : renderLista(); };
    el.querySelector("#pfBusca").oninput = (e) => { filtro.busca = e.target.value; atual(); };
    el.querySelector("#pfSit").onchange = (e) => { filtro.situacao = e.target.value; atual(); };
    el.querySelector("#pfArea").onchange = (e) => { filtro.area = e.target.value; atual(); };
    el.querySelector("#pfTipo").onchange = (e) => { filtro.tipoImovel = e.target.value; atual(); };
    el.querySelector("#pfMeus").onchange = (e) => { filtro.meus = e.target.checked; atual(); };
    el.querySelector("#pfNovo")?.addEventListener("click", () => P.novoProjeto());
    el.querySelectorAll("[data-visao]").forEach((b) => b.onclick = () => { filtro.visao = b.dataset.visao; P.gravarLocal("skl_proc_visao", filtro.visao); renderPaginaLista(el); });
    el.onclick = (e) => {
      if (e.target.closest("select")) return;
      const it = e.target.closest("[data-projeto]"); if (it) P.abrirProjeto(it.dataset.projeto);
    };
    el.onchange = (e) => { const m = e.target.closest("[data-mover]"); if (m) moverServico(m.dataset.mover, m.value); };
    // arrastar no quadro (computador)
    el.ondragstart = (e) => { const c = e.target.closest("[data-servico]"); if (c) e.dataTransfer.setData("text/plain", c.dataset.servico); };
    el.ondragover = (e) => { if (e.target.closest("[data-coluna]")) e.preventDefault(); };
    el.ondrop = (e) => { const col = e.target.closest("[data-coluna]"); const id = e.dataTransfer.getData("text/plain"); if (col && id) { e.preventDefault(); moverServico(id, col.dataset.coluna); } };
  }

  // ======================= NOVO / EDITAR PROJETO =======================
  const opModelos = () => (P.dados.modelos || []).filter((m) => m.ativo).sort((a, b) => (a.area + a.nome).localeCompare(b.area + b.nome, "pt-BR"))
    .map((m) => [ m.id, `${m.area === "ambiental" ? "Ambiental" : "Agrimensura"} — ${m.nome}` ]);
  const camposProjeto = (novo) => [
    { id: "titulo", rotulo: "Título do processo", obrig: true, largura: "inteira", placeholder: "Ex.: Fazenda Boa Vista — Georreferenciamento" },
    { id: "cliente_id", rotulo: "Cliente (contratante)", tipo: "select", opcoes: () => [ [ "__nova", "+ Cadastrar nova pessoa…" ], ...P.opPessoas() ] },
    ...(novo ? [ { id: "imovel_id", rotulo: "Imóvel", tipo: "select", dependeDe: "cliente_id", opcoesPor: imoveisDoCliente,
      ajuda: "Aparecem os imóveis do cliente escolhido; para outro, use \"Mostrar todos…\"." } ] : []),
    { id: "responsavel_id", rotulo: "Responsável", tipo: "select", opcoes: P.opEquipe },
    ...(novo ? [ { id: "modelo_id", rotulo: "Primeiro serviço (modelo de etapas)", tipo: "select", opcoes: opModelos, vazio: "Nenhum por enquanto" } ] : []),
    ...(!novo ? [ { id: "situacao", rotulo: "Situação", tipo: "select", opcoes: P.opcoes(P.R.sitProjeto), vazio: false } ] : []),
    { id: "contrato_em", rotulo: "Data do contrato", tipo: "date" },
    { id: "previsao", rotulo: "Previsão de entrega", tipo: "date" },
    ...(P.pode("ver_financeiro") ? [ { id: "valor_contratado", rotulo: "Valor contratado (R$)", tipo: "number", passo: "0.01" } ] : []),
    { id: "codigo", rotulo: "Código", ajuda: novo ? "Em branco = automático (ano-número)" : "" },
    { id: "pasta", rotulo: "Pasta do processo", largura: "inteira", ajuda: "Só o nome da pasta dentro da pasta raiz (ex.: 2026-031 Fazenda Santa Luzia) ou o caminho completo." },
    { id: "observacoes", rotulo: "Observações", tipo: "textarea" },
  ];
  async function resolverNovos(v) {
    if (v.cliente_id === "__nova") { const p = await P.novaPessoa(); if (!p) throw new Error("Cadastre o cliente ou escolha outro."); v.cliente_id = p.id; }
    if (v.imovel_id === "__novo") {
      const i = await P.novoImovel(); if (!i) throw new Error("Cadastre o imóvel ou escolha outro."); v.imovel_id = i.id;
      // imóvel cadastrado aqui já fica no nome do cliente (senão some da lista "imóveis do cliente")
      if (v.cliente_id) await P.salvar("imovel_pessoas", { imovel_id: i.id, pessoa_id: v.cliente_id, papel: "proprietario" });
    }
    if (v.imovel_id === "__todos") v.imovel_id = null;
  }
  P.novoProjeto = async (pre = {}) => {
    const r = await P.form({
      titulo: "Novo processo", campos: camposProjeto(true),
      valores: { responsavel_id: P.estado.usuario.id, contrato_em: P.hojeISO(), ...pre },
      salvarTexto: "Criar processo",
      aoSalvar: async (v) => {
        await resolverNovos(v);
        const { imovel_id, modelo_id, ...dados } = v;
        if (P.pode("ver_financeiro") === false) delete dados.valor_contratado;
        const proj = await P.salvar("projetos", dados);
        if (imovel_id) await P.salvar("projeto_imoveis", { projeto_id: proj.id, imovel_id }, { recarregar: false });
        if (modelo_id) {
          const { error } = await P.sb.rpc("proc_abrir_servico", { p_projeto: proj.id, p_dados: { modelo_id, imovel_id, responsavel_id: v.responsavel_id, situacao: "nao_iniciado" } });
          if (error) throw new Error(P.msgErro(error));
        }
        await P.carregar([ "projeto_imoveis", "servicos", "servico_etapas" ]);
        return proj;
      },
    });
    if (r?.id) { P.toast(`Processo ${r.codigo} criado.`); P.abrirProjeto(r.id); }
  };
  async function editarProjeto(p) {
    await P.form({
      titulo: `Editar ${p.codigo}`, campos: camposProjeto(false), valores: p,
      aoSalvar: async (v) => {
        await resolverNovos(v);
        if (v.situacao === "concluido" && !p.concluido_em) v.concluido_em = P.hojeISO();
        return P.salvar("projetos", { ...v, id: p.id, version: p.version });
      },
      aoExcluir: P.estado.perm.papel === "administrador" ? () => P.excluir("projetos", p.id) : null,
      excluirTexto: "Excluir processo",
    }).then((r) => { if (r === "excluido") P.ir("processos"); else P.redesenhar(); });
  }

  // ======================= FICHA DO PROCESSO =======================
  const ABAS = [ [ "servicos", "Serviços e etapas" ], [ "pendencias", "Pendências" ], [ "protocolos", "Protocolos e exigências" ],
    [ "assinaturas", "Confrontantes e assinaturas" ], [ "documentos", "Documentos" ], [ "financeiro", "Financeiro" ], [ "historico", "Histórico" ] ];

  function renderFicha(el, id, aba) {
    const p = P.porId("projetos", id);
    if (!p) { el.innerHTML = `<button type="button" class="link-botao" data-voltar>‹ Processos</button>${P.vazio("Processo não encontrado (pode ter sido excluído).")}`; el.querySelector("[data-voltar]").onclick = () => P.ir("processos"); return; }
    aba = aba || abaPadrao();
    const cli = P.clienteDe(p); const imvs = P.imoveisDoProjeto(p.id); const servs = P.servicosDoProjeto(p.id);
    const sids = new Set(servs.map((s) => s.id));
    const nPend = (P.dados.pendencias || []).filter((x) => x.projeto_id === p.id && x.situacao === "aberta").length;
    const protIds = new Set((P.dados.protocolos || []).filter((x) => sids.has(x.servico_id)).map((x) => x.id));
    const nExig = (P.dados.exigencias || []).filter((x) => protIds.has(x.protocolo_id) && x.situacao === "aberta").length;
    const nAss = (P.dados.partes || []).filter((x) => sids.has(x.servico_id) && [ "pendente", "recusou", "notificar_cartorio" ].includes(x.anuencia)).length;
    const pode = P.pode("editar_processos");
    const contagem = { pendencias: nPend, protocolos: nExig, assinaturas: nAss };
    el.innerHTML = `
      <button type="button" class="link-botao" data-a="voltar">‹ Processos</button>
      <div class="cartao ficha-cab">
        <div class="ficha-titulo">${P.selo(p.codigo || "", "codigo")}<h2>${esc(p.titulo)}</h2>${P.selo(P.R.sitProjeto[p.situacao], "sit-" + p.situacao)}</div>
        <div class="ficha-info">
          <div><span>Cliente</span>${cli ? `<a href="#" data-a="pessoa" data-id="${cli.id}">${esc(cli.nome)}</a>${cli.celular ? ` · ${esc(cli.celular)}` : ""}` : "—"}</div>
          <div><span>Imóveis</span>${imvs.map((i) => `<a href="#" data-a="imovel" data-id="${i.id}">${esc(i.denominacao)}</a> ${P.selo(i.tipo === "rural" ? "Rural" : "Urbano", i.tipo)}${pode ? ` <button type="button" class="x" data-a="tirarImovel" data-id="${i.id}" title="Tirar do processo">×</button>` : ""}`).join("<br>") || "—"}
            ${pode ? `<br><button type="button" class="link-botao" data-a="addImovel">+ imóvel</button>` : ""}</div>
          <div><span>Responsável</span>${esc(P.nomeUsuario(p.responsavel_id))}</div>
          <div><span>Contrato · previsão</span>${esc(P.dataBR(p.contrato_em) || "—")} · ${esc(P.dataBR(p.previsao) || "—")}</div>
          ${P.pode("ver_financeiro") ? `<div><span>Valor contratado</span>${esc(P.moeda(p.valor_contratado))}</div>` : ""}
          <div><span>Pasta</span>${p.pasta ? `<code>${esc(p.pasta)}</code>` : "—"}</div>
        </div>
        ${p.observacoes ? `<p class="ajuda">${esc(p.observacoes)}</p>` : ""}
        <div class="acoes">
          <button type="button" class="botao" data-a="pasta">📁 Pasta do processo</button>
          ${pode ? `<button type="button" class="botao" data-a="editar">Editar</button><button type="button" class="botao" data-a="novoServico">+ Serviço</button>` : ""}
          ${P.estado.perm.papel !== "consulta" ? `<button type="button" class="botao" data-a="anotar">Anotar no histórico</button>` : ""}
        </div>
      </div>
      <div class="abas">${ABAS.filter(([ k ]) => k !== "financeiro" || P.pode("ver_financeiro") || P.pode("lancar_custas")).map(([ k, t ]) => `<button type="button" data-aba="${k}" class="${k === aba ? "ativo" : ""}">${t}${contagem[k] ? ` <span class="contador">${contagem[k]}</span>` : ""}</button>`).join("")}</div>
      <div id="fichaAba"></div>`;
    const corpo = el.querySelector("#fichaAba");
    const abas = { servicos: abaServicos, pendencias: abaPendencias, protocolos: abaProtocolos, assinaturas: abaAssinaturas, documentos: abaDocumentos, financeiro: abaFinanceiro, historico: abaHistorico };
    (abas[aba] || abaServicos)(corpo, p, servs);

    el.onclick = async (e) => {
      const ab = e.target.closest("[data-aba]");
      if (ab) { P.gravarLocal("skl_proc_aba", ab.dataset.aba); P.estado.param = { projeto: p.id, aba: ab.dataset.aba }; renderFicha(el, p.id, ab.dataset.aba); return; }
      const b = e.target.closest("[data-a]"); if (!b) return;
      if (b.tagName === "A") e.preventDefault();
      const a = b.dataset.a; const idb = b.dataset.id;
      try {
        if (a === "voltar") P.ir("processos");
        else if (a === "pessoa") P.abrirPessoa(idb);
        else if (a === "imovel") P.abrirImovel(idb);
        else if (a === "pasta") P.abrirPasta(p.pasta);
        else if (a === "editar") editarProjeto(p);
        else if (a === "anotar") anotar(p);
        else if (a === "novoServico") formServico(p);
        else if (a === "addImovel") addImovel(p);
        else if (a === "tirarImovel") {
          const pi = (P.dados.projeto_imoveis || []).find((x) => x.projeto_id === p.id && x.imovel_id === idb);
          if (pi && confirm("Tirar este imóvel do processo? (o cadastro do imóvel continua)")) { await P.excluir("projeto_imoveis", pi.id, [ "projeto_imoveis" ]); P.redesenhar(); }
        } else await acaoAba(a, idb, p, b);
      } catch (err) { P.toast(P.msgErro(err)); }
    };
    el.onchange = (e) => mudancaAba(e, p);
  }

  async function anotar(p) {
    const r = await P.form({ titulo: "Anotar no histórico", subtitulo: p.codigo + " · " + p.titulo, campos: [
      { id: "texto", rotulo: "O que aconteceu", tipo: "textarea", obrig: true, linhas: 4, placeholder: "Ex.: Liguei no cartório, retorno dia 28." },
      { id: "servico_id", rotulo: "Serviço (opcional)", tipo: "select", opcoes: () => P.servicosDoProjeto(p.id).map((s) => [ s.id, s.titulo ]) },
    ], salvarTexto: "Anotar", aoSalvar: (v) => P.anotar(p.id, v.texto, v.servico_id) });
    if (r) { P.toast("Anotado."); if (P.estado.param?.aba === "historico") P.redesenhar(); }
  }
  async function addImovel(p) {
    await P.form({ titulo: "Adicionar imóvel ao processo", campos: [
      { id: "imovel_id", rotulo: "Imóvel", tipo: "select", obrig: true, opcoes: () => [ [ "__novo", "+ Cadastrar novo imóvel…" ], ...P.opImoveis() ] },
    ], aoSalvar: async (v) => {
      if (v.imovel_id === "__novo") { const i = await P.novoImovel(); if (!i) throw new Error("Cadastre o imóvel ou escolha outro."); v.imovel_id = i.id; }
      return P.salvar("projeto_imoveis", { projeto_id: p.id, imovel_id: v.imovel_id });
    } });
    P.redesenhar();
  }

  // ---------- serviços e etapas ----------
  async function formServico(p, s) {
    const novo = !s;
    const av = await P.avisosIniciais("servicos", s?.id, "vence");
    const campos = [
      ...(novo ? [ { id: "modelo_id", rotulo: "Modelo de etapas", tipo: "select", opcoes: opModelos, vazio: "Sem modelo (etapas à mão)" } ] : []),
      { id: "titulo", rotulo: "Nome do serviço", obrig: !novo, ajuda: novo ? "Em branco = nome do modelo" : "" },
      { id: "tipo", rotulo: "Tipo", tipo: "select", opcoes: P.opcoes(P.R.tipoServico), vazio: novo ? "Do modelo" : false },
      { id: "imovel_id", rotulo: "Imóvel", tipo: "select", opcoes: () => {
        let im = P.imoveisDoProjeto(p.id);
        if (!im.length) { const ids = new Set((P.dados.imovel_pessoas || []).filter((x) => x.pessoa_id === p.cliente_id).map((x) => x.imovel_id)); im = (P.dados.imoveis || []).filter((i) => ids.has(i.id)); }
        if (!im.length) im = P.dados.imoveis || [];
        return im.map((i) => [ i.id, i.denominacao ]);
      } },
      { id: "responsavel_id", rotulo: "Responsável", tipo: "select", opcoes: P.opEquipe },
      { id: "situacao", rotulo: "Situação", tipo: "select", opcoes: P.opcoes(P.R.sitServico), vazio: false },
      { id: "proxima_acao", rotulo: "Próxima ação", largura: "inteira" },
      { id: "previsao", rotulo: "Previsão", tipo: "date" },
      { id: "iniciado_em", rotulo: "Iniciado em", tipo: "date" },
      ...(!novo ? [ { id: "concluido_em", rotulo: "Concluído em", tipo: "date" } ] : []),
      { tipo: "titulo", rotulo: "Documento emitido (licença, outorga, recibo, certificação…)" },
      { id: "documento_emitido", rotulo: "Número / descrição", placeholder: "Ex.: LO nº 1122/2025" },
      { id: "vence_em", rotulo: "Vence em", tipo: "date", ajuda: "Aparece no Hoje 90 dias antes de vencer." },
      P.campoAvisos("vence", "Avisar no celular antes de vencer"),
      { id: "observacoes", rotulo: "Observações", tipo: "textarea" },
    ];
    const avisarVencimento = (r) => P.salvarAvisos({ tabela: "servicos", registroId: r.id, tipo: "vence", base: r.vence_em, valor: r._avisos,
      usuarioId: r.responsavel_id || p.responsavel_id, titulo: "Vencimento: " + (r.documento_emitido || r.titulo),
      corpo: `${p.codigo} · ${p.titulo} — vence em ${P.dataBR(r.vence_em)}` });
    const imPadrao = P.imoveisDoProjeto(p.id)[0]?.id;
    return P.form({
      titulo: novo ? "Novo serviço" : "Editar serviço", subtitulo: p.codigo + " · " + p.titulo, campos,
      valores: { ...(s || { situacao: "nao_iniciado", responsavel_id: p.responsavel_id || P.estado.usuario.id, imovel_id: imPadrao }), _avisos: av },
      aoSalvar: async (v) => {
        const { _avisos, ...d } = v;
        if (novo) {
          const { data, error } = await P.sb.rpc("proc_abrir_servico", { p_projeto: p.id, p_dados: d });
          if (error) throw new Error(P.msgErro(error));
          if (d.documento_emitido || d.vence_em || d.observacoes) await P.salvar("servicos", { id: data.id, documento_emitido: d.documento_emitido, vence_em: d.vence_em, observacoes: d.observacoes }, { recarregar: false });
          await P.carregar([ "servicos", "servico_etapas" ]);
          await avisarVencimento({ ...data, ...d, id: data.id, _avisos });
          return data;
        }
        if (d.situacao === "concluido" && !d.concluido_em) d.concluido_em = P.hojeISO();
        const r = await P.salvar("servicos", { ...d, id: s.id, version: s.version });
        await avisarVencimento({ ...r, _avisos });
        return r;
      },
      aoExcluir: !novo && P.estado.perm.papel === "administrador" ? () => P.excluir("servicos", s.id) : null, excluirTexto: "Excluir serviço",
    }).then(() => P.redesenhar());
  }

  function abaServicos(el, p, servs) {
    const pode = P.pode("editar_processos");
    if (!servs.length) { el.innerHTML = `<div class="cartao">${P.vazio("Nenhum serviço ainda.")}${pode ? `<p class="centro"><button type="button" class="botao-principal" data-a="novoServico">+ Adicionar serviço</button></p>` : ""}</div>`; return; }
    el.innerHTML = servs.map((s) => {
      const et = P.etapasDoServico(s.id); const pr = P.progresso(s.id); const area = P.areaDoServico(s);
      const im = P.porId("imoveis", s.imovel_id);
      return `<div class="cartao serv ${area}">
        <div class="serv-cab"><div><h3>${esc(s.titulo)}</h3>
          <div class="sub">${P.selo(area === "ambiental" ? "Ambiental" : "Agrimensura", area)}${P.selo(P.R.tipoServico[s.tipo] || s.tipo)}${P.selo(P.R.sitServico[s.situacao], "sit-" + s.situacao)}${im ? " · " + esc(im.denominacao) : ""} · ${esc(P.nomeUsuario(s.responsavel_id))}</div></div>
          ${pode ? `<button type="button" class="botao" data-a="editarServico" data-id="${s.id}">Editar</button>` : ""}</div>
        ${s.proxima_acao ? `<p class="prox">Próxima ação: <strong>${esc(s.proxima_acao)}</strong></p>` : ""}
        ${s.documento_emitido || s.vence_em ? `<p class="doc-emitido">📄 ${esc(s.documento_emitido || "Documento emitido")}${s.vence_em ? ` · vence em <strong class="${P.diasAte(s.vence_em) < 60 ? "txt-alerta" : ""}">${esc(P.dataBR(s.vence_em))}</strong>` : ""}</p>` : ""}
        ${pr ? `<div class="barra-prog" title="${pr.feitas} de ${pr.total} etapas"><span data-largura="${Math.round(100 * pr.feitas / pr.total)}"></span></div>` : ""}
        <ol class="etapas">${et.map((e) => `<li class="etapa et-${e.situacao}">
          <div class="etapa-cab"><span class="etapa-nome">${e.ordem}. ${esc(e.nome)}</span>
            ${e.prazo && e.situacao !== "concluida" ? `<span class="${P.quando(e.prazo).atrasado ? "txt-alerta" : "sub"}">prazo ${esc(P.dataBR(e.prazo))}</span>` : ""}
            ${e.concluida_em ? `<span class="sub">concluída ${esc(P.dataBR(e.concluida_em))}</span>` : ""}
            ${pode ? `<select data-etapa-sit="${e.id}">${P.opcoes(P.R.sitEtapa).map(([ v, l ]) => `<option value="${v}" ${v === e.situacao ? "selected" : ""}>${l}</option>`).join("")}</select>
            <button type="button" class="link-botao" data-a="editarEtapa" data-id="${e.id}">editar</button>` : `<span class="sub">${esc(P.R.sitEtapa[e.situacao])}</span>`}</div>
          ${(e.checklist || []).length ? `<ul class="checklist">${e.checklist.map((c, i) => `<li><label class="check"><input type="checkbox" data-check="${e.id}" data-i="${i}" ${c.feito ? "checked" : ""} ${pode ? "" : "disabled"}> ${esc(c.texto)}</label></li>`).join("")}</ul>` : ""}
        </li>`).join("")}</ol>
        ${pode ? `<button type="button" class="link-botao" data-a="novaEtapa" data-id="${s.id}">+ Etapa</button>` : ""}
      </div>`;
    }).join("") + (pode ? `<p><button type="button" class="botao" data-a="novoServico">+ Outro serviço neste processo</button></p>` : "");
  }

  async function salvarEtapa(e, mud) {
    await P.salvar("servico_etapas", { id: e.id, version: e.version, ...mud });
    const s = P.porId("servicos", e.servico_id);
    if (mud.situacao && s) {
      if (s.situacao === "nao_iniciado" && [ "andamento", "concluida" ].includes(mud.situacao)) {
        await P.salvar("servicos", { id: s.id, version: s.version, situacao: "em_andamento", iniciado_em: s.iniciado_em || P.hojeISO() });
      }
      const et = P.etapasDoServico(s.id);
      const s2 = P.porId("servicos", s.id);
      if (et.length && et.every((x) => [ "concluida", "nao_aplica" ].includes(x.situacao)) && s2.situacao !== "concluido"
        && confirm(`Todas as etapas de "${s.titulo}" estão concluídas. Marcar o serviço como concluído?`)) {
        await P.salvar("servicos", { id: s2.id, version: s2.version, situacao: "concluido", concluido_em: P.hojeISO() });
      }
    }
  }
  async function formEtapa(servicoId, e) {
    const servEt = P.etapasDoServico(servicoId);
    const av = await P.avisosIniciais("servico_etapas", e?.id, "dia");
    const sv = P.porId("servicos", servicoId); const pj = P.porId("projetos", sv?.projeto_id);
    return P.form({
      titulo: e ? "Editar etapa" : "Nova etapa", campos: [
        { id: "nome", rotulo: "Nome da etapa", obrig: true },
        { id: "ordem", rotulo: "Ordem", tipo: "number", passo: "1" },
        { id: "situacao", rotulo: "Situação", tipo: "select", opcoes: P.opcoes(P.R.sitEtapa), vazio: false },
        { id: "prazo", rotulo: "Prazo", tipo: "date" },
        { id: "lista", rotulo: "Checklist (um item por linha)", tipo: "textarea", linhas: 5 },
        P.campoAvisos("dia", "Avisar no celular (pelo prazo da etapa)"),
      ],
      valores: { ...(e ? { ...e, lista: (e.checklist || []).map((c) => c.texto).join("\n") } : { ordem: (servEt.at(-1)?.ordem || 0) + 1, situacao: "pendente" }), _avisos: av },
      aoSalvar: async (v) => {
        const _avisos = v._avisos;
        const antigos = new Map((e?.checklist || []).map((c) => [ c.texto, c ]));
        const checklist = String(v.lista || "").split("\n").map((t) => t.trim()).filter(Boolean).map((t) => antigos.get(t) || { texto: t, feito: false });
        const dados = { nome: v.nome, ordem: v.ordem || 1, situacao: v.situacao, prazo: v.prazo, checklist,
          concluida_em: v.situacao === "concluida" ? (e?.concluida_em || P.hojeISO()) : null };
        let id = e?.id;
        if (e) await salvarEtapa(e, dados);
        else id = (await P.salvar("servico_etapas", { servico_id: servicoId, ...dados })).id;
        if (![ "concluida", "nao_aplica" ].includes(dados.situacao)) await P.salvarAvisos({ tabela: "servico_etapas", registroId: id, tipo: "dia", base: dados.prazo,
          valor: _avisos, usuarioId: sv?.responsavel_id || pj?.responsavel_id, titulo: "Etapa: " + dados.nome, corpo: `${pj?.codigo || ""} · ${sv?.titulo || ""} — prazo ${P.dataBR(dados.prazo)}` });
        return { id };
      },
      aoExcluir: e ? () => P.excluir("servico_etapas", e.id, [ "servico_etapas" ]) : null, excluirTexto: "Excluir etapa",
    }).then(() => P.redesenhar());
  }

  // ---------- pendências ----------
  async function formPendencia(p, x) {
    const av = await P.avisosIniciais("pendencias", x?.id, "dia");
    return P.form({
      titulo: x ? "Editar pendência" : "Nova pendência", subtitulo: "Quem precisa agir, quem acompanha e quando conferir de novo.", campos: [
        { id: "descricao", rotulo: "O que precisa acontecer", obrig: true, largura: "inteira" },
        { id: "servico_id", rotulo: "Serviço", tipo: "select", opcoes: () => P.servicosDoProjeto(p.id).map((s) => [ s.id, s.titulo ]) },
        { id: "quem_age", rotulo: "Quem precisa agir", tipo: "select", opcoes: P.opcoes(P.R.quemAge), vazio: false },
        { id: "quem_age_pessoa_id", rotulo: "Pessoa (se for alguém cadastrado)", tipo: "select", opcoes: () => [ [ "__nova", "+ Cadastrar nova pessoa…" ], ...P.opPessoas() ] },
        { id: "quem_age_texto", rotulo: "Ou escreva quem (órgão, cartório…)" },
        { id: "acompanha_id", rotulo: "Quem acompanha no escritório", tipo: "select", opcoes: P.opEquipe, obrig: true },
        { id: "conferir_em", rotulo: "Conferir de novo em", tipo: "date", obrig: true },
        { id: "prazo", rotulo: "Prazo final (se houver)", tipo: "date" },
        ...(x ? [ { id: "situacao", rotulo: "Situação", tipo: "select", opcoes: [ [ "aberta", "Aberta" ], [ "resolvida", "Resolvida" ], [ "cancelada", "Cancelada" ] ], vazio: false } ] : []),
        P.campoAvisos("dia", "Avisar no celular (pela data de conferir)"),
      ],
      valores: { ...(x || { quem_age: "escritorio", acompanha_id: P.estado.usuario.id, conferir_em: P.somarDias(P.hojeISO(), 3) }), _avisos: av },
      aoSalvar: async (v) => {
        const { _avisos, ...d } = v;
        if (d.quem_age_pessoa_id === "__nova") { const pe = await P.novaPessoa(); d.quem_age_pessoa_id = pe?.id || null; }
        if (d.situacao === "resolvida" && !x?.resolvida_em) d.resolvida_em = P.hojeISO();
        const r = await P.salvar("pendencias", { ...d, projeto_id: p.id, id: x?.id, version: x?.version });
        if (r.situacao === "aberta") await P.salvarAvisos({ tabela: "pendencias", registroId: r.id, tipo: "dia", base: r.conferir_em, valor: _avisos,
          usuarioId: r.acompanha_id, titulo: "Pendência: " + r.descricao, corpo: `${p.codigo} · ${p.titulo} — quem age: ${P.quemAgeTexto(r)}` });
        return r;
      },
      aoExcluir: x ? () => P.excluir("pendencias", x.id, [ "pendencias" ]) : null,
    }).then(() => P.redesenhar());
  }
  function abaPendencias(el, p) {
    const pode = P.pode("editar_processos");
    const todas = (P.dados.pendencias || []).filter((x) => x.projeto_id === p.id);
    const abertas = todas.filter((x) => x.situacao === "aberta").sort((a, b) => (a.conferir_em || "0").localeCompare(b.conferir_em || "0"));
    const fechadas = todas.filter((x) => x.situacao !== "aberta").sort((a, b) => (b.resolvida_em || "").localeCompare(a.resolvida_em || ""));
    const item = (x) => {
      const q = P.quando(x.conferir_em || x.prazo); const sv = P.porId("servicos", x.servico_id);
      return `<li class="${x.situacao !== "aberta" ? "feito" : ""}"><div><div class="titulo">${esc(x.descricao)}</div>
        <div class="sub">${sv ? esc(sv.titulo) + " · " : ""}Quem age: <strong>${esc(P.quemAgeTexto(x))}</strong> · Acompanha: ${esc(P.nomeUsuario(x.acompanha_id))}</div></div>
        <div class="quando ${x.situacao === "aberta" && q.atrasado ? "atrasado" : ""}">${x.situacao === "aberta" ? `conferir ${esc(q.txt)}${x.prazo ? `<br><small>prazo ${esc(P.dataBR(x.prazo))}</small>` : ""}` : `${esc(x.situacao === "resolvida" ? "resolvida" : "cancelada")} ${esc(P.dataBR(x.resolvida_em))}`}
        ${pode ? `<div class="mini-acoes">${x.situacao === "aberta" ? `<button type="button" class="botao pequeno" data-a="resolverPend" data-id="${x.id}">✓ Resolver</button><button type="button" class="botao pequeno" data-a="adiarPend" data-id="${x.id}">Adiar</button>` : ""}<button type="button" class="link-botao" data-a="editarPend" data-id="${x.id}">editar</button></div>` : ""}</div></li>`;
    };
    el.innerHTML = `<div class="cartao"><div class="cartao-cab"><h3>Abertas (${abertas.length})</h3>${pode ? `<button type="button" class="botao-principal" data-a="novaPend">+ Pendência</button>` : ""}</div>
      ${abertas.length ? `<ul class="lista-itens">${abertas.map(item).join("")}</ul>` : P.vazio("Nenhuma pendência aberta.")}</div>
      ${fechadas.length ? `<details class="cartao"><summary>Resolvidas e canceladas (${fechadas.length})</summary><ul class="lista-itens">${fechadas.map(item).join("")}</ul></details>` : ""}`;
  }

  // ---------- protocolos e exigências ----------
  function formProtocolo(p, x) {
    return P.form({
      titulo: x ? "Editar protocolo" : "Novo protocolo", campos: [
        { id: "servico_id", rotulo: "Serviço", tipo: "select", obrig: true, opcoes: () => P.servicosDoProjeto(p.id).map((s) => [ s.id, s.titulo ]) },
        { id: "orgao", rotulo: "Órgão", tipo: "select", opcoes: P.opcoes(P.R.orgao), vazio: false },
        { id: "orgao_nome", rotulo: "Nome do órgão / cartório", placeholder: "Ex.: 1º Ofício de Rondonópolis, SEMA-MT" },
        { id: "numero", rotulo: "Número do protocolo / prenotação" },
        { id: "protocolado_em", rotulo: "Protocolado em", tipo: "date" },
        { id: "validade", rotulo: "Validade (prenotação, se houver)", tipo: "date" },
        { id: "situacao", rotulo: "Situação", tipo: "select", opcoes: P.opcoes(P.R.sitProtocolo), vazio: false },
        { id: "observacoes", rotulo: "Observações", tipo: "textarea" },
      ],
      valores: x || { orgao: "cartorio", situacao: "em_analise", protocolado_em: P.hojeISO(), servico_id: P.servicosDoProjeto(p.id)[0]?.id },
      aoSalvar: (v) => P.salvar("protocolos", { ...v, id: x?.id, version: x?.version }),
      aoExcluir: x ? () => P.excluir("protocolos", x.id, [ "protocolos", "exigencias", "documentos" ]) : null,
    }).then(() => P.redesenhar());
  }
  async function formExigencia(prot, x) {
    const av = await P.avisosIniciais("exigencias", x?.id, "dia");
    const sv = P.porId("servicos", prot.servico_id); const pj = P.porId("projetos", sv?.projeto_id);
    return P.form({
      titulo: x ? "Editar exigência" : "Nova exigência", subtitulo: `Protocolo ${prot.numero || "—"} · ${prot.orgao_nome || P.R.orgao[prot.orgao]}`, campos: [
        { id: "descricao", rotulo: "O que o órgão pediu", tipo: "textarea", obrig: true },
        { id: "recebida_em", rotulo: "Recebida em", tipo: "date" },
        { id: "prazo", rotulo: "Prazo para cumprir", tipo: "date" },
        { id: "situacao", rotulo: "Situação", tipo: "select", opcoes: P.opcoes(P.R.sitExigencia), vazio: false },
        { id: "cumprida_em", rotulo: "Cumprida em", tipo: "date" },
        P.campoAvisos("dia", "Avisar no celular (pelo prazo)"),
      ],
      valores: { ...(x || { recebida_em: P.hojeISO(), situacao: "aberta" }), _avisos: { ...av, chaves: x ? av.chaves : (av.chaves.length ? [ "3d", "1d", "dia" ] : []) } },
      aoSalvar: async (v) => {
        const { _avisos, ...d } = v;
        if (d.situacao === "cumprida" && !d.cumprida_em) d.cumprida_em = P.hojeISO();
        const r = await P.salvar("exigencias", { ...d, protocolo_id: prot.id, id: x?.id, version: x?.version });
        if (!x && d.situacao === "aberta" && prot.situacao === "em_analise") await P.salvar("protocolos", { id: prot.id, version: prot.version, situacao: "exigencia" });
        if (r.situacao === "aberta") await P.salvarAvisos({ tabela: "exigencias", registroId: r.id, tipo: "dia", base: r.prazo, valor: _avisos,
          usuarioId: sv?.responsavel_id || pj?.responsavel_id, titulo: "Exigência: " + r.descricao,
          corpo: `${pj?.codigo || ""} · ${prot.orgao_nome || P.R.orgao[prot.orgao]} nº ${prot.numero || "—"} — prazo ${P.dataBR(r.prazo)}` });
        return r;
      },
      aoExcluir: x ? () => P.excluir("exigencias", x.id, [ "exigencias" ]) : null,
    }).then(() => P.redesenhar());
  }
  function abaProtocolos(el, p, servs) {
    const pode = P.pode("editar_processos");
    const sids = new Set(servs.map((s) => s.id));
    const prots = (P.dados.protocolos || []).filter((x) => sids.has(x.servico_id)).sort((a, b) => (b.protocolado_em || "").localeCompare(a.protocolado_em || ""));
    el.innerHTML = `<div class="cartao"><div class="cartao-cab"><h3>Protocolos (${prots.length})</h3>${pode && servs.length ? `<button type="button" class="botao-principal" data-a="novoProt">+ Protocolo</button>` : ""}</div>
      ${prots.length ? prots.map((pr) => {
        const ex = (P.dados.exigencias || []).filter((x) => x.protocolo_id === pr.id).sort((a, b) => (b.recebida_em || "").localeCompare(a.recebida_em || ""));
        const sv = P.porId("servicos", pr.servico_id);
        return `<div class="protocolo">
          <div class="cartao-cab"><div><strong>${esc(pr.orgao_nome || P.R.orgao[pr.orgao])}</strong> · nº ${esc(pr.numero || "—")} ${P.selo(P.R.sitProtocolo[pr.situacao], "prot-" + pr.situacao)}
            <div class="sub">${esc(sv?.titulo || "")} · protocolado ${esc(P.dataBR(pr.protocolado_em) || "—")}${pr.validade ? ` · validade <span class="${P.quando(pr.validade).atrasado ? "txt-alerta" : ""}">${esc(P.dataBR(pr.validade))}</span>` : ""}</div>
            ${pr.observacoes ? `<div class="sub">${esc(pr.observacoes)}</div>` : ""}</div>
            ${pode ? `<div class="mini-acoes"><button type="button" class="botao pequeno" data-a="novaExig" data-id="${pr.id}">+ Exigência</button><button type="button" class="link-botao" data-a="editarProt" data-id="${pr.id}">editar</button></div>` : ""}</div>
          ${ex.length ? `<ul class="lista-itens exig">${ex.map((x) => `<li class="${x.situacao !== "aberta" ? "feito" : ""}"><div><div class="titulo">${esc(x.descricao)}</div>
            <div class="sub">recebida ${esc(P.dataBR(x.recebida_em) || "—")} · ${esc(P.R.sitExigencia[x.situacao])}${x.cumprida_em ? " " + esc(P.dataBR(x.cumprida_em)) : ""}</div></div>
            <div class="quando ${x.situacao === "aberta" && P.quando(x.prazo).atrasado ? "atrasado" : ""}">${x.prazo ? "prazo " + esc(P.dataBR(x.prazo)) : ""}
            ${pode ? `<div class="mini-acoes">${x.situacao === "aberta" ? `<button type="button" class="botao pequeno" data-a="cumprirExig" data-id="${x.id}">✓ Cumprida</button>` : ""}<button type="button" class="link-botao" data-a="editarExig" data-id="${x.id}">editar</button></div>` : ""}</div></li>`).join("")}</ul>` : ""}
        </div>`;
      }).join("") : P.vazio(servs.length ? "Nenhum protocolo ainda." : "Crie um serviço primeiro.")}</div>`;
  }

  // ---------- confrontantes e assinaturas ----------
  function formParte(p, x) {
    return P.form({
      titulo: x ? "Editar" : "Novo confrontante / assinatura", campos: [
        { id: "servico_id", rotulo: "Serviço", tipo: "select", obrig: true, opcoes: () => P.servicosDoProjeto(p.id).map((s) => [ s.id, s.titulo ]) },
        { id: "pessoa_id", rotulo: "Pessoa", tipo: "select", obrig: true, opcoes: () => [ [ "__nova", "+ Cadastrar nova pessoa…" ], ...P.opPessoas() ] },
        { id: "papel", rotulo: "Papel", tipo: "select", opcoes: P.opcoes(P.R.papelParte), vazio: false },
        { id: "lado", rotulo: "Lado / divisa", placeholder: "Ex.: Norte, Fundos (Lote 21)" },
        { id: "matricula_vizinha", rotulo: "Matrícula do vizinho" },
        { id: "anuencia", rotulo: "Assinatura", tipo: "select", opcoes: P.opcoes(P.R.anuencia), vazio: false },
        { id: "assinou_em", rotulo: "Assinou em", tipo: "date" },
        { id: "documento_id", rotulo: "Em qual documento", tipo: "select", opcoes: () => (P.dados.documentos || []).filter((d) => P.servicosDoProjeto(p.id).some((s) => s.id === d.servico_id)).map((d) => [ d.id, `${d.nome} v${d.versao}` ]) },
        { id: "observacoes", rotulo: "Observações", tipo: "textarea" },
      ],
      valores: x || { papel: "confrontante", anuencia: "pendente", servico_id: P.servicosDoProjeto(p.id)[0]?.id },
      aoSalvar: async (v) => {
        if (v.pessoa_id === "__nova") { const pe = await P.novaPessoa(); if (!pe) throw new Error("Cadastre a pessoa ou escolha outra."); v.pessoa_id = pe.id; }
        if (v.anuencia === "assinou" && !v.assinou_em) v.assinou_em = P.hojeISO();
        return P.salvar("partes", { ...v, id: x?.id, version: x?.version });
      },
      aoExcluir: x ? () => P.excluir("partes", x.id, [ "partes" ]) : null,
    }).then(() => P.redesenhar());
  }
  function abaAssinaturas(el, p, servs) {
    const pode = P.pode("editar_processos");
    const sids = new Set(servs.map((s) => s.id));
    const partes = (P.dados.partes || []).filter((x) => sids.has(x.servico_id));
    const assinou = partes.filter((x) => x.anuencia === "assinou" || x.anuencia === "nao_precisa").length;
    el.innerHTML = `<div class="cartao"><div class="cartao-cab"><h3>Confrontantes e assinaturas · ${assinou} de ${partes.length} ok</h3>${pode && servs.length ? `<button type="button" class="botao-principal" data-a="novaParte">+ Adicionar</button>` : ""}</div>
      ${partes.length ? `<div class="tabela-rol"><table class="tabela"><thead><tr><th>Pessoa</th><th>Papel</th><th>Lado</th><th>Matr. vizinha</th><th>Assinatura</th><th>Documento</th><th></th></tr></thead><tbody>
      ${partes.map((x) => { const pe = P.porId("pessoas", x.pessoa_id); const d = P.porId("documentos", x.documento_id);
        return `<tr class="an-${x.anuencia}"><td><a href="#" data-a="pessoa" data-id="${x.pessoa_id}">${esc(pe?.nome || "—")}</a>${pe?.celular ? `<br><small>${esc(pe.celular)}</small>` : ""}${x.observacoes ? `<br><small class="sub">${esc(x.observacoes)}</small>` : ""}</td>
        <td>${esc(P.R.papelParte[x.papel])}</td><td>${esc(x.lado || "")}</td><td>${esc(x.matricula_vizinha || "")}</td>
        <td>${pode ? `<select data-anuencia="${x.id}">${P.opcoes(P.R.anuencia).map(([ v, l ]) => `<option value="${v}" ${v === x.anuencia ? "selected" : ""}>${l}</option>`).join("")}</select>` : esc(P.R.anuencia[x.anuencia])}${x.assinou_em ? `<br><small>${esc(P.dataBR(x.assinou_em))}</small>` : ""}</td>
        <td>${d ? esc(`${d.nome} v${d.versao}`) : ""}</td><td>${pode ? `<button type="button" class="link-botao" data-a="editarParte" data-id="${x.id}">editar</button>` : ""}</td></tr>`; }).join("")}
      </tbody></table></div>` : P.vazio(servs.length ? "Ninguém cadastrado ainda." : "Crie um serviço primeiro.")}</div>`;
  }

  // ---------- documentos ----------
  function formDocumento(p, x, base) {
    const travado = x && [ "protocolado", "entregue" ].includes(x.situacao);
    const campos = travado ? [
      { id: "situacao", rotulo: "Situação", tipo: "select", opcoes: [ [ "protocolado", "Protocolado" ], [ "entregue", "Entregue" ] ], vazio: false },
      { id: "caminho", rotulo: "Onde está na pasta do processo" },
      { id: "observacoes", rotulo: "Observações", tipo: "textarea" },
    ] : [
      { id: "servico_id", rotulo: "Serviço", tipo: "select", obrig: true, opcoes: () => P.servicosDoProjeto(p.id).map((s) => [ s.id, s.titulo ]) },
      { id: "tipo", rotulo: "Tipo", tipo: "select", opcoes: P.opcoes(P.R.docTipo), vazio: false },
      { id: "nome", rotulo: "Nome", obrig: true },
      { id: "versao", rotulo: "Versão", tipo: "number", passo: "1" },
      { id: "situacao", rotulo: "Situação", tipo: "select", opcoes: P.opcoes(P.R.docSit), vazio: false },
      { id: "protocolo_id", rotulo: "Protocolo em que entrou", tipo: "select", opcoes: () => (P.dados.protocolos || []).filter((pr) => P.servicosDoProjeto(p.id).some((s) => s.id === pr.servico_id)).map((pr) => [ pr.id, `${pr.orgao_nome || P.R.orgao[pr.orgao]} nº ${pr.numero || "—"}` ]) },
      { id: "caminho", rotulo: "Onde está na pasta do processo", placeholder: "Ex.: 03 Pecas tecnicas\\Memorial_v3.docx", largura: "inteira", ajuda: "O arquivo continua no seu computador; aqui fica só onde ele está." },
      { id: "observacoes", rotulo: "Observações", tipo: "textarea" },
    ];
    return P.form({
      titulo: x ? (travado ? `${x.nome} v${x.versao} (travado)` : "Editar documento") : (base ? `Nova versão de ${base.nome}` : "Novo documento"),
      subtitulo: travado ? "Versão protocolada/entregue não muda. Para alterar o conteúdo, crie uma nova versão." : "",
      campos,
      valores: x || (base ? { servico_id: base.servico_id, tipo: base.tipo, nome: base.nome, versao: base.versao + 1, situacao: "elaboracao", caminho: base.caminho } : { tipo: "planta", versao: 1, situacao: "elaboracao", servico_id: P.servicosDoProjeto(p.id)[0]?.id }),
      aoSalvar: (v) => P.salvar("documentos", { ...v, id: x?.id, version: x?.version }),
      aoExcluir: x && !travado ? () => P.excluir("documentos", x.id, [ "documentos", "partes" ]) : null,
    }).then(() => P.redesenhar());
  }
  function abaDocumentos(el, p, servs) {
    const pode = P.pode("editar_processos");
    const blocos = servs.map((s) => {
      const docs = (P.dados.documentos || []).filter((d) => d.servico_id === s.id).sort((a, b) => a.nome.localeCompare(b.nome) || b.versao - a.versao);
      if (!docs.length) return "";
      return `<h4>${esc(s.titulo)}</h4><div class="tabela-rol"><table class="tabela"><thead><tr><th>Documento</th><th>Tipo</th><th>Versão</th><th>Situação</th><th>Protocolo</th><th></th></tr></thead><tbody>
        ${docs.map((d) => { const pr = P.porId("protocolos", d.protocolo_id); const trav = [ "protocolado", "entregue" ].includes(d.situacao);
          return `<tr><td>${esc(d.nome)}${d.caminho ? `<br><small><a href="#" data-a="abrirDoc" data-id="${d.id}">📁 ${esc(d.caminho)}</a></small>` : ""}</td><td>${esc(P.R.docTipo[d.tipo])}</td><td>v${d.versao}</td>
          <td>${P.selo(P.R.docSit[d.situacao], "doc-" + d.situacao)}${trav ? " 🔒" : ""}</td><td>${pr ? esc(`nº ${pr.numero || "—"}`) : ""}</td>
          <td>${pode ? `<button type="button" class="link-botao" data-a="editarDoc" data-id="${d.id}">${trav ? "ver" : "editar"}</button> <button type="button" class="link-botao" data-a="versaoDoc" data-id="${d.id}">nova versão</button>` : ""}</td></tr>`; }).join("")}
        </tbody></table></div>`;
    }).join("");
    el.innerHTML = `<div class="cartao"><div class="cartao-cab"><h3>Documentos e versões</h3>${pode && servs.length ? `<button type="button" class="botao-principal" data-a="novoDoc">+ Documento</button>` : ""}</div>
      <p class="ajuda">O SKL Processos não guarda arquivos: registra a versão, a situação e onde o arquivo está na pasta do processo.</p>
      ${blocos || P.vazio("Nenhum documento registrado.")}</div>`;
  }

  // ---------- financeiro do processo ----------
  P.formRecebivel = async (projetoId, x) => { const av = await P.avisosIniciais("recebiveis", x?.id, "dia"); return P.form({
    titulo: x ? "Editar parcela" : "Nova parcela a receber", campos: [
      ...(projetoId ? [] : [ { id: "projeto_id", rotulo: "Processo", tipo: "select", obrig: true, opcoes: () => (P.dados.projetos || []).map((p) => [ p.id, `${p.codigo} · ${p.titulo}` ]) } ]),
      { id: "descricao", rotulo: "Descrição (marco)", obrig: true, placeholder: "Ex.: Entrada, Entrega da planta, Certificação" },
      { id: "valor", rotulo: "Valor (R$)", tipo: "number", passo: "0.01", obrig: true },
      { id: "vencimento", rotulo: "Vencimento", tipo: "date" },
      { id: "programado_para", rotulo: "Cliente prometeu pagar em", tipo: "date" },
      { id: "situacao", rotulo: "Situação", tipo: "select", opcoes: [ [ "aberto", "A receber" ], [ "recebido", "Recebido" ], [ "cancelado", "Cancelado" ] ], vazio: false },
      { id: "recebido_em", rotulo: "Recebido em", tipo: "date" },
      { id: "valor_recebido", rotulo: "Valor recebido (R$)", tipo: "number", passo: "0.01" },
      { id: "forma", rotulo: "Forma", placeholder: "PIX, transferência, dinheiro…" },
      { id: "conta_id", rotulo: "Conta", tipo: "select", opcoes: () => (P.dados.contas || []).filter((c) => c.ativo).map((c) => [ c.id, c.nome ]) },
      { id: "nota_id", rotulo: "Nota fiscal", tipo: "select", opcoes: () => (P.dados.notas || []).filter((n) => !projetoId || n.projeto_id === projetoId).map((n) => [ n.id, `NF ${n.numero} — ${P.moeda(n.valor)}` ]) },
      { id: "observacoes", rotulo: "Observações", tipo: "textarea" },
      P.campoAvisos("dia", "Avisar no celular (pelo vencimento)"),
    ],
    valores: { ...(x || { situacao: "aberto" }), _avisos: av },
    aoSalvar: async (v) => {
      const { _avisos, ...d } = v;
      if (d.situacao === "recebido") { d.recebido_em = d.recebido_em || P.hojeISO(); if (d.valor_recebido == null) d.valor_recebido = d.valor; }
      const r = await P.salvar("recebiveis", { ...d, projeto_id: d.projeto_id || projetoId, id: x?.id, version: x?.version });
      const pj = P.porId("projetos", r.projeto_id);
      if (r.situacao === "aberto") await P.salvarAvisos({ tabela: "recebiveis", registroId: r.id, tipo: "dia", base: r.vencimento, valor: _avisos,
        usuarioId: P.estado.usuario.id, titulo: `A receber: ${r.descricao} — ${P.moeda(r.valor)}`, corpo: `${pj?.codigo || ""} · ${pj?.titulo || ""} — vence ${P.dataBR(r.vencimento)}` });
      return r;
    },
    aoExcluir: x ? () => P.excluir("recebiveis", x.id, [ "recebiveis" ]) : null,
  }).then(() => P.redesenhar()); };
  P.formBaixa = (x) => P.form({
    titulo: "Registrar recebimento", subtitulo: `${x.descricao} · ${P.moeda(x.valor)}`, campos: [
      { id: "recebido_em", rotulo: "Recebido em", tipo: "date", obrig: true },
      { id: "valor_recebido", rotulo: "Valor recebido (R$)", tipo: "number", passo: "0.01", obrig: true },
      { id: "forma", rotulo: "Forma", placeholder: "PIX, transferência…" },
      { id: "conta_id", rotulo: "Conta", tipo: "select", opcoes: () => (P.dados.contas || []).filter((c) => c.ativo).map((c) => [ c.id, c.nome ]) },
    ],
    valores: { recebido_em: P.hojeISO(), valor_recebido: x.valor, forma: "PIX" }, salvarTexto: "Recebido",
    aoSalvar: (v) => P.salvar("recebiveis", { ...v, id: x.id, version: x.version, situacao: "recebido" }),
  }).then(() => P.redesenhar());
  P.formCusta = (projetoId, x) => P.form({
    titulo: x ? "Editar custa" : "Nova custa / despesa do processo", campos: [
      ...(projetoId ? [ { id: "servico_id", rotulo: "Serviço", tipo: "select", opcoes: () => P.servicosDoProjeto(projetoId).map((s) => [ s.id, s.titulo ]) } ]
        : [ { id: "projeto_id", rotulo: "Processo", tipo: "select", obrig: true, opcoes: () => (P.dados.projetos || []).map((p) => [ p.id, `${p.codigo} · ${p.titulo}` ]) } ]),
      { id: "descricao", rotulo: "Descrição", obrig: true, placeholder: "Ex.: Prenotação, ART, taxa do órgão, combustível" },
      { id: "tipo", rotulo: "Tipo", tipo: "select", opcoes: P.opcoes(P.R.tipoCusta), vazio: false },
      { id: "valor", rotulo: "Valor (R$)", tipo: "number", passo: "0.01", obrig: true },
      { id: "pago_por", rotulo: "Quem pagou", tipo: "select", opcoes: [ [ "escritorio", "Escritório (adiantou)" ], [ "cliente", "Cliente (pagou direto)" ] ], vazio: false },
      { id: "pago_em", rotulo: "Pago em", tipo: "date" },
      { id: "reembolsavel", rotulo: "Reembolso", tipo: "checkbox", texto: "Cobrar de volta do cliente" },
      { id: "reembolsado_em", rotulo: "Reembolsado em", tipo: "date" },
      { id: "observacoes", rotulo: "Observações", tipo: "textarea" },
    ],
    valores: x || { tipo: "cartorio", pago_por: "escritorio", pago_em: P.hojeISO(), reembolsavel: true },
    aoSalvar: (v) => P.salvar("custas", { ...v, projeto_id: v.projeto_id || projetoId || x?.projeto_id, id: x?.id, version: x?.version }),
    aoExcluir: x ? () => P.excluir("custas", x.id, [ "custas" ]) : null,
  }).then(() => P.redesenhar());
  P.formNota = (projetoId, x) => P.form({
    titulo: x ? "Editar nota fiscal" : "Registrar nota fiscal emitida", subtitulo: "Só o registro: a nota é emitida no sistema da prefeitura/contador.", campos: [
      { id: "projeto_id", rotulo: "Processo", tipo: "select", opcoes: () => (P.dados.projetos || []).map((p) => [ p.id, `${p.codigo} · ${p.titulo}` ]) },
      { id: "cliente_id", rotulo: "Tomador (cliente)", tipo: "select", opcoes: P.opPessoas },
      { id: "numero", rotulo: "Número", obrig: true }, { id: "serie", rotulo: "Série" },
      { id: "emitida_em", rotulo: "Emitida em", tipo: "date", obrig: true },
      { id: "valor", rotulo: "Valor (R$)", tipo: "number", passo: "0.01", obrig: true },
      { id: "situacao", rotulo: "Situação", tipo: "select", opcoes: [ [ "emitida", "Emitida" ], [ "cancelada", "Cancelada" ] ], vazio: false },
      { id: "caminho", rotulo: "Onde está o arquivo (PDF/XML)", largura: "inteira" },
      { id: "observacoes", rotulo: "Observações", tipo: "textarea" },
    ],
    valores: x || { projeto_id: projetoId, cliente_id: P.porId("projetos", projetoId)?.cliente_id, emitida_em: P.hojeISO(), situacao: "emitida" },
    aoSalvar: (v) => P.salvar("notas", { ...v, id: x?.id, version: x?.version }),
    aoExcluir: x ? () => P.excluir("notas", x.id, [ "notas", "recebiveis" ]) : null,
  }).then(() => P.redesenhar());

  function abaFinanceiro(el, p) {
    const verFin = P.pode("ver_financeiro"); const gerir = P.pode("gerir_financeiro"); const custasOk = P.pode("lancar_custas");
    const rec = (P.dados.recebiveis || []).filter((r) => r.projeto_id === p.id).sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""));
    const cus = (P.dados.custas || []).filter((c) => c.projeto_id === p.id).sort((a, b) => (b.pago_em || "").localeCompare(a.pago_em || ""));
    const nts = (P.dados.notas || []).filter((n) => n.projeto_id === p.id);
    const soma = (arr, f) => arr.reduce((s, x) => s + Number(f(x) || 0), 0);
    const recebido = soma(rec.filter((r) => r.situacao === "recebido"), (r) => r.valor_recebido ?? r.valor);
    const aberto = soma(rec.filter((r) => r.situacao === "aberto"), (r) => r.valor);
    const aReemb = soma(cus.filter((c) => c.pago_por === "escritorio" && c.reembolsavel && !c.reembolsado_em), (c) => c.valor);
    el.innerHTML = `
      ${verFin ? `<div class="numeros">
        <div class="numero"><span>Contratado</span><strong>${esc(P.moeda(p.valor_contratado))}</strong></div>
        <div class="numero"><span>Recebido</span><strong>${esc(P.moeda(recebido))}</strong></div>
        <div class="numero"><span>A receber</span><strong>${esc(P.moeda(aberto))}</strong></div>
        <div class="numero ${aReemb ? "alerta" : ""}"><span>Custas a cobrar do cliente</span><strong>${esc(P.moeda(aReemb))}</strong></div></div>
      <div class="cartao"><div class="cartao-cab"><h3>Parcelas a receber</h3>${gerir ? `<button type="button" class="botao-principal" data-a="novaParcela">+ Parcela</button>` : ""}</div>
        ${rec.length ? `<div class="tabela-rol"><table class="tabela"><thead><tr><th>Descrição</th><th>Vencimento</th><th>Valor</th><th>Situação</th><th></th></tr></thead><tbody>
        ${rec.map((r) => `<tr><td>${esc(r.descricao)}${r.programado_para && r.situacao === "aberto" ? `<br><small>prometido para ${esc(P.dataBR(r.programado_para))}</small>` : ""}</td>
          <td class="${r.situacao === "aberto" && r.vencimento && r.vencimento < P.hojeISO() ? "txt-alerta" : ""}">${esc(P.dataBR(r.vencimento))}</td><td>${esc(P.moeda(r.valor))}</td>
          <td>${r.situacao === "recebido" ? `Recebido ${esc(P.dataBR(r.recebido_em))}<br><small>${esc(P.moeda(r.valor_recebido))} ${esc(r.forma || "")}</small>` : esc(r.situacao === "aberto" ? "A receber" : "Cancelado")}</td>
          <td>${gerir ? `${r.situacao === "aberto" ? `<button type="button" class="botao pequeno" data-a="baixar" data-id="${r.id}">✓ Recebi</button> ` : ""}<button type="button" class="link-botao" data-a="editarParcela" data-id="${r.id}">editar</button>` : ""}</td></tr>`).join("")}
        </tbody></table></div>` : P.vazio("Nenhuma parcela lançada.")}</div>` : ""}
      <div class="cartao"><div class="cartao-cab"><h3>Custas e despesas do processo</h3>${custasOk ? `<button type="button" class="botao-principal" data-a="novaCusta">+ Custa</button>` : ""}</div>
        ${cus.length ? `<div class="tabela-rol"><table class="tabela"><thead><tr><th>Descrição</th><th>Tipo</th><th>Valor</th><th>Pago por</th><th>Reembolso</th><th></th></tr></thead><tbody>
        ${cus.map((c) => `<tr><td>${esc(c.descricao)}<br><small>${esc(P.dataBR(c.pago_em))}</small></td><td>${esc(P.R.tipoCusta[c.tipo])}</td><td>${esc(P.moeda(c.valor))}</td>
          <td>${c.pago_por === "cliente" ? "Cliente" : "Escritório"}</td>
          <td>${c.pago_por === "escritorio" && c.reembolsavel ? (c.reembolsado_em ? `✓ ${esc(P.dataBR(c.reembolsado_em))}` : `<span class="txt-alerta">a cobrar</span>${custasOk ? ` <button type="button" class="botao pequeno" data-a="reembolsado" data-id="${c.id}">✓ Reembolsado</button>` : ""}`) : "—"}</td>
          <td>${custasOk ? `<button type="button" class="link-botao" data-a="editarCusta" data-id="${c.id}">editar</button>` : ""}</td></tr>`).join("")}
        </tbody></table></div>` : P.vazio("Nenhuma custa lançada.")}</div>
      ${verFin ? `<div class="cartao"><div class="cartao-cab"><h3>Notas fiscais emitidas</h3>${gerir ? `<button type="button" class="botao" data-a="novaNota">+ Nota</button>` : ""}</div>
        ${nts.length ? `<ul class="lista-itens">${nts.map((n) => `<li><div><div class="titulo">NF ${esc(n.numero)}${n.serie ? "/" + esc(n.serie) : ""} · ${esc(P.moeda(n.valor))}</div><div class="sub">emitida ${esc(P.dataBR(n.emitida_em))}${n.situacao === "cancelada" ? " · CANCELADA" : ""}</div></div>
          <div class="quando">${gerir ? `<button type="button" class="link-botao" data-a="editarNota" data-id="${n.id}">editar</button>` : ""}</div></li>`).join("")}</ul>` : P.vazio("Nenhuma nota registrada.")}</div>` : ""}`;
  }

  // ---------- histórico ----------
  const NOME_TABELA = { projetos: "o processo", servicos: "o serviço", servico_etapas: "a etapa", pendencias: "a pendência", protocolos: "o protocolo",
    exigencias: "a exigência", documentos: "o documento", partes: "o confrontante/assinatura", compromissos: "o compromisso", custas: "a custa",
    recebiveis: "a parcela", notas: "a nota", projeto_imoveis: "o imóvel do processo", matricula_origens: "a linhagem", imoveis: "o imóvel",
    matriculas: "a matrícula", pessoas: "a pessoa", imovel_pessoas: "o vínculo do imóvel" };
  const ACAO = { insert: "criou", update: "alterou", delete: "excluiu" };
  const ROTULO_CAMPO = { situacao: "situação", conferir_em: "conferir em", prazo: "prazo", descricao: "descrição", titulo: "título", responsavel_id: "responsável",
    acompanha_id: "acompanha", anuencia: "assinatura", assinou_em: "assinou em", versao: "versão", proxima_acao: "próxima ação", vence_em: "vence em",
    documento_emitido: "documento emitido", recebido_em: "recebido em", valor_recebido: "valor recebido", concluida_em: "concluída em", concluido_em: "concluído em",
    quem_age: "quem age", numero: "número", valor: "valor", vencimento: "vencimento", nome: "nome", checklist: "checklist" };
  function valorLegivel(campo, v) {
    if (v == null || v === "") return "—";
    if (campo === "checklist") return `${(v || []).filter((c) => c.feito).length}/${(v || []).length} itens`;
    if (typeof v === "boolean") return v ? "sim" : "não";
    if (/_id$/.test(campo)) return P.nomeUsuario(v) !== "—" ? P.nomeUsuario(v) : (P.porId("pessoas", v)?.nome || "…");
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return P.dataBR(v);
    const mapas = { situacao: { ...P.R.sitServico, ...P.R.sitEtapa, ...P.R.sitProjeto, ...P.R.sitProtocolo }, anuencia: P.R.anuencia, quem_age: P.R.quemAge };
    if (mapas[campo]?.[v]) return mapas[campo][v];
    if (typeof v === "object") return "…";
    return String(v);
  }
  P.desenharHistorico = (lista) => `<ol class="linha-tempo">${lista.map((h) => {
    const quem = P.nomeUsuario(h.usuario_id) || "Sistema";
    let txt;
    if (h.acao === "nota") txt = `<div class="nota">${esc(h.texto)}</div>`;
    else {
      const mud = h.mudancas ? Object.entries(h.mudancas).filter(([ k ]) => !/^(created|updated)_/.test(k)).map(([ k, [ a, b ] ]) => `${esc(ROTULO_CAMPO[k] || k.replace(/_/g, " "))}: ${esc(valorLegivel(k, a))} → <strong>${esc(valorLegivel(k, b))}</strong>`).join("; ") : "";
      txt = `<div>${esc(ACAO[h.acao] || h.acao)} ${esc(NOME_TABELA[h.tabela] || h.tabela)}${h.texto ? ` <em>${esc(h.texto)}</em>` : ""}</div>${mud ? `<div class="sub">${mud}</div>` : ""}`;
    }
    return `<li class="${h.acao === "nota" ? "e-nota" : ""}"><div class="lt-quando">${esc(P.dataHoraBR(h.created_at))}<br><small>${esc(quem)}</small></div><div class="lt-texto">${txt}</div></li>`;
  }).join("")}</ol>`;
  async function abaHistorico(el, p) {
    el.innerHTML = `<div class="cartao">${P.vazio("Carregando histórico…")}</div>`;
    const lista = await P.historico({ projeto_id: p.id });
    const notas = P.lerLocal("skl_proc_hist_notas") === "1";
    const mostrar = notas ? lista.filter((h) => h.acao === "nota") : lista;
    el.innerHTML = `<div class="cartao"><div class="cartao-cab"><h3>Histórico (${lista.length})</h3>
      <label class="check"><input type="checkbox" id="histNotas" ${notas ? "checked" : ""}> Só anotações</label>
      ${P.estado.perm.papel !== "consulta" ? `<button type="button" class="botao-principal" data-a="anotar">Anotar</button>` : ""}</div>
      ${mostrar.length ? P.desenharHistorico(mostrar) : P.vazio("Nada registrado ainda.")}</div>`;
    el.querySelector("#histNotas").onchange = (e) => { P.gravarLocal("skl_proc_hist_notas", e.target.checked ? "1" : ""); abaHistorico(el, p); };
  }

  // ---------- ações das abas ----------
  async function acaoAba(a, id, p) {
    const pend = () => P.porId("pendencias", id);
    switch (a) {
      case "editarServico": return formServico(p, P.porId("servicos", id));
      case "novaEtapa": return formEtapa(id);
      case "editarEtapa": { const e = P.porId("servico_etapas", id); return formEtapa(e.servico_id, e); }
      case "novaPend": return formPendencia(p);
      case "editarPend": return formPendencia(p, pend());
      case "resolverPend": { const x = pend(); await P.salvar("pendencias", { id: x.id, version: x.version, situacao: "resolvida", resolvida_em: P.hojeISO(), resolvida_por: P.estado.usuario.id }); P.toast("Pendência resolvida."); return P.redesenhar(); }
      case "adiarPend": {
        const x = pend();
        return P.form({ titulo: "Conferir de novo em…", subtitulo: x.descricao, campos: [ { id: "conferir_em", rotulo: "Nova data", tipo: "date", obrig: true }, { id: "nota", rotulo: "Anotar o motivo (opcional)", tipo: "textarea" } ],
          valores: { conferir_em: P.somarDias(P.hojeISO(), 3) }, salvarTexto: "Adiar",
          aoSalvar: async (v) => { await P.salvar("pendencias", { id: x.id, version: x.version, conferir_em: v.conferir_em }); if (v.nota) await P.anotar(p.id, `${x.descricao}: ${v.nota}`, x.servico_id); } }).then(() => P.redesenhar());
      }
      case "novoProt": return formProtocolo(p);
      case "editarProt": return formProtocolo(p, P.porId("protocolos", id));
      case "novaExig": return formExigencia(P.porId("protocolos", id));
      case "editarExig": { const x = P.porId("exigencias", id); return formExigencia(P.porId("protocolos", x.protocolo_id), x); }
      case "cumprirExig": { const x = P.porId("exigencias", id); await P.salvar("exigencias", { id: x.id, version: x.version, situacao: "cumprida", cumprida_em: P.hojeISO() }); P.toast("Exigência cumprida."); return P.redesenhar(); }
      case "novaParte": return formParte(p);
      case "editarParte": return formParte(p, P.porId("partes", id));
      case "novoDoc": return formDocumento(p);
      case "editarDoc": return formDocumento(p, P.porId("documentos", id));
      case "versaoDoc": return formDocumento(p, null, P.porId("documentos", id));
      case "abrirDoc": return P.abrirPasta(p.pasta, P.porId("documentos", id)?.caminho);
      case "novaParcela": return P.formRecebivel(p.id);
      case "editarParcela": return P.formRecebivel(p.id, P.porId("recebiveis", id));
      case "baixar": return P.formBaixa(P.porId("recebiveis", id));
      case "novaCusta": return P.formCusta(p.id);
      case "editarCusta": return P.formCusta(p.id, P.porId("custas", id));
      case "reembolsado": { const c = P.porId("custas", id); await P.salvar("custas", { id: c.id, version: c.version, reembolsado_em: P.hojeISO() }); return P.redesenhar(); }
      case "novaNota": return P.formNota(p.id);
      case "editarNota": return P.formNota(p.id, P.porId("notas", id));
      default: return null;
    }
  }
  async function mudancaAba(e, p) {
    try {
      const sit = e.target.closest("[data-etapa-sit]");
      if (sit) {
        const et = P.porId("servico_etapas", sit.dataset.etapaSit);
        await salvarEtapa(et, { situacao: sit.value, concluida_em: sit.value === "concluida" ? (et.concluida_em || P.hojeISO()) : null, concluida_por: sit.value === "concluida" ? P.estado.usuario.id : null });
        return P.redesenhar();
      }
      const ck = e.target.closest("[data-check]");
      if (ck) {
        const et = P.porId("servico_etapas", ck.dataset.check);
        const lista = (et.checklist || []).map((c, i) => i === Number(ck.dataset.i) ? { ...c, feito: ck.checked, feito_em: ck.checked ? P.hojeISO() : null, feito_por: ck.checked ? P.estado.usuario.id : null } : c);
        const mud = { checklist: lista };
        if (ck.checked && et.situacao === "pendente") mud.situacao = "andamento";
        await salvarEtapa(et, mud);
        return P.redesenhar();
      }
      const an = e.target.closest("[data-anuencia]");
      if (an) {
        const x = P.porId("partes", an.dataset.anuencia);
        await P.salvar("partes", { id: x.id, version: x.version, anuencia: an.value, assinou_em: an.value === "assinou" ? (x.assinou_em || P.hojeISO()) : x.assinou_em });
        P.toast("Assinatura atualizada."); return P.redesenhar();
      }
    } catch (err) { P.toast(P.msgErro(err)); P.redesenhar(); }
  }

  P.pagina("processos", {
    titulo: "Processos",
    render(el, param) {
      if (param?.projeto) renderFicha(el, param.projeto, param.aba);
      else renderPaginaLista(el);
    },
  });
})();

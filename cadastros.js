// SKL Processos — Imóveis (com matrículas e linhagem de origem/destino) e Pessoas.
(() => {
  "use strict";
  const P = window.SKLProc; const { esc } = P;

  // ======================= IMÓVEIS =======================
  const camposImovel = () => [
    { id: "tipo", rotulo: "Tipo", tipo: "select", opcoes: [ [ "rural", "Rural" ], [ "urbano", "Urbano" ] ], vazio: false },
    { id: "denominacao", rotulo: "Denominação", obrig: true, placeholder: "Ex.: Fazenda Boa Vista / Lote 12 Qd 04 - Jd. Primavera", largura: "inteira" },
    { id: "municipio", rotulo: "Município" }, { id: "uf", rotulo: "UF", padrao: "MT" }, { id: "comarca", rotulo: "Comarca" },
    { id: "area_valor", rotulo: "Área", tipo: "number", passo: "any" },
    { id: "area_unidade", rotulo: "Unidade", tipo: "select", opcoes: P.opcoes(P.R.unidade), vazio: false },
    { tipo: "titulo", rotulo: "Rural" },
    { id: "ccir", rotulo: "CCIR" }, { id: "car", rotulo: "Nº do CAR" }, { id: "sigef", rotulo: "Código SIGEF" }, { id: "nirf", rotulo: "NIRF / ITR" },
    { id: "acesso", rotulo: "Localidade / estrada de acesso", largura: "inteira" },
    { tipo: "titulo", rotulo: "Urbano" },
    { id: "inscricao", rotulo: "Inscrição imobiliária" }, { id: "loteamento", rotulo: "Loteamento / bairro" },
    { id: "quadra", rotulo: "Quadra" }, { id: "lote", rotulo: "Lote" }, { id: "endereco", rotulo: "Endereço", largura: "inteira" },
    { id: "observacoes", rotulo: "Observações", tipo: "textarea" },
  ];
  P.novoImovel = async (pre = {}) => {
    const r = await P.form({ titulo: "Novo imóvel", subtitulo: "Preencha os campos do tipo (rural ou urbano); os outros podem ficar em branco.",
      campos: camposImovel(), valores: { tipo: "rural", area_unidade: "ha", uf: "MT", ...pre }, aoSalvar: (v) => P.salvar("imoveis", v) });
    return r?.id ? r : null;
  };
  const editarImovel = (i) => P.form({ titulo: "Editar imóvel", campos: camposImovel(), valores: i,
    aoSalvar: (v) => P.salvar("imoveis", { ...v, id: i.id, version: i.version }),
    aoExcluir: P.estado.perm.papel === "administrador" ? () => P.excluir("imoveis", i.id) : null, excluirTexto: "Excluir imóvel",
  }).then((r) => { if (r === "excluido") P.ir("imoveis"); else P.redesenhar(); });

  const formMatricula = (imovelId, m) => P.form({ titulo: m ? `Matrícula ${m.numero}` : "Nova matrícula", campos: [
    { id: "numero", rotulo: "Número", obrig: true }, { id: "cartorio", rotulo: "Cartório", largura: "inteira" }, { id: "livro", rotulo: "Livro" },
    { id: "area_valor", rotulo: "Área na matrícula", tipo: "number" },
    { id: "area_unidade", rotulo: "Unidade", tipo: "select", opcoes: P.opcoes(P.R.unidade), vazio: false },
    { id: "situacao", rotulo: "Situação", tipo: "select", opcoes: [ [ "ativa", "Ativa" ], [ "encerrada", "Encerrada" ] ], vazio: false },
    { id: "imovel_id", rotulo: "Imóvel", tipo: "select", opcoes: P.opImoveis, vazio: "Sem imóvel (ex.: área vendida)" },
    { id: "observacoes", rotulo: "Observações", tipo: "textarea" },
  ], valores: m || { imovel_id: imovelId, situacao: "ativa", area_unidade: P.porId("imoveis", imovelId)?.area_unidade || "ha" },
  aoSalvar: (v) => P.salvar("matriculas", { ...v, id: m?.id, version: m?.version }),
  aoExcluir: m ? () => P.excluir("matriculas", m.id, [ "matriculas", "matricula_origens" ]) : null }).then(() => P.redesenhar());

  const formLinhagem = (imovelId, x) => {
    const minhas = (P.dados.matriculas || []).filter((m) => m.imovel_id === imovelId);
    return P.form({ titulo: x ? "Editar origem / destino" : "Registrar origem → destino",
      subtitulo: "Desmembramento: uma origem, vários destinos (Área 01, Área 02, Remanescente). Remembramento/unificação: várias origens para o mesmo destino. Sem matrícula nova ainda? Deixe o destino em branco e escreva o nome da área.",
      campos: [
        { id: "origem_id", rotulo: "Matrícula de origem", tipo: "select", obrig: true, opcoes: P.opMatriculas },
        { id: "evento", rotulo: "Evento", tipo: "select", opcoes: P.opcoes(P.R.evento), vazio: false },
        { id: "destino_nome", rotulo: "Nome da área de destino", placeholder: "Ex.: Área 01, Remanescente" },
        { id: "destino_id", rotulo: "Matrícula nova (quando sair)", tipo: "select", opcoes: P.opMatriculas, vazio: "Ainda não saiu" },
        { id: "destino_area", rotulo: "Área do destino", tipo: "number" },
        { id: "destino_unidade", rotulo: "Unidade", tipo: "select", opcoes: P.opcoes(P.R.unidade), vazio: false },
        { id: "servico_id", rotulo: "Serviço", tipo: "select", opcoes: () => (P.dados.servicos || []).map((s) => [ s.id, `${P.porId("projetos", s.projeto_id)?.codigo || ""} · ${s.titulo}` ]) },
        { id: "data", rotulo: "Data", tipo: "date" },
      ],
      valores: x || { origem_id: minhas[0]?.id, evento: "desmembramento", destino_unidade: P.porId("imoveis", imovelId)?.area_unidade || "ha" },
      aoSalvar: (v) => P.salvar("matricula_origens", { ...v, id: x?.id, version: x?.version }),
      aoExcluir: x ? () => P.excluir("matricula_origens", x.id, [ "matricula_origens" ]) : null,
    }).then(() => P.redesenhar());
  };

  const filtroIm = { busca: "", tipo: "" };
  function listaImoveis(el) {
    const lista = (P.dados.imoveis || []).filter((i) => (!filtroIm.tipo || i.tipo === filtroIm.tipo)
      && P.contem([ i.denominacao, i.municipio, i.ccir, i.car, i.sigef, i.inscricao, i.loteamento, ...(P.dados.matriculas || []).filter((m) => m.imovel_id === i.id).map((m) => m.numero),
        ...(P.dados.imovel_pessoas || []).filter((x) => x.imovel_id === i.id).map((x) => P.porId("pessoas", x.pessoa_id)?.nome) ].join(" "), filtroIm.busca))
      .sort((a, b) => a.denominacao.localeCompare(b.denominacao, "pt-BR"));
    el.innerHTML = `<div class="barra-filtros">
        <input type="search" id="imBusca" placeholder="Nome, município, matrícula, CAR, proprietário…" value="${esc(filtroIm.busca)}">
        <select id="imTipo"><option value="">Rural e urbano</option><option value="rural" ${filtroIm.tipo === "rural" ? "selected" : ""}>Rural</option><option value="urbano" ${filtroIm.tipo === "urbano" ? "selected" : ""}>Urbano</option></select>
        <span class="espaco"></span>${P.pode("editar_processos") ? `<button type="button" class="botao-principal" id="imNovo">+ Novo imóvel</button>` : ""}</div>
      <div class="cartao"><ul class="lista-itens">${lista.map((i) => {
        const mats = (P.dados.matriculas || []).filter((m) => m.imovel_id === i.id);
        const donos = (P.dados.imovel_pessoas || []).filter((x) => x.imovel_id === i.id).map((x) => P.porId("pessoas", x.pessoa_id)?.nome).filter(Boolean);
        const nProc = (P.dados.projeto_imoveis || []).filter((x) => x.imovel_id === i.id).length;
        return `<li class="clicavel" data-imovel="${i.id}"><div><div class="titulo">${esc(i.denominacao)} ${P.selo(i.tipo === "rural" ? "Rural" : "Urbano", i.tipo)}</div>
          <div class="sub">${esc([ i.municipio, i.uf ].filter(Boolean).join("/"))}${i.area_valor ? " · " + esc(P.area(i.area_valor, i.area_unidade)) : ""}${mats.length ? " · matr. " + esc(mats.map((m) => m.numero).join(", ")) : ""}</div>
          <div class="sub">${esc(donos.join(", ") || "sem proprietário cadastrado")}</div></div>
          <div class="quando">${nProc} processo${nProc === 1 ? "" : "s"}</div></li>`;
      }).join("") || `<li>${P.vazio("Nenhum imóvel.")}</li>`}</ul></div>`;
    el.querySelector("#imBusca").oninput = (e) => { filtroIm.busca = e.target.value; const pos = e.target.selectionStart; listaImoveis(el); const n = el.querySelector("#imBusca"); n.focus(); n.setSelectionRange(pos, pos); };
    el.querySelector("#imTipo").onchange = (e) => { filtroIm.tipo = e.target.value; listaImoveis(el); };
    el.querySelector("#imNovo")?.addEventListener("click", async () => { const i = await P.novoImovel(); if (i) P.abrirImovel(i.id); });
    el.onclick = (e) => { const li = e.target.closest("[data-imovel]"); if (li) P.abrirImovel(li.dataset.imovel); };
  }

  async function fichaImovel(el, id) {
    const i = P.porId("imoveis", id);
    if (!i) { el.innerHTML = P.vazio("Imóvel não encontrado."); return; }
    const pode = P.pode("editar_processos");
    const mats = (P.dados.matriculas || []).filter((m) => m.imovel_id === i.id);
    const mids = new Set(mats.map((m) => m.id));
    const lin = (P.dados.matricula_origens || []).filter((o) => mids.has(o.origem_id) || mids.has(o.destino_id));
    const donos = (P.dados.imovel_pessoas || []).filter((x) => x.imovel_id === i.id);
    const procs = (P.dados.projeto_imoveis || []).filter((x) => x.imovel_id === i.id).map((x) => P.porId("projetos", x.projeto_id)).filter(Boolean)
      .sort((a, b) => (b.codigo || "").localeCompare(a.codigo || ""));
    const mNome = (mid) => { const m = P.porId("matriculas", mid); return m ? `Matrícula ${m.numero}` : "—"; };
    const campo = (r, v) => v ? `<div><span>${r}</span>${esc(v)}</div>` : "";
    el.innerHTML = `<button type="button" class="link-botao" data-a="voltar">‹ Imóveis</button>
      <div class="cartao ficha-cab"><div class="ficha-titulo"><h2>${esc(i.denominacao)}</h2>${P.selo(i.tipo === "rural" ? "Rural" : "Urbano", i.tipo)}</div>
        <div class="ficha-info">${campo("Município", [ i.municipio, i.uf ].filter(Boolean).join("/"))}${campo("Comarca", i.comarca)}${campo("Área", P.area(i.area_valor, i.area_unidade))}
          ${campo("CCIR", i.ccir)}${campo("CAR", i.car)}${campo("SIGEF", i.sigef)}${campo("NIRF / ITR", i.nirf)}${campo("Acesso", i.acesso)}
          ${campo("Inscrição imobiliária", i.inscricao)}${campo("Loteamento / bairro", i.loteamento)}${campo("Quadra / lote", [ i.quadra, i.lote ].filter(Boolean).join(" / "))}${campo("Endereço", i.endereco)}</div>
        ${i.observacoes ? `<p class="ajuda">${esc(i.observacoes)}</p>` : ""}
        <div class="acoes">${pode ? `<button type="button" class="botao" data-a="editar">Editar</button><button type="button" class="botao" data-a="novoProc">+ Processo para este imóvel</button>` : ""}</div></div>
      <div class="grade-2">
        <div class="cartao"><div class="cartao-cab"><h3>Proprietários e envolvidos</h3>${pode ? `<button type="button" class="botao pequeno" data-a="addDono">+ Pessoa</button>` : ""}</div>
          ${donos.length ? `<ul class="lista-itens">${donos.map((x) => { const pe = P.porId("pessoas", x.pessoa_id);
            return `<li><div><a href="#" data-a="pessoa" data-id="${x.pessoa_id}">${esc(pe?.nome || "—")}</a><div class="sub">${esc(P.R.papelImovel[x.papel])}${x.percentual ? ` · ${P.numero(x.percentual)}%` : ""}</div></div>
            <div class="quando">${pode ? `<button type="button" class="link-botao" data-a="tirarDono" data-id="${x.id}">tirar</button>` : ""}</div></li>`; }).join("")}</ul>` : P.vazio("Ninguém vinculado.")}</div>
        <div class="cartao"><div class="cartao-cab"><h3>Matrículas</h3>${pode ? `<button type="button" class="botao pequeno" data-a="novaMat">+ Matrícula</button>` : ""}</div>
          ${mats.length ? `<ul class="lista-itens">${mats.map((m) => `<li><div><div class="titulo">Matrícula ${esc(m.numero)} ${m.situacao === "encerrada" ? P.selo("encerrada", "sit-cancelado") : ""}</div>
            <div class="sub">${esc(m.cartorio || "")}${m.area_valor ? " · " + esc(P.area(m.area_valor, m.area_unidade)) : ""}</div>${m.observacoes ? `<div class="sub">${esc(m.observacoes)}</div>` : ""}</div>
            <div class="quando">${pode ? `<button type="button" class="link-botao" data-a="editarMat" data-id="${m.id}">editar</button>` : ""}</div></li>`).join("")}</ul>` : P.vazio("Nenhuma matrícula cadastrada.")}</div>
      </div>
      <div class="cartao"><div class="cartao-cab"><h3>Origem e destino das áreas</h3>${pode && mats.length ? `<button type="button" class="botao pequeno" data-a="novaLin">+ Registrar</button>` : ""}</div>
        ${lin.length ? `<div class="tabela-rol"><table class="tabela"><thead><tr><th>Origem</th><th>Evento</th><th>Destino</th><th>Área</th><th>Serviço</th><th></th></tr></thead><tbody>
        ${lin.map((o) => { const sv = P.porId("servicos", o.servico_id); const pj = P.porId("projetos", sv?.projeto_id);
          return `<tr><td>${esc(mNome(o.origem_id))}</td><td>${esc(P.R.evento[o.evento])}${o.data ? `<br><small>${esc(P.dataBR(o.data))}</small>` : ""}</td>
          <td><strong>${esc(o.destino_nome || "")}</strong><br>${o.destino_id ? esc(mNome(o.destino_id)) : `<small class="txt-alerta">matrícula ainda não saiu</small>`}</td>
          <td>${esc(P.area(o.destino_area, o.destino_unidade))}</td>
          <td>${pj ? `<a href="#" data-a="proc" data-id="${pj.id}">${esc(pj.codigo)}</a> ${esc(sv.titulo)}` : ""}</td>
          <td>${pode ? `<button type="button" class="link-botao" data-a="editarLin" data-id="${o.id}">editar</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div>`
        : P.vazio("Nenhum registro de desmembramento, remembramento ou retificação.")}</div>
      <div class="cartao"><h3>Processos deste imóvel (${procs.length})</h3>
        ${procs.length ? `<ul class="lista-itens">${procs.map((p) => `<li class="clicavel" data-proc="${p.id}"><div><div class="titulo">${P.linhaProjeto(p)}</div>
          <div class="sub">${P.servicosDoProjeto(p.id).map((s) => esc(s.titulo + " · " + P.R.sitServico[s.situacao])).join(" | ")}</div></div>
          <div class="quando">${esc(P.R.sitProjeto[p.situacao])}<br><small>${esc(P.dataBR(p.contrato_em))}</small></div></li>`).join("")}</ul>` : P.vazio("Nenhum processo.")}</div>`;
    el.onclick = async (e) => {
      const pr = e.target.closest("[data-proc]"); if (pr) { P.abrirProjeto(pr.dataset.proc); return; }
      const b = e.target.closest("[data-a]"); if (!b) return;
      if (b.tagName === "A") e.preventDefault();
      const idb = b.dataset.id;
      try {
        switch (b.dataset.a) {
          case "voltar": return P.ir("imoveis");
          case "editar": return editarImovel(i);
          case "pessoa": return P.abrirPessoa(idb);
          case "proc": return P.abrirProjeto(idb);
          case "novoProc": return P.novoProjeto({ imovel_id: i.id, titulo: i.denominacao + " — " });
          case "novaMat": return formMatricula(i.id);
          case "editarMat": return formMatricula(i.id, P.porId("matriculas", idb));
          case "novaLin": return formLinhagem(i.id);
          case "editarLin": return formLinhagem(i.id, P.porId("matricula_origens", idb));
          case "tirarDono": if (confirm("Tirar esta pessoa do imóvel?")) { await P.excluir("imovel_pessoas", idb, [ "imovel_pessoas" ]); P.redesenhar(); } return;
          case "addDono": return P.form({ titulo: "Vincular pessoa ao imóvel", campos: [
            { id: "pessoa_id", rotulo: "Pessoa", tipo: "select", obrig: true, opcoes: () => [ [ "__nova", "+ Cadastrar nova pessoa…" ], ...P.opPessoas() ] },
            { id: "papel", rotulo: "Papel", tipo: "select", opcoes: P.opcoes(P.R.papelImovel), vazio: false },
            { id: "percentual", rotulo: "% (se houver)", tipo: "number" } ], valores: { papel: "proprietario" },
            aoSalvar: async (v) => { if (v.pessoa_id === "__nova") { const pe = await P.novaPessoa(); if (!pe) throw new Error("Cadastre a pessoa."); v.pessoa_id = pe.id; }
              return P.salvar("imovel_pessoas", { ...v, imovel_id: i.id }); } }).then(() => P.redesenhar());
        }
      } catch (err) { P.toast(P.msgErro(err)); }
    };
  }

  P.pagina("imoveis", { titulo: "Imóveis", render(el, param) { if (param?.imovel) fichaImovel(el, param.imovel); else listaImoveis(el); } });

  // ======================= PESSOAS =======================
  const filtroPe = { busca: "", papel: "" };
  function papeisDaPessoa(id) {
    const r = new Set();
    if ((P.dados.projetos || []).some((p) => p.cliente_id === id)) r.add("Cliente");
    if ((P.dados.imovel_pessoas || []).some((x) => x.pessoa_id === id)) r.add("Proprietário");
    if ((P.dados.partes || []).some((x) => x.pessoa_id === id && x.papel === "confrontante")) r.add("Confrontante");
    if ((P.dados.pendencias || []).some((x) => x.quem_age_pessoa_id === id && x.quem_age === "terceiro")) r.add("Prestador");
    return [ ...r ];
  }
  function listaPessoas(el) {
    const lista = (P.dados.pessoas || []).filter((p) => P.contem(`${p.nome} ${p.apelido || ""} ${p.documento || ""} ${p.celular || ""} ${p.email || ""}`, filtroPe.busca)
      && (!filtroPe.papel || papeisDaPessoa(p.id).includes(filtroPe.papel))).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    el.innerHTML = `<div class="barra-filtros">
        <input type="search" id="peBusca" placeholder="Nome, apelido, CPF/CNPJ, telefone…" value="${esc(filtroPe.busca)}">
        <select id="pePapel"><option value="">Todos</option>${[ "Cliente", "Proprietário", "Confrontante", "Prestador" ].map((x) => `<option ${filtroPe.papel === x ? "selected" : ""}>${x}</option>`).join("")}</select>
        <span class="espaco"></span>${P.pode("editar_processos") ? `<button type="button" class="botao-principal" id="peNova">+ Nova pessoa</button>` : ""}</div>
      <div class="cartao"><ul class="lista-itens">${lista.map((p) => `<li class="clicavel" data-pessoa="${p.id}"><div><div class="titulo">${esc(p.nome)}${p.apelido ? ` <small>(${esc(p.apelido)})</small>` : ""}</div>
        <div class="sub">${papeisDaPessoa(p.id).map((x) => P.selo(x)).join("")}${esc([ p.documento, p.celular ].filter(Boolean).join(" · "))}</div></div></li>`).join("") || `<li>${P.vazio("Ninguém encontrado.")}</li>`}</ul></div>`;
    el.querySelector("#peBusca").oninput = (e) => { filtroPe.busca = e.target.value; const pos = e.target.selectionStart; listaPessoas(el); const n = el.querySelector("#peBusca"); n.focus(); n.setSelectionRange(pos, pos); };
    el.querySelector("#pePapel").onchange = (e) => { filtroPe.papel = e.target.value; listaPessoas(el); };
    el.querySelector("#peNova")?.addEventListener("click", async () => { const p = await P.novaPessoa(); if (p) P.abrirPessoa(p.id); });
    el.onclick = (e) => { const li = e.target.closest("[data-pessoa]"); if (li) P.abrirPessoa(li.dataset.pessoa); };
  }
  function fichaPessoa(el, id) {
    const p = P.porId("pessoas", id);
    if (!p) { el.innerHTML = P.vazio("Pessoa não encontrada."); return; }
    const pode = P.pode("editar_processos");
    const imvs = (P.dados.imovel_pessoas || []).filter((x) => x.pessoa_id === id);
    const procs = (P.dados.projetos || []).filter((x) => x.cliente_id === id);
    const partes = (P.dados.partes || []).filter((x) => x.pessoa_id === id);
    const pend = (P.dados.pendencias || []).filter((x) => x.quem_age_pessoa_id === id && x.situacao === "aberta");
    const zap = String(p.celular || "").replace(/\D/g, "");
    el.innerHTML = `<button type="button" class="link-botao" data-a="voltar">‹ Pessoas</button>
      <div class="cartao ficha-cab"><div class="ficha-titulo"><h2>${esc(p.nome)}</h2>${p.apelido ? P.selo(p.apelido) : ""}${papeisDaPessoa(id).map((x) => P.selo(x)).join("")}</div>
        <div class="ficha-info"><div><span>${p.tipo === "pj" ? "CNPJ" : "CPF"}</span>${esc(p.documento || "—")}</div>
          <div><span>Celular</span>${esc(p.celular || "—")}${zap.length >= 10 ? ` <a href="https://wa.me/55${zap.replace(/^55/, "")}" target="_blank" rel="noopener">WhatsApp</a>` : ""}</div>
          <div><span>Outro telefone</span>${esc(p.telefone || "—")}</div><div><span>E-mail</span>${esc(p.email || "—")}</div></div>
        ${p.observacoes ? `<p class="ajuda">${esc(p.observacoes)}</p>` : ""}
        <div class="acoes">${pode ? `<button type="button" class="botao" data-a="editar">Editar</button><button type="button" class="botao" data-a="novoProc">+ Processo para esta pessoa</button>` : ""}</div></div>
      ${pend.length ? `<div class="cartao"><h3>Esperando esta pessoa (${pend.length})</h3><ul class="lista-itens">${pend.map((x) => `<li class="clicavel" data-proc="${x.projeto_id}" data-aba="pendencias"><div><div class="titulo">${esc(x.descricao)}</div><div class="sub">${P.linhaProjeto(P.porId("projetos", x.projeto_id))}</div></div><div class="quando ${P.quando(x.conferir_em).atrasado ? "atrasado" : ""}">conferir ${esc(P.quando(x.conferir_em).txt)}</div></li>`).join("")}</ul></div>` : ""}
      <div class="grade-2">
        <div class="cartao"><h3>Processos como cliente (${procs.length})</h3>${procs.length ? `<ul class="lista-itens">${procs.map((x) => `<li class="clicavel" data-proc="${x.id}"><div><div class="titulo">${P.linhaProjeto(x)}</div></div><div class="quando">${esc(P.R.sitProjeto[x.situacao])}</div></li>`).join("")}</ul>` : P.vazio("Nenhum.")}</div>
        <div class="cartao"><h3>Imóveis (${imvs.length})</h3>${imvs.length ? `<ul class="lista-itens">${imvs.map((x) => { const i = P.porId("imoveis", x.imovel_id); return `<li class="clicavel" data-imovel="${x.imovel_id}"><div><div class="titulo">${esc(i?.denominacao || "—")}</div><div class="sub">${esc(P.R.papelImovel[x.papel])}</div></div></li>`; }).join("")}</ul>` : P.vazio("Nenhum.")}</div>
      </div>
      ${partes.length ? `<div class="cartao"><h3>Assinaturas e confrontações (${partes.length})</h3><ul class="lista-itens">${partes.map((x) => { const sv = P.porId("servicos", x.servico_id); const pj = P.porId("projetos", sv?.projeto_id);
        return `<li class="clicavel" data-proc="${pj?.id}" data-aba="assinaturas"><div><div class="titulo">${P.linhaProjeto(pj)}</div><div class="sub">${esc(P.R.papelParte[x.papel])}${x.lado ? " · " + esc(x.lado) : ""}</div></div><div class="quando">${esc(P.R.anuencia[x.anuencia])}</div></li>`; }).join("")}</ul></div>` : ""}`;
    el.onclick = async (e) => {
      const pr = e.target.closest("[data-proc]"); if (pr) { P.abrirProjeto(pr.dataset.proc, pr.dataset.aba); return; }
      const im = e.target.closest("[data-imovel]"); if (im) { P.abrirImovel(im.dataset.imovel); return; }
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "voltar") P.ir("pessoas");
      if (a === "novoProc") P.novoProjeto({ cliente_id: id });
      if (a === "editar") P.form({ titulo: "Editar pessoa", campos: P.camposPessoa(), valores: p, aoSalvar: (v) => P.salvar("pessoas", { ...v, id: p.id, version: p.version }),
        aoExcluir: P.estado.perm.papel === "administrador" ? () => P.excluir("pessoas", p.id) : null, excluirTexto: "Excluir pessoa" })
        .then((r) => { if (r === "excluido") P.ir("pessoas"); else P.redesenhar(); });
    };
  }
  P.pagina("pessoas", { titulo: "Pessoas", render(el, param) { if (param?.pessoa) fichaPessoa(el, param.pessoa); else listaPessoas(el); } });
})();

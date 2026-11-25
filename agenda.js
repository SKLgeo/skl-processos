// SKL Processos — Agenda: compromissos + tudo que tem data (conferir, prazos, exigências, etapas, vencimentos).
(() => {
  "use strict";
  const P = window.SKLProc; const { esc } = P;
  let soMeus = false;

  P.formCompromisso = (c, pre = {}) => P.form({
    titulo: c ? "Editar compromisso" : "Novo compromisso", campos: [
      { id: "titulo", rotulo: "O que é", obrig: true, largura: "inteira", placeholder: "Ex.: Campo GNSS, ida ao cartório, reunião com o cliente" },
      { id: "tipo", rotulo: "Tipo", tipo: "select", opcoes: P.opcoes(P.R.tipoComp), vazio: false },
      { id: "inicio", rotulo: "Início", tipo: "datetime", obrig: true },
      { id: "fim", rotulo: "Fim", tipo: "datetime" },
      { id: "local", rotulo: "Local", largura: "inteira" },
      { id: "projeto_id", rotulo: "Processo", tipo: "select", opcoes: () => (P.dados.projetos || []).filter((p) => p.situacao === "ativo" || p.id === c?.projeto_id).map((p) => [ p.id, `${p.codigo} · ${p.titulo}` ]) },
      { id: "responsavel_id", rotulo: "Quem vai", tipo: "select", opcoes: P.opEquipe },
      ...(c ? [ { id: "situacao", rotulo: "Situação", tipo: "select", opcoes: P.opcoes(P.R.sitComp), vazio: false } ] : []),
      { id: "observacoes", rotulo: "Observações", tipo: "textarea" },
    ],
    valores: c || { tipo: "campo", responsavel_id: P.estado.usuario.id, ...pre },
    aoSalvar: (v) => P.salvar("compromissos", { ...v, id: c?.id, version: c?.version, servico_id: c?.servico_id && v.projeto_id === c.projeto_id ? c.servico_id : null }),
    aoExcluir: c ? () => P.excluir("compromissos", c.id, [ "compromissos" ]) : null,
  }).then(() => P.redesenhar());

  function itens() {
    const D = P.dados; const eu = P.estado.usuario.id; const ini = P.somarDias(P.hojeISO(), -60); const fim = P.somarDias(P.hojeISO(), 90);
    const ativos = new Set((D.projetos || []).filter((p) => p.situacao === "ativo").map((p) => p.id));
    const meu = (uid) => !soMeus || uid === eu;
    const out = [];
    const add = (data, o) => { if (data && data >= ini && data <= fim) out.push({ data: data.slice(0, 10), ...o }); };
    for (const c of D.compromissos || []) if (c.situacao !== "cancelado" && meu(c.responsavel_id))
      add(new Date(c.inicio).toLocaleDateString("sv-SE"), { tipo: "comp", hora: new Date(c.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), titulo: c.titulo, sub: `${P.R.tipoComp[c.tipo]}${c.local ? " · " + c.local : ""} · ${P.nomeUsuario(c.responsavel_id)}`, projeto: c.projeto_id, id: c.id, aberto: c.situacao === "agendado" });
    for (const x of D.pendencias || []) if (x.situacao === "aberta" && ativos.has(x.projeto_id) && meu(x.acompanha_id)) {
      if (x.conferir_em) add(x.conferir_em, { tipo: "pend", titulo: "Conferir: " + x.descricao, sub: "Quem age: " + P.quemAgeTexto(x), projeto: x.projeto_id, aba: "pendencias", aberto: true });
      if (x.prazo && x.prazo !== x.conferir_em) add(x.prazo, { tipo: "prazo", titulo: "Prazo: " + x.descricao, sub: "Quem age: " + P.quemAgeTexto(x), projeto: x.projeto_id, aba: "pendencias", aberto: true });
    }
    for (const x of D.exigencias || []) if (x.situacao === "aberta" && x.prazo) {
      const pr = P.porId("protocolos", x.protocolo_id); const sv = P.porId("servicos", pr?.servico_id);
      add(x.prazo, { tipo: "exig", titulo: "Exigência: " + x.descricao, sub: `${pr?.orgao_nome || ""} nº ${pr?.numero || "—"}`, projeto: sv?.projeto_id, aba: "protocolos", aberto: true });
    }
    for (const e of D.servico_etapas || []) if (e.prazo && ![ "concluida", "nao_aplica" ].includes(e.situacao)) {
      const sv = P.porId("servicos", e.servico_id); if (!sv || !ativos.has(sv.projeto_id) || !meu(sv.responsavel_id)) continue;
      add(e.prazo, { tipo: "etapa", titulo: "Etapa: " + e.nome, sub: sv.titulo, projeto: sv.projeto_id, aberto: true });
    }
    for (const s of D.servicos || []) if (s.vence_em) add(s.vence_em, { tipo: "vence", titulo: "Vence: " + (s.documento_emitido || s.titulo), sub: s.titulo, projeto: s.projeto_id, aberto: true });
    for (const pr of D.protocolos || []) if (pr.validade && [ "em_analise", "exigencia" ].includes(pr.situacao)) {
      const sv = P.porId("servicos", pr.servico_id); add(pr.validade, { tipo: "prazo", titulo: `Validade do protocolo nº ${pr.numero || "—"}`, sub: pr.orgao_nome || "", projeto: sv?.projeto_id, aba: "protocolos", aberto: true });
    }
    if (P.pode("ver_financeiro")) for (const r of D.recebiveis || []) if (r.situacao === "aberto" && r.vencimento)
      add(r.vencimento, { tipo: "rec", titulo: `Receber ${P.moeda(r.valor)}: ${r.descricao}`, sub: "", projeto: r.projeto_id, aba: "financeiro", aberto: true });
    return out.sort((a, b) => a.data.localeCompare(b.data) || (a.hora || "").localeCompare(b.hora || ""));
  }
  const ROT = { comp: "Compromisso", pend: "Conferir", prazo: "Prazo", exig: "Exigência", etapa: "Etapa", vence: "Vencimento", rec: "A receber" };

  function render(el) {
    const h = P.hojeISO(); const todos = itens();
    const atrasados = todos.filter((x) => x.data < h && x.aberto && x.tipo !== "comp");
    const futuros = todos.filter((x) => x.data >= h);
    const porDia = new Map(); futuros.forEach((x) => { if (!porDia.has(x.data)) porDia.set(x.data, []); porDia.get(x.data).push(x); });
    const linha = (x) => {
      const proj = P.porId("projetos", x.projeto);
      return `<li class="clicavel ag-${x.tipo}" ${x.tipo === "comp" ? `data-comp="${x.id}"` : `data-proc="${x.projeto || ""}" data-aba="${x.aba || ""}"`}>
        <div><div class="titulo">${x.hora ? `<strong>${esc(x.hora)}</strong> ` : ""}${esc(x.titulo)}</div><div class="sub">${P.selo(ROT[x.tipo], "ag-" + x.tipo)}${proj ? P.linhaProjeto(proj) + " · " : ""}${esc(x.sub)}</div></div>
        ${x.data < h ? `<div class="quando atrasado">${esc(P.dataBR(x.data))}</div>` : ""}</li>`;
    };
    el.innerHTML = `<div class="barra-filtros"><label class="check"><input type="checkbox" id="agMeus" ${soMeus ? "checked" : ""}> Só o meu</label><span class="espaco"></span>
        ${P.pode("editar_processos") ? `<button type="button" class="botao-principal" id="agNovo">+ Compromisso</button>` : ""}</div>
      ${atrasados.length ? `<div class="cartao alerta-borda"><h3>Atrasados (${atrasados.length})</h3><ul class="lista-itens">${atrasados.map(linha).join("")}</ul></div>` : ""}
      ${[ ...porDia.entries() ].map(([ d, xs ]) => {
        const dt = new Date(d + "T12:00:00"); const rot = d === h ? "Hoje" : d === P.somarDias(h, 1) ? "Amanhã" : dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
        return `<div class="cartao ${d === h ? "dia-hoje" : ""}"><h3>${esc(rot)} <small class="sub">${esc(P.dataBR(d))}</small></h3><ul class="lista-itens">${xs.map(linha).join("")}</ul></div>`;
      }).join("") || P.vazio("Nada nos próximos 90 dias.")}`;
    el.querySelector("#agMeus").onchange = (e) => { soMeus = e.target.checked; render(el); };
    el.querySelector("#agNovo")?.addEventListener("click", () => P.formCompromisso());
    el.onclick = (e) => {
      const c = e.target.closest("[data-comp]"); if (c) { P.formCompromisso(P.porId("compromissos", c.dataset.comp)); return; }
      const pr = e.target.closest("[data-proc]"); if (pr?.dataset.proc) P.abrirProjeto(pr.dataset.proc, pr.dataset.aba || undefined);
    };
  }
  P.pagina("agenda", { titulo: "Agenda", render });
})();

// SKL Processos — tela Hoje: o que precisa de atenção, de quem depende e quando conferir.
(() => {
  "use strict";
  const P = window.SKLProc; const { esc } = P;

  // helpers de processo usados por várias telas
  P.servicosDoProjeto = (pid) => (P.dados.servicos || []).filter((s) => s.projeto_id === pid);
  P.etapasDoServico = (sid) => (P.dados.servico_etapas || []).filter((e) => e.servico_id === sid).sort((a, b) => a.ordem - b.ordem);
  P.etapaAtual = (sid) => {
    const et = P.etapasDoServico(sid);
    return et.find((e) => e.situacao === "andamento") || et.find((e) => e.situacao === "pendente") || null;
  };
  P.progresso = (sid) => {
    const et = P.etapasDoServico(sid); if (!et.length) return null;
    const feitas = et.filter((e) => e.situacao === "concluida" || e.situacao === "nao_aplica").length;
    return { feitas, total: et.length };
  };
  P.projetoDe = (linha) => P.porId("projetos", linha.projeto_id || P.porId("servicos", linha.servico_id)?.projeto_id);
  P.ultimoMov = (pid) => {
    const sids = new Set(P.servicosDoProjeto(pid).map((s) => s.id));
    let max = P.porId("projetos", pid)?.updated_at || "";
    const ver = (l) => { if (l.updated_at > max) max = l.updated_at; };
    for (const n of [ "servicos", "pendencias", "compromissos", "custas" ]) (P.dados[n] || []).forEach((l) => { if (l.projeto_id === pid || sids.has(l.servico_id) || (n === "servicos" && l.projeto_id === pid)) ver(l); });
    for (const n of [ "servico_etapas", "protocolos", "documentos", "partes" ]) (P.dados[n] || []).forEach((l) => { if (sids.has(l.servico_id)) ver(l); });
    const pids = new Set((P.dados.protocolos || []).filter((p) => sids.has(p.servico_id)).map((p) => p.id));
    (P.dados.exigencias || []).forEach((l) => { if (pids.has(l.protocolo_id)) ver(l); });
    return max;
  };
  P.diasParado = (pid) => { const u = P.ultimoMov(pid); return u ? Math.max(0, -P.diasAte(u.slice(0, 10))) : 0; };
  P.limiteParado = () => Number(P.estado.escritorio?.config?.dias_parado) || 15;
  P.clienteDe = (proj) => P.porId("pessoas", proj?.cliente_id);
  P.imoveisDoProjeto = (pid) => (P.dados.projeto_imoveis || []).filter((x) => x.projeto_id === pid).map((x) => P.porId("imoveis", x.imovel_id)).filter(Boolean);
  P.quemAgeTexto = (p) => {
    const pes = P.porId("pessoas", p.quem_age_pessoa_id);
    const extra = pes?.nome || p.quem_age_texto;
    return (P.R.quemAge[p.quem_age] || p.quem_age) + (extra ? ` — ${extra}` : "");
  };
  P.linhaProjeto = (proj) => proj ? `${P.selo(proj.codigo || "")}${esc(proj.titulo)}` : "";

  let soMeus = P.lerLocal("skl_proc_hoje_meus") === "1";

  function render(el) {
    const D = P.dados; const h = P.hojeISO(); const sem = P.somarDias(h, 7); const eu = P.estado.usuario.id;
    const ativos = new Set((D.projetos || []).filter((p) => p.situacao === "ativo").map((p) => p.id));
    const meu = (uid) => !soMeus || uid === eu;
    const pend = (D.pendencias || []).filter((p) => p.situacao === "aberta" && ativos.has(p.projeto_id));
    const atrasadas = pend.filter((p) => !p.conferir_em || p.conferir_em < h || (p.prazo && p.prazo < h));
    const lista = pend.filter((p) => meu(p.acompanha_id) && (!p.conferir_em || p.conferir_em <= sem || (p.prazo && p.prazo <= sem)))
      .sort((a, b) => (a.conferir_em || "0") .localeCompare(b.conferir_em || "0"));
    const protAtivos = new Map((D.protocolos || []).map((p) => [ p.id, p ]));
    const exig = (D.exigencias || []).filter((x) => x.situacao === "aberta").sort((a, b) => (a.prazo || "9").localeCompare(b.prazo || "9"));
    const comp = (D.compromissos || []).filter((c) => c.situacao === "agendado" && c.inicio.slice(0, 10) >= h && c.inicio.slice(0, 10) <= sem && meu(c.responsavel_id))
      .sort((a, b) => a.inicio.localeCompare(b.inicio));
    const vencendo = (D.servicos || []).filter((s) => s.vence_em && P.diasAte(s.vence_em) <= 90).sort((a, b) => a.vence_em.localeCompare(b.vence_em));
    const parados = (D.projetos || []).filter((p) => p.situacao === "ativo" && meu(p.responsavel_id))
      .map((p) => ({ p, dias: P.diasParado(p.id) })).filter((x) => x.dias >= P.limiteParado()).sort((a, b) => b.dias - a.dias);
    const vencido = (D.recebiveis || []).filter((r) => r.situacao === "aberto" && r.vencimento && r.vencimento < h).reduce((s, r) => s + Number(r.valor || 0), 0);
    const servAnd = (D.servicos || []).filter((s) => ativos.has(s.projeto_id) && [ "em_andamento", "aguardando" ].includes(s.situacao)).length;

    const itemPend = (p) => {
      const q = P.quando(p.conferir_em || p.prazo); const proj = P.porId("projetos", p.projeto_id); const sv = P.porId("servicos", p.servico_id);
      return `<li data-projeto="${p.projeto_id}" data-aba="pendencias" class="clicavel"><div><div class="titulo">${esc(p.descricao)}</div>
        <div class="sub">${P.linhaProjeto(proj)}${sv ? " · " + esc(sv.titulo) : ""}</div>
        <div class="sub">Quem age: <strong>${esc(P.quemAgeTexto(p))}</strong> · Acompanha: ${esc(P.nomeUsuario(p.acompanha_id))}</div></div>
        <div class="quando ${q.atrasado ? "atrasado" : q.hoje ? "hoje" : ""}">${p.conferir_em ? "conferir " : p.prazo ? "prazo " : ""}${esc(q.txt)}${p.prazo && p.conferir_em ? `<br><small>prazo ${esc(P.dataBR(p.prazo))}</small>` : ""}</div></li>`;
    };
    const itemExig = (x) => {
      const q = P.quando(x.prazo); const pr = protAtivos.get(x.protocolo_id); const sv = P.porId("servicos", pr?.servico_id); const proj = P.porId("projetos", sv?.projeto_id);
      return `<li data-projeto="${proj?.id || ""}" data-aba="protocolos" class="clicavel"><div><div class="titulo">${esc(x.descricao)}</div>
        <div class="sub">${P.linhaProjeto(proj)} · ${esc(pr?.orgao_nome || P.R.orgao[pr?.orgao] || "")} · protocolo ${esc(pr?.numero || "—")}</div></div>
        <div class="quando ${q.atrasado ? "atrasado" : ""}">prazo ${esc(q.txt)}</div></li>`;
    };
    const itemComp = (c) => {
      const d = new Date(c.inicio); const proj = P.porId("projetos", c.projeto_id);
      return `<li data-projeto="${c.projeto_id || ""}" class="${c.projeto_id ? "clicavel" : ""}"><div><div class="titulo">${esc(c.titulo)}</div>
        <div class="sub">${P.selo(P.R.tipoComp[c.tipo] || c.tipo)}${proj ? P.linhaProjeto(proj) + " · " : ""}${esc(c.local || "")} · ${esc(P.nomeUsuario(c.responsavel_id))}</div></div>
        <div class="quando">${esc(d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }))} ${esc(d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))}</div></li>`;
    };
    const itemVence = (s) => {
      const proj = P.porId("projetos", s.projeto_id); const d = P.diasAte(s.vence_em);
      return `<li data-projeto="${s.projeto_id}" class="clicavel"><div><div class="titulo">${esc(s.documento_emitido || s.titulo)}</div>
        <div class="sub">${P.linhaProjeto(proj)} · ${esc(s.titulo)}</div></div>
        <div class="quando ${d < 60 ? "atrasado" : ""}">${d < 0 ? "venceu em " : "vence em "}${esc(P.dataBR(s.vence_em))}<br><small>${d < 0 ? `há ${-d} dias` : `faltam ${d} dias`}</small></div></li>`;
    };
    const itemParado = ({ p, dias }) => `<li data-projeto="${p.id}" class="clicavel"><div><div class="titulo">${P.linhaProjeto(p)}</div>
        <div class="sub">Responsável: ${esc(P.nomeUsuario(p.responsavel_id))} · cliente ${esc(P.clienteDe(p)?.nome || "—")}</div></div>
        <div class="quando atrasado">sem movimento há ${dias} dias</div></li>`;
    const bloco = (titulo, itens, fn, vazio) => `<div class="cartao"><h2>${titulo} ${itens.length ? `<span class="contador">${itens.length}</span>` : ""}</h2>
      ${itens.length ? `<ul class="lista-itens">${itens.map(fn).join("")}</ul>` : P.vazio(vazio)}</div>`;

    el.innerHTML = `
      <div class="barra-filtros"><label class="check"><input type="checkbox" id="hojeMeus" ${soMeus ? "checked" : ""}> Só o que eu acompanho</label>
        ${P.pode("editar_processos") ? `<span class="espaco"></span><button type="button" class="botao-principal" id="hojeNovo">+ Novo processo</button>` : ""}</div>
      <div class="numeros">
        <div class="numero"><span>Projetos ativos</span><strong>${ativos.size}</strong></div>
        <div class="numero"><span>Serviços em andamento</span><strong>${servAnd}</strong></div>
        <div class="numero ${atrasadas.length ? "alerta" : ""}"><span>Pendências · atrasadas ou sem data</span><strong>${pend.length} · ${atrasadas.length}</strong></div>
        <div class="numero ${exig.length ? "alerta" : ""}"><span>Exigências em aberto</span><strong>${exig.length}</strong></div>
        ${P.pode("ver_financeiro") ? `<div class="numero ${vencido ? "alerta" : ""}"><span>A receber vencido</span><strong>${esc(P.moeda(vencido))}</strong></div>` : ""}
      </div>
      ${bloco("Precisa de atenção (próximos 7 dias)", lista, itemPend, "Nada para conferir nos próximos 7 dias.")}
      ${bloco("Exigências em aberto", exig, itemExig, "Nenhuma exigência aberta.")}
      ${bloco("Agenda dos próximos 7 dias", comp, itemComp, "Nenhum compromisso agendado.")}
      ${vencendo.length ? bloco("Licenças e documentos vencendo (90 dias)", vencendo, itemVence, "") : ""}
      ${bloco(`Processos parados (${P.limiteParado()} dias ou mais sem movimento)`, parados, itemParado, "Nenhum processo parado.")}`;
    el.querySelector("#hojeMeus").onchange = (e) => { soMeus = e.target.checked; P.gravarLocal("skl_proc_hoje_meus", soMeus ? "1" : ""); render(el); };
    el.querySelector("#hojeNovo")?.addEventListener("click", () => P.novoProjeto());
    el.onclick = (e) => { const li = e.target.closest("[data-projeto]"); if (li?.dataset.projeto) P.abrirProjeto(li.dataset.projeto, li.dataset.aba); };
  }
  P.pagina("hoje", { titulo: "Hoje", render });
})();

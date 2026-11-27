// SKL Processos — Financeiro do escritório: resumo, a receber, custas e reembolsos, notas emitidas.
(() => {
  "use strict";
  const P = window.SKLProc; const { esc } = P;
  let aba = "resumo"; const filtro = { rec: "aberto", custas: "acobrar", busca: "" };
  P.abrirFinanceiro = (rec) => { aba = "receber"; filtro.rec = rec || "aberto"; filtro.busca = ""; P.ir("financeiro"); };
  const nomeProj = (id) => { const p = P.porId("projetos", id); return p ? `${p.codigo} · ${p.titulo}` : "—"; };
  const soma = (arr, f) => arr.reduce((s, x) => s + Number(f(x) || 0), 0);

  function resumo() {
    const D = P.dados; const h = P.hojeISO(); const mes = h.slice(0, 7); const ano = h.slice(0, 4);
    const rec = D.recebiveis || [];
    const aberto = rec.filter((r) => r.situacao === "aberto");
    const vencido = aberto.filter((r) => r.vencimento && r.vencimento < h);
    const prox30 = aberto.filter((r) => r.vencimento && r.vencimento >= h && r.vencimento <= P.somarDias(h, 30));
    const recebidos = rec.filter((r) => r.situacao === "recebido");
    const recMes = soma(recebidos.filter((r) => (r.recebido_em || "").startsWith(mes)), (r) => r.valor_recebido ?? r.valor);
    const recAno = soma(recebidos.filter((r) => (r.recebido_em || "").startsWith(ano)), (r) => r.valor_recebido ?? r.valor);
    const aCobrar = (D.custas || []).filter((c) => c.pago_por === "escritorio" && c.reembolsavel && !c.reembolsado_em);
    const meses = []; for (let i = 5; i >= 0; i--) { const d = new Date(h + "T12:00:00"); d.setDate(1); d.setMonth(d.getMonth() - i); meses.push(d.toISOString().slice(0, 7)); }
    const porMes = meses.map((m) => ({ m, v: soma(recebidos.filter((r) => (r.recebido_em || "").startsWith(m)), (r) => r.valor_recebido ?? r.valor) }));
    const max = Math.max(1, ...porMes.map((x) => x.v));
    return `<div class="numeros">
        <div class="numero"><span>A receber (total)</span><strong>${esc(P.moeda(soma(aberto, (r) => r.valor)))}</strong></div>
        <div class="numero ${vencido.length ? "alerta" : ""}"><span>Vencido · ${vencido.length} parcela(s)</span><strong>${esc(P.moeda(soma(vencido, (r) => r.valor)))}</strong></div>
        <div class="numero"><span>Vence em 30 dias</span><strong>${esc(P.moeda(soma(prox30, (r) => r.valor)))}</strong></div>
        <div class="numero"><span>Recebido no mês</span><strong>${esc(P.moeda(recMes))}</strong></div>
        <div class="numero"><span>Recebido no ano</span><strong>${esc(P.moeda(recAno))}</strong></div>
        <div class="numero ${aCobrar.length ? "alerta" : ""}"><span>Custas a cobrar do cliente</span><strong>${esc(P.moeda(soma(aCobrar, (c) => c.valor)))}</strong></div>
      </div>
      <div class="cartao"><h3>Recebido nos últimos 6 meses</h3><div class="barras">${porMes.map((x) => `<div class="barra-col"><div class="barra" data-altura="${Math.round(100 * x.v / max)}" title="${esc(P.moeda(x.v))}"></div><small>${esc(x.m.slice(5) + "/" + x.m.slice(2, 4))}</small><small>${esc(P.moeda(x.v).replace(/,\d\d$/, ""))}</small></div>`).join("")}</div></div>
      <div class="cartao"><h3>Vencidas</h3>${vencido.length ? `<ul class="lista-itens">${vencido.sort((a, b) => a.vencimento.localeCompare(b.vencimento)).map((r) => `<li class="clicavel" data-proc="${r.projeto_id}"><div><div class="titulo">${esc(r.descricao)} · ${esc(P.moeda(r.valor))}</div><div class="sub">${esc(nomeProj(r.projeto_id))} · ${esc(P.clienteDe(P.porId("projetos", r.projeto_id))?.nome || "")}</div></div><div class="quando atrasado">${esc(P.quando(r.vencimento).txt)}${r.programado_para ? `<br><small>prometido ${esc(P.dataBR(r.programado_para))}</small>` : ""}</div></li>`).join("")}</ul>` : P.vazio("Nada vencido.")}</div>`;
  }
  function aReceber() {
    const hoje = P.hojeISO();
    const lista = (P.dados.recebiveis || []).filter((r) => (filtro.rec === "todos" || (filtro.rec === "vencidas" ? r.situacao === "aberto" && r.vencimento && r.vencimento < hoje : r.situacao === filtro.rec)) && P.contem(`${r.descricao} ${nomeProj(r.projeto_id)} ${P.clienteDe(P.porId("projetos", r.projeto_id))?.nome || ""}`, filtro.busca))
      .sort((a, b) => (filtro.rec === "recebido" ? (b.recebido_em || "").localeCompare(a.recebido_em || "") : (a.vencimento || "9").localeCompare(b.vencimento || "9")));
    const gerir = P.pode("gerir_financeiro");
    return `<div class="barra-filtros"><input type="search" id="finBusca" placeholder="Processo, cliente, descrição…" value="${esc(filtro.busca)}">
      <select id="finRec"><option value="aberto" ${filtro.rec === "aberto" ? "selected" : ""}>A receber</option><option value="vencidas" ${filtro.rec === "vencidas" ? "selected" : ""}>Só as vencidas</option><option value="recebido" ${filtro.rec === "recebido" ? "selected" : ""}>Recebidas</option><option value="todos" ${filtro.rec === "todos" ? "selected" : ""}>Todas</option></select>
      <span class="espaco"></span><strong>Total: ${esc(P.moeda(soma(lista, (r) => r.situacao === "recebido" ? (r.valor_recebido ?? r.valor) : r.valor)))}</strong>
      ${gerir ? `<button type="button" class="botao-principal" data-a="novaParcela">+ Parcela</button>` : ""}</div>
      <div class="cartao"><div class="tabela-rol"><table class="tabela"><thead><tr><th>Processo / cliente</th><th>Descrição</th><th>Vencimento</th><th>Valor</th><th>Situação</th><th></th></tr></thead><tbody>
      ${lista.map((r) => `<tr><td><a href="#" data-a="proc" data-id="${r.projeto_id}">${esc(nomeProj(r.projeto_id))}</a><br><small>${esc(P.clienteDe(P.porId("projetos", r.projeto_id))?.nome || "")}</small></td>
        <td>${esc(r.descricao)}</td><td class="${r.situacao === "aberto" && r.vencimento && r.vencimento < P.hojeISO() ? "txt-alerta" : ""}">${esc(P.dataBR(r.vencimento))}</td><td>${esc(P.moeda(r.valor))}</td>
        <td>${r.situacao === "recebido" ? `Recebido ${esc(P.dataBR(r.recebido_em))}` : esc(r.situacao === "aberto" ? "A receber" : "Cancelado")}</td>
        <td>${gerir ? `${r.situacao === "aberto" ? `<button type="button" class="botao pequeno" data-a="baixar" data-id="${r.id}">✓ Recebi</button> ` : ""}<button type="button" class="link-botao" data-a="editarParcela" data-id="${r.id}">editar</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="6">${P.vazio("Nada aqui.")}</td></tr>`}
      </tbody></table></div></div>`;
  }
  function custas() {
    const lista = (P.dados.custas || []).filter((c) => {
      if (filtro.custas === "acobrar" && !(c.pago_por === "escritorio" && c.reembolsavel && !c.reembolsado_em)) return false;
      return P.contem(`${c.descricao} ${nomeProj(c.projeto_id)}`, filtro.busca);
    }).sort((a, b) => (b.pago_em || "").localeCompare(a.pago_em || ""));
    const pode = P.pode("lancar_custas");
    return `<div class="barra-filtros"><input type="search" id="finBusca" placeholder="Processo, descrição…" value="${esc(filtro.busca)}">
      <select id="finCustas"><option value="acobrar" ${filtro.custas === "acobrar" ? "selected" : ""}>A cobrar do cliente</option><option value="todas" ${filtro.custas === "todas" ? "selected" : ""}>Todas</option></select>
      <span class="espaco"></span><strong>Total: ${esc(P.moeda(soma(lista, (c) => c.valor)))}</strong>
      ${pode ? `<button type="button" class="botao-principal" data-a="novaCusta">+ Custa</button>` : ""}</div>
      <div class="cartao"><div class="tabela-rol"><table class="tabela"><thead><tr><th>Processo</th><th>Descrição</th><th>Valor</th><th>Pago por</th><th>Reembolso</th><th></th></tr></thead><tbody>
      ${lista.map((c) => `<tr><td><a href="#" data-a="proc" data-id="${c.projeto_id}">${esc(nomeProj(c.projeto_id))}</a></td><td>${esc(c.descricao)}<br><small>${esc(P.R.tipoCusta[c.tipo])} · ${esc(P.dataBR(c.pago_em))}</small></td>
        <td>${esc(P.moeda(c.valor))}</td><td>${c.pago_por === "cliente" ? "Cliente" : "Escritório"}</td>
        <td>${c.pago_por === "escritorio" && c.reembolsavel ? (c.reembolsado_em ? "✓ " + esc(P.dataBR(c.reembolsado_em)) : `<span class="txt-alerta">a cobrar</span>`) : "—"}</td>
        <td>${pode ? `${c.pago_por === "escritorio" && c.reembolsavel && !c.reembolsado_em ? `<button type="button" class="botao pequeno" data-a="reembolsado" data-id="${c.id}">✓ Reembolsado</button> ` : ""}<button type="button" class="link-botao" data-a="editarCusta" data-id="${c.id}">editar</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="6">${P.vazio("Nada aqui.")}</td></tr>`}
      </tbody></table></div></div>`;
  }
  function notas() {
    const lista = (P.dados.notas || []).filter((n) => P.contem(`${n.numero} ${nomeProj(n.projeto_id)} ${P.porId("pessoas", n.cliente_id)?.nome || ""}`, filtro.busca))
      .sort((a, b) => (b.emitida_em || "").localeCompare(a.emitida_em || ""));
    const gerir = P.pode("gerir_financeiro");
    return `<div class="barra-filtros"><input type="search" id="finBusca" placeholder="Número, processo, tomador…" value="${esc(filtro.busca)}"><span class="espaco"></span>
      <strong>Total emitido: ${esc(P.moeda(soma(lista.filter((n) => n.situacao === "emitida"), (n) => n.valor)))}</strong>
      ${gerir ? `<button type="button" class="botao-principal" data-a="novaNota">+ Nota</button>` : ""}</div>
      <div class="cartao"><p class="ajuda">Registro das notas já emitidas (no sistema da prefeitura ou pelo contador). O SKL Processos não emite nota.</p>
      <div class="tabela-rol"><table class="tabela"><thead><tr><th>Nº</th><th>Emitida</th><th>Tomador</th><th>Processo</th><th>Valor</th><th></th></tr></thead><tbody>
      ${lista.map((n) => `<tr class="${n.situacao === "cancelada" ? "feito" : ""}"><td>${esc(n.numero)}${n.serie ? "/" + esc(n.serie) : ""}${n.situacao === "cancelada" ? "<br><small>cancelada</small>" : ""}</td><td>${esc(P.dataBR(n.emitida_em))}</td>
        <td>${esc(P.porId("pessoas", n.cliente_id)?.nome || "—")}</td><td>${n.projeto_id ? `<a href="#" data-a="proc" data-id="${n.projeto_id}">${esc(nomeProj(n.projeto_id))}</a>` : "—"}</td>
        <td>${esc(P.moeda(n.valor))}</td><td>${gerir ? `<button type="button" class="link-botao" data-a="editarNota" data-id="${n.id}">editar</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="6">${P.vazio("Nenhuma nota.")}</td></tr>`}
      </tbody></table></div></div>`;
  }

  function render(el) {
    const ver = P.pode("ver_financeiro");
    const abas = [ ...(ver ? [ [ "resumo", "Resumo" ], [ "receber", "A receber" ] ] : []), [ "custas", "Custas e reembolsos" ], ...(ver ? [ [ "notas", "Notas emitidas" ] ] : []) ];
    if (!abas.some(([ k ]) => k === aba)) aba = abas[0][0];
    const corpo = { resumo, receber: aReceber, custas, notas }[aba]();
    el.innerHTML = `<div class="abas">${abas.map(([ k, t ]) => `<button type="button" data-aba="${k}" class="${k === aba ? "ativo" : ""}">${t}</button>`).join("")}</div>${corpo}`;
    const b = el.querySelector("#finBusca");
    if (b) b.oninput = (e) => { filtro.busca = e.target.value; const pos = e.target.selectionStart; render(el); const n = el.querySelector("#finBusca"); n.focus(); n.setSelectionRange(pos, pos); };
    el.querySelector("#finRec")?.addEventListener("change", (e) => { filtro.rec = e.target.value; render(el); });
    el.querySelector("#finCustas")?.addEventListener("change", (e) => { filtro.custas = e.target.value; render(el); });
    el.onclick = async (e) => {
      const t = e.target.closest("[data-aba]"); if (t) { aba = t.dataset.aba; render(el); return; }
      const pr = e.target.closest("[data-proc]"); if (pr) { P.abrirProjeto(pr.dataset.proc, "financeiro"); return; }
      const bt = e.target.closest("[data-a]"); if (!bt) return;
      if (bt.tagName === "A") e.preventDefault();
      const id = bt.dataset.id;
      try {
        switch (bt.dataset.a) {
          case "proc": return P.abrirProjeto(id, "financeiro");
          case "novaParcela": return P.formRecebivel(null);
          case "editarParcela": return P.formRecebivel(P.porId("recebiveis", id).projeto_id, P.porId("recebiveis", id));
          case "baixar": return P.formBaixa(P.porId("recebiveis", id));
          case "novaCusta": return P.formCusta(null);
          case "editarCusta": return P.formCusta(null, P.porId("custas", id));
          case "reembolsado": { const c = P.porId("custas", id); await P.salvar("custas", { id: c.id, version: c.version, reembolsado_em: P.hojeISO() }); return P.redesenhar(); }
          case "novaNota": return P.formNota(null);
          case "editarNota": return P.formNota(null, P.porId("notas", id));
        }
      } catch (err) { P.toast(P.msgErro(err)); }
    };
  }
  P.pagina("financeiro", { titulo: "Financeiro", render });
})();

// SKL Processos — busca única (botão do topo e Ctrl+K): processo, pessoa, imóvel, matrícula, protocolo.
(() => {
  "use strict";
  const P = window.SKLProc; const { esc } = P;
  const ROT = { projeto: "Processo", pessoa: "Pessoa", imovel: "Imóvel", matricula: "Matrícula", protocolo: "Protocolo" };
  let d = null; let timer = null; let seq = 0;

  function abrirResultado(r) {
    d?.close();
    if (r.tipo === "projeto") P.abrirProjeto(r.id);
    else if (r.tipo === "pessoa") P.abrirPessoa(r.id);
    else if (r.tipo === "imovel") P.abrirImovel(r.id);
    else if (r.tipo === "matricula") { const m = P.porId("matriculas", r.id); if (m?.imovel_id) P.abrirImovel(m.imovel_id); else P.toast("Matrícula sem imóvel cadastrado."); }
    else if (r.tipo === "protocolo" && r.projeto_id) P.abrirProjeto(r.projeto_id, "protocolos");
  }
  async function buscar(txt, lista) {
    const meu = ++seq;
    if (txt.trim().length < 2) { lista.innerHTML = `<li class="vazio">Digite pelo menos 2 letras: nome da fazenda, do proprietário, número da matrícula ou do protocolo…</li>`; return; }
    const { data, error } = await P.sb.rpc("proc_buscar", { p_escritorio: P.estado.escritorio.id, p_texto: txt });
    if (meu !== seq) return;
    if (error) { lista.innerHTML = `<li class="vazio">${esc(P.msgErro(error))}</li>`; return; }
    // processos ligados: imóvel e pessoa trazem também os processos deles
    const extra = [];
    for (const r of data || []) {
      if (r.tipo === "imovel") (P.dados.projeto_imoveis || []).filter((x) => x.imovel_id === r.id).forEach((x) => { const p = P.porId("projetos", x.projeto_id); if (p) extra.push({ tipo: "projeto", id: p.id, titulo: `${p.codigo} · ${p.titulo}`, subtitulo: "processo do imóvel " + r.titulo }); });
      if (r.tipo === "pessoa") (P.dados.projetos || []).filter((p) => p.cliente_id === r.id).forEach((p) => extra.push({ tipo: "projeto", id: p.id, titulo: `${p.codigo} · ${p.titulo}`, subtitulo: "processo de " + r.titulo }));
    }
    const vistos = new Set(); const todos = [ ...(data || []), ...extra ].filter((r) => { const k = r.tipo + r.id; if (vistos.has(k)) return false; vistos.add(k); return true; });
    lista.innerHTML = todos.map((r, i) => `<li><button type="button" data-i="${i}" class="resultado"><span class="selo">${esc(ROT[r.tipo] || r.tipo)}</span><strong>${esc(r.titulo)}</strong><small>${esc(r.subtitulo || "")}</small></button></li>`).join("")
      || `<li class="vazio">Nada encontrado para "${esc(txt)}".</li>`;
    lista.onclick = (e) => { const b = e.target.closest("[data-i]"); if (b) abrirResultado(todos[Number(b.dataset.i)]); };
  }
  P.abrirBusca = () => {
    if (!P.estado.escritorio) return;
    d?.remove();
    d = document.createElement("dialog"); d.className = "busca-dialog";
    d.innerHTML = `<div class="busca-corpo"><input type="search" id="buscaTexto" placeholder="Fazenda, proprietário, matrícula, protocolo, CPF…" autocomplete="off">
      <ul id="buscaLista" class="busca-lista"></ul><p class="ajuda">Enter abre o primeiro · Esc fecha</p></div>`;
    document.body.appendChild(d);
    const inp = d.querySelector("#buscaTexto"); const lista = d.querySelector("#buscaLista");
    inp.oninput = () => { clearTimeout(timer); timer = setTimeout(() => buscar(inp.value, lista), 250); };
    inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); lista.querySelector("[data-i]")?.click(); } };
    d.addEventListener("close", () => d.remove());
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    d.showModal(); buscar("", lista); inp.focus();
  };
  P.$("buscaBotao").addEventListener("click", P.abrirBusca);
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); P.abrirBusca(); }
  });
})();

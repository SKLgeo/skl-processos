// SKL Processos — Configurações: este computador, escritório, equipe, modelos de etapas e contas.
(() => {
  "use strict";
  const P = window.SKLProc; const { esc } = P;
  let aba = "computador";

  function computador() {
    const desk = P.NO_PC;
    return `<div class="cartao"><h3>Pasta raiz deste computador</h3>
      <p class="ajuda">É a pasta onde ficam as pastas dos processos (por exemplo <code>G:\\Meu Drive\\PROCESSOS</code> ou <code>\\\\SERVIDOR\\Processos</code>).
      Cada processo guarda só o nome da pasta dele; o programa junta com esta pasta raiz para abrir. Cada computador configura a sua.
      O sistema não guarda nem lê seus arquivos: só abre a pasta no Explorer.</p>
      ${desk ? `<div class="linha"><input id="pastaRaiz" type="text" placeholder="Ex.: G:\\Meu Drive\\PROCESSOS" spellcheck="false" value="${esc(P.pastaRaiz())}">
        <button type="button" class="botao" data-a="escolher">Escolher…</button><button type="button" class="botao-principal" data-a="salvarPasta">Salvar</button>
        <button type="button" class="botao" data-a="testarPasta">Abrir</button></div>`
      : `<p class="aviso">Abrir pastas só funciona no programa instalado no computador. Pelo navegador ou celular, o caminho da pasta aparece só para consulta.</p>`}
    </div>
    <div class="cartao"><h3>Sobre</h3><p class="ajuda">Sistema de gestão de processos v${P.APP_VERSION} · suporte SKL Soluções Digitais · contato@sklgeosolucoes.com.br · (66) 99273-7646</p>
      ${P.LINK ? `<p class="ajuda">Acesso pela internet (celular ou outro computador): <a href="${esc(P.LINK)}" target="_blank" rel="noopener">${esc(P.LINK)}</a></p>` : ""}</div>`;
  }
  function escritorio() {
    const e = P.estado.escritorio; const pode = P.pode("configurar");
    return `<div class="cartao"><h3>Dados do escritório</h3>
      <div class="ficha-info"><div><span>Nome</span>${esc(e.nome)}</div><div><span>CNPJ</span>${esc(e.cnpj || "—")}</div><div><span>Cidade</span>${esc([ e.cidade, e.uf ].filter(Boolean).join("/") || "—")}</div>
      <div><span>Processo parado depois de</span>${P.limiteParado()} dias sem movimento</div></div>
      ${pode ? `<div class="acoes"><button type="button" class="botao" data-a="editarEsc">Editar</button></div>` : ""}</div>`;
  }
  function equipe() {
    const pode = P.pode("configurar"); const eu = P.estado.usuario.id;
    return `<div class="cartao"><div class="cartao-cab"><h3>Equipe (${P.estado.equipe.length})</h3>${pode ? `<button type="button" class="botao-principal" data-a="novoMembro">+ Criar acesso</button>` : ""}</div>
      <p class="ajuda"><strong>Administrador</strong>: tudo. <strong>Técnico</strong>: processos, imóveis, pessoas, agenda e custas (sem o financeiro). <strong>Financeiro</strong>: financeiro e custas; vê os processos sem alterar. <strong>Consulta</strong>: só vê.</p>
      <div class="tabela-rol"><table class="tabela"><thead><tr><th>Nome</th><th>E-mail</th><th>Acesso</th><th>Situação</th><th></th></tr></thead><tbody>
      ${P.estado.equipe.map((u) => `<tr class="${u.ativo ? "" : "feito"}"><td>${esc(u.nome)}${u.usuario_id === eu ? " <small>(você)</small>" : ""}</td><td>${esc(u.email)}</td><td>${esc(P.R.papel[u.papel])}</td><td>${u.ativo ? "Ativo" : "Sem acesso"}</td>
        <td>${pode ? `<button type="button" class="link-botao" data-a="editarMembro" data-id="${u.usuario_id}">editar</button>${u.usuario_id !== eu ? ` <button type="button" class="link-botao" data-a="senhaMembro" data-id="${u.usuario_id}">nova senha</button>` : ""}` : ""}</td></tr>`).join("")}
      </tbody></table></div></div>`;
  }
  function modelos() {
    const pode = P.pode("configurar");
    const grupos = { agrimensura: "Agrimensura", ambiental: "Ambiental", outro: "Outros" };
    return `<div class="cartao"><div class="cartao-cab"><h3>Modelos de etapas</h3>${pode ? `<button type="button" class="botao-principal" data-a="novoModelo">+ Modelo</button>` : ""}</div>
      <p class="ajuda">Quando um serviço é aberto, as etapas do modelo são <strong>copiadas</strong> para ele. Mudar o modelo depois não mexe nos serviços que já estão em andamento. Desative os modelos que o escritório não usa (ex.: escritório só ambiental).</p>
      ${Object.entries(grupos).map(([ g, t ]) => { const ms = (P.dados.modelos || []).filter((m) => m.area === g).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        return ms.length ? `<h4>${t}</h4><ul class="lista-itens">${ms.map((m) => `<li class="${m.ativo ? "" : "feito"}"><div><div class="titulo">${esc(m.nome)}${m.ativo ? "" : " (desativado)"}</div>
          <div class="sub">${(m.etapas || []).map((e) => esc(e.nome)).join(" → ")}</div></div>
          <div class="quando">${pode ? `<button type="button" class="link-botao" data-a="editarModelo" data-id="${m.id}">editar</button>` : ""}</div></li>`).join("")}</ul>` : ""; }).join("")}</div>`;
  }
  function contas() {
    const pode = P.pode("gerir_financeiro");
    return `<div class="cartao"><div class="cartao-cab"><h3>Contas (onde o dinheiro entra)</h3>${pode ? `<button type="button" class="botao-principal" data-a="novaConta">+ Conta</button>` : ""}</div>
      <ul class="lista-itens">${(P.dados.contas || []).map((c) => `<li class="${c.ativo ? "" : "feito"}"><div><div class="titulo">${esc(c.nome)}</div><div class="sub">${esc({ banco: "Banco", caixa: "Caixa", outro: "Outro" }[c.tipo])}${c.ativo ? "" : " · desativada"}</div></div>
        <div class="quando">${pode ? `<button type="button" class="link-botao" data-a="editarConta" data-id="${c.id}">editar</button>` : ""}</div></li>`).join("") || `<li>${P.vazio("Nenhuma conta.")}</li>`}</ul></div>`;
  }

  const textoEtapas = (etapas) => (etapas || []).map((e) => `${e.nome}${(e.checklist || []).length ? ": " + e.checklist.join("; ") : ""}`).join("\n");
  const lerEtapas = (txt) => String(txt || "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf(":"); if (i < 0) return { nome: l, checklist: [] };
    return { nome: l.slice(0, i).trim(), checklist: l.slice(i + 1).split(";").map((x) => x.trim()).filter(Boolean) };
  });
  const formModelo = (m) => P.form({
    titulo: m ? `Modelo: ${m.nome}` : "Novo modelo de etapas", campos: [
      { id: "nome", rotulo: "Nome", obrig: true },
      { id: "area", rotulo: "Área", tipo: "select", opcoes: [ [ "agrimensura", "Agrimensura" ], [ "ambiental", "Ambiental" ], [ "outro", "Outro" ] ], vazio: false },
      { id: "tipo", rotulo: "Tipo de serviço", tipo: "select", opcoes: P.opcoes(P.R.tipoServico), vazio: false },
      { id: "ativo", rotulo: "Uso", tipo: "checkbox", texto: "Modelo ativo (aparece ao abrir serviço)" },
      { id: "descricao", rotulo: "Descrição", largura: "inteira" },
      { id: "etapas_txt", rotulo: "Etapas — uma por linha. Checklist depois de \":\" separado por \";\"", tipo: "textarea", linhas: 12, obrig: true },
    ],
    valores: m ? { ...m, etapas_txt: textoEtapas(m.etapas) } : { area: "agrimensura", tipo: "outro", ativo: true, etapas_txt: "Documentos: Documentos do cliente; Contrato assinado\nCampo: Campo agendado; Levantamento feito\nPeças técnicas: Planta; Memorial; ART/TRT\nProtocolo\nEntrega ao cliente" },
    aoSalvar: (v) => { const { etapas_txt, ...d } = v; return P.salvar("modelos", { ...d, etapas: lerEtapas(etapas_txt), id: m?.id, version: m?.version }); },
  }).then(() => P.redesenhar());

  async function acao(a, id) {
    const E = P.estado.escritorio.id;
    switch (a) {
      case "escolher": { const p = await window.sklDesktop?.escolherPasta(P.$("pastaRaiz").value); if (p) P.$("pastaRaiz").value = p; return; }
      case "salvarPasta": {
        const v = P.$("pastaRaiz").value.trim();
        if (v && !P.ehAbsoluto(v)) { P.toast("Informe o caminho completo (ex.: G:\\Meu Drive\\PROCESSOS)."); return; }
        if (v && !(await window.sklDesktop.pastaExiste(v)).ok) { P.toast("Essa pasta não existe neste computador."); return; }
        P.definirPastaRaiz(v); P.toast(v ? "Pasta raiz salva neste computador." : "Pasta raiz removida."); return;
      }
      case "testarPasta": { const v = P.$("pastaRaiz").value.trim(); const r = await window.sklDesktop.abrirPasta(v); if (!r.ok) P.toast("Pasta não encontrada."); return; }
      case "editarEsc": {
        const e = P.estado.escritorio;
        return P.form({ titulo: "Dados do escritório", campos: [
          { id: "nome", rotulo: "Nome", obrig: true }, { id: "cnpj", rotulo: "CNPJ" }, { id: "cidade", rotulo: "Cidade" }, { id: "uf", rotulo: "UF" },
          { id: "dias_parado", rotulo: "Avisar processo parado depois de (dias)", tipo: "number", passo: "1" } ],
          valores: { ...e, dias_parado: P.limiteParado() },
          aoSalvar: async (v) => {
            const { data, error } = await P.sb.rpc("proc_configurar_escritorio", { p_escritorio: E, p_dados: { nome: v.nome, cnpj: v.cnpj, cidade: v.cidade, uf: v.uf, config: { dias_parado: v.dias_parado || 15 } } });
            if (error) throw new Error(P.msgErro(error));
            Object.assign(P.estado.escritorio, data); P.$("nomeEscritorio").textContent = data.nome;
          } }).then(() => P.redesenhar());
      }
      case "novoMembro": return P.form({ titulo: "Criar acesso", subtitulo: "Se o e-mail já tiver conta (de outro sistema), ela é aproveitada e a pessoa entra com a senha que já usa.", campos: [
        { id: "nome", rotulo: "Nome", obrig: true }, { id: "email", rotulo: "E-mail", tipo: "email", obrig: true },
        { id: "papel", rotulo: "Tipo de acesso", tipo: "select", opcoes: P.opcoes(P.R.papel), vazio: false },
        { id: "senha", rotulo: "Senha inicial (mín. 6)", ajuda: "Combine com a pessoa trocar depois em \"Esqueci minha senha\"." } ],
        valores: { papel: "tecnico" }, salvarTexto: "Criar acesso",
        aoSalvar: async (v) => {
          const { data, error } = await P.sb.functions.invoke("proc-equipe", { body: { acao: "criar_acesso", escritorio_id: E, ...v } });
          const erro = data?.erro || (error && (await error.context?.json?.().catch(() => null))?.erro) || error?.message;
          if (erro) throw new Error(P.msgErro(erro));
          await P.recarregarEquipe(); P.toast(data.ja_existia ? "Conta já existia: vinculada ao escritório (a senha dela não mudou)." : "Acesso criado.", 6000);
        } }).then(() => P.redesenhar());
      case "editarMembro": {
        const u = P.estado.equipe.find((x) => x.usuario_id === id);
        return P.form({ titulo: `Editar ${u.nome}`, campos: [
          { id: "apelido", rotulo: "Nome que aparece no sistema" }, { id: "celular", rotulo: "Celular", tipo: "tel" },
          ...(id !== P.estado.usuario.id ? [ { id: "papel", rotulo: "Tipo de acesso", tipo: "select", opcoes: P.opcoes(P.R.papel), vazio: false },
            { id: "ativo", rotulo: "Acesso", tipo: "checkbox", texto: "Pode entrar no escritório" } ] : []) ],
          valores: { ...u, apelido: u.apelido || u.nome },
          aoSalvar: async (v) => {
            const { error } = await P.sb.rpc("proc_equipe_alterar", { p_escritorio: E, p_usuario: id, p_dados: v });
            if (error) throw new Error(P.msgErro(error));
            await P.recarregarEquipe();
          } }).then(() => P.redesenhar());
      }
      case "senhaMembro": {
        const u = P.estado.equipe.find((x) => x.usuario_id === id);
        return P.form({ titulo: `Nova senha para ${u.nome}`, campos: [ { id: "senha", rotulo: "Nova senha (mín. 6)", obrig: true } ], salvarTexto: "Trocar senha",
          aoSalvar: async (v) => {
            const { data, error } = await P.sb.functions.invoke("proc-equipe", { body: { acao: "redefinir_senha", escritorio_id: E, usuario_id: id, senha: v.senha } });
            const erro = data?.erro || (error && (await error.context?.json?.().catch(() => null))?.erro) || error?.message;
            if (erro) throw new Error(P.msgErro(erro));
            P.toast("Senha trocada.");
          } });
      }
      case "novoModelo": return formModelo();
      case "editarModelo": return formModelo(P.porId("modelos", id));
      case "novaConta": case "editarConta": {
        const c = id && P.porId("contas", id);
        return P.form({ titulo: c ? "Editar conta" : "Nova conta", campos: [ { id: "nome", rotulo: "Nome", obrig: true, placeholder: "Ex.: Banco do Brasil — conta PJ" },
          { id: "tipo", rotulo: "Tipo", tipo: "select", opcoes: [ [ "banco", "Banco" ], [ "caixa", "Caixa" ], [ "outro", "Outro" ] ], vazio: false },
          { id: "ativo", rotulo: "Uso", tipo: "checkbox", texto: "Conta ativa" } ], valores: c || { tipo: "banco", ativo: true },
          aoSalvar: (v) => P.salvar("contas", { ...v, id: c?.id, version: c?.version }) }).then(() => P.redesenhar());
      }
    }
  }

  function render(el, param) {
    if (param?.aba) { aba = param.aba; P.estado.param = null; }
    const abas = [ [ "computador", "Este computador" ], [ "avisos", "Avisos" ], [ "escritorio", "Escritório" ], [ "equipe", "Equipe" ], [ "modelos", "Modelos de etapas" ],
      ...(P.pode("ver_financeiro") ? [ [ "contas", "Contas" ] ] : []) ];
    if (!abas.some(([ k ]) => k === aba)) aba = "computador";
    el.innerHTML = `<div class="abas">${abas.map(([ k, t ]) => `<button type="button" data-aba="${k}" class="${k === aba ? "ativo" : ""}">${t}</button>`).join("")}</div>
      <div id="cfgCorpo">${aba === "avisos" ? "" : { computador, escritorio, equipe, modelos, contas }[aba]()}</div>`;
    if (aba === "avisos") { P.renderConfigAvisos(el.querySelector("#cfgCorpo")); }
    el.onclick = async (e) => {
      const t = e.target.closest("[data-aba]"); if (t) { aba = t.dataset.aba; render(el); return; }
      if (aba === "avisos") return; // a aba Avisos trata os próprios cliques
      const b = e.target.closest("[data-a]"); if (!b) return;
      try { await acao(b.dataset.a, b.dataset.id); } catch (err) { P.toast(P.msgErro(err)); }
    };
  }
  P.pagina("config", { titulo: "Configurações", render });
})();

// SKL Processos — avisos: alerta no celular por item (o usuário escolhe quando), sino dentro do programa,
// e o e-mail do dia (por setor; individual se a SKL liberar). Ver supabase/migrations/skl_processos_avisos.sql.
(() => {
  "use strict";
  const P = window.SKLProc; const { esc } = P;

  // ---------- opções de "quando avisar" por tipo de data ----------
  P.AVISO_OPCOES = {
    dia: [ [ "dia", "No dia" ], [ "1d", "1 dia antes" ], [ "3d", "3 dias antes" ], [ "7d", "7 dias antes" ] ],
    hora: [ [ "na_hora", "Na hora" ], [ "15m", "15 min antes" ], [ "1h", "1 h antes" ], [ "1d", "1 dia antes" ] ],
    vence: [ [ "120d", "120 dias antes" ], [ "90d", "90 dias antes" ], [ "60d", "60 dias antes" ], [ "30d", "30 dias antes" ], [ "7d", "7 dias antes" ] ],
  };
  const PADRAO = { dia: [ "dia" ], hora: [ "1h" ], vence: [ "90d", "30d", "7d" ] };
  const MINUTOS = { na_hora: 0, "15m": 15, "1h": 60 };

  P.campoAvisos = (tipo, rotulo) => ({
    id: "_avisos", tipo: "avisos", rotulo: rotulo || "Avisar no celular", opcoes: P.AVISO_OPCOES[tipo], comHora: tipo !== "hora",
    ajuda: tipo === "hora" ? "Alerta no aparelho de quem é responsável." : "Alerta no aparelho de quem é responsável, no horário escolhido.",
  });

  const minhasPref = () => P.estado.equipe.find((u) => u.usuario_id === P.estado.usuario?.id)?.avisos || P.estado.avisosPref || {};

  // valor inicial do campo: o que já está agendado para o item (ou o padrão da pessoa, se o item é novo)
  P.avisosIniciais = async (tabela, registroId, tipo) => {
    if (registroId) {
      const { data } = await P.sb.from("proc_avisos_agendados").select("chave, quando").eq("tabela", tabela).eq("registro_id", registroId).is("enviado_em", null);
      if (data?.length) {
        const q = new Date(data[0].quando);
        return { chaves: [ ...new Set(data.map((a) => a.chave)) ], hora: `${String(q.getHours()).padStart(2, "0")}:${String(q.getMinutes()).padStart(2, "0")}` };
      }
      return { chaves: [], hora: "08:00" };
    }
    const pref = P.estado.avisosPref || {};
    return { chaves: pref.celular_padrao === false ? [] : PADRAO[tipo].slice(), hora: "08:00" };
  };

  // grava os avisos de um item. base = 'AAAA-MM-DD' (dia/vence) ou data-hora ISO (hora)
  P.salvarAvisos = async ({ tabela, registroId, tipo, base, valor, usuarioId, titulo, corpo }) => {
    if (!registroId || !valor) return;
    const lista = [];
    if (base && usuarioId) {
      for (const chave of valor.chaves || []) {
        let d;
        if (tipo === "hora") {
          d = new Date(base);
          if (chave === "1d") d.setDate(d.getDate() - 1); else d.setMinutes(d.getMinutes() - (MINUTOS[chave] || 0));
        } else {
          d = new Date(`${String(base).slice(0, 10)}T${valor.hora || "08:00"}:00`);
          const dias = chave === "dia" ? 0 : parseInt(chave, 10) || 0;
          d.setDate(d.getDate() - dias);
        }
        if (d > new Date()) lista.push({ chave, quando: d.toISOString(), usuario_id: usuarioId, titulo, corpo });
      }
    }
    const { error } = await P.sb.rpc("proc_definir_avisos", { p_tabela: tabela, p_registro: registroId, p_avisos: lista });
    if (error) throw new Error(P.msgErro(error));
    return lista.length;
  };

  // ---------- sino ----------
  let avisos = []; let canal = null;
  async function carregarSino() {
    if (!P.estado.escritorio) return;
    const { data } = await P.sb.from("proc_avisos").select("*").eq("escritorio_id", P.estado.escritorio.id).eq("usuario_id", P.estado.usuario.id)
      .order("created_at", { ascending: false }).limit(40);
    avisos = data || [];
    const n = avisos.filter((a) => !a.lida_em).length;
    const c = P.$("sinoConta"); c.textContent = n > 99 ? "99+" : String(n); c.hidden = !n;
  }
  function abrirSino() {
    const d = document.createElement("dialog"); d.className = "form-dialog sino-dialog";
    d.innerHTML = `<div class="form-corpo"><header><h2>🔔 Avisos</h2></header>
      <div class="sino-lista">${avisos.length ? `<ul class="lista-itens">${avisos.map((a) => `<li class="clicavel ${a.lida_em ? "feito" : ""}" data-aviso="${a.id}">
        <div><div class="titulo">${esc(a.titulo)}</div>${a.corpo ? `<div class="sub">${esc(a.corpo)}</div>` : ""}</div>
        <div class="quando">${esc(P.dataHoraBR(a.created_at))}</div></li>`).join("")}</ul>` : P.vazio("Nenhum aviso ainda.")}</div>
      <footer><button type="button" class="link-botao" data-s="config">Configurar avisos</button><span class="espaco"></span>
        <button type="button" class="botao" data-s="lidas">Marcar todas como lidas</button><button type="button" class="botao-principal" data-s="fechar">Fechar</button></footer></div>`;
    document.body.appendChild(d);
    d.addEventListener("close", () => d.remove());
    d.addEventListener("click", async (e) => {
      if (e.target === d) { d.close(); return; }
      const s = e.target.closest("[data-s]")?.dataset.s;
      if (s === "fechar") d.close();
      if (s === "config") { d.close(); P.ir("config", { aba: "avisos" }); }
      if (s === "lidas") { await P.sb.rpc("proc_avisos_lidos", { p_escritorio: P.estado.escritorio.id, p_ids: null }); await carregarSino(); d.close(); }
      const li = e.target.closest("[data-aviso]");
      if (li) {
        const a = avisos.find((x) => x.id === li.dataset.aviso);
        await P.sb.rpc("proc_avisos_lidos", { p_escritorio: P.estado.escritorio.id, p_ids: [ a.id ] });
        d.close(); carregarSino();
        if (a.projeto_id && P.porId("projetos", a.projeto_id)) P.abrirProjeto(a.projeto_id);
      }
    });
    d.showModal();
  }
  P.$("sinoBotao").addEventListener("click", abrirSino);

  // ---------- alerta neste aparelho ----------
  const temSW = () => "serviceWorker" in navigator && location.protocol === "https:";
  const b64 = (s) => { const t = s.replace(/-/g, "+").replace(/_/g, "/"); const bin = atob(t + "===".slice((t.length + 3) % 4)); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); };
  let registro = null;
  async function prepararSW() {
    if (!temSW()) return null;
    try { registro = await navigator.serviceWorker.register("sw.js", { scope: "./" }); } catch { registro = null; }
    return registro;
  }
  P.situacaoAparelho = async () => {
    if (P.NO_PC) return { modo: "programa", permissao: typeof Notification !== "undefined" ? Notification.permission : "denied" };
    if (!temSW() || !("PushManager" in window)) return { modo: "sem_suporte" };
    const reg = registro || await prepararSW();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return { modo: "navegador", permissao: Notification.permission, inscrito: !!sub };
  };
  P.ativarAvisosAparelho = async () => {
    if (typeof Notification === "undefined") throw new Error("Este aparelho não aceita avisos.");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("Os avisos foram bloqueados. Libere em Configurações do navegador → Notificações deste site.");
    if (P.NO_PC) return "programa";
    const reg = registro || await prepararSW();
    if (!reg) throw new Error("Este navegador não aceita avisos. No iPhone, adicione o link à tela de início e abra por lá.");
    await navigator.serviceWorker.ready;
    const { data: sit } = await P.sb.rpc("proc_push_situacao");
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(sit.chave_publica) });
    const j = sub.toJSON();
    const { error } = await P.sb.rpc("proc_push_inscrever", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_aparelho: navigator.userAgent.slice(0, 120) });
    if (error) throw new Error(P.msgErro(error));
    return "navegador";
  };
  P.desativarAvisosAparelho = async () => {
    const reg = registro || await prepararSW();
    const sub = reg && await reg.pushManager.getSubscription();
    if (sub) { await P.sb.rpc("proc_push_cancelar", { p_endpoint: sub.endpoint }); await sub.unsubscribe(); }
  };

  // ao entrar: sino, preferências e tempo real dos avisos
  document.addEventListener("skl-proc-entrou", async () => {
    const { data } = await P.sb.from("proc_escritorio_usuarios").select("avisos").eq("escritorio_id", P.estado.escritorio.id).eq("usuario_id", P.estado.usuario.id).maybeSingle();
    P.estado.avisosPref = data?.avisos || {};
    prepararSW();
    await carregarSino();
    if (canal) P.sb.removeChannel(canal);
    canal = P.sb.channel("proc-avisos-" + P.estado.usuario.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "proc_avisos", filter: `usuario_id=eq.${P.estado.usuario.id}` }, (m) => {
        carregarSino();
        const a = m.new || {};
        P.toast("🔔 " + (a.titulo || "Novo aviso"), 6000);
        // no programa do Windows (sem service worker) o alerta sai daqui, com o programa aberto
        if (P.NO_PC && typeof Notification !== "undefined" && Notification.permission === "granted") {
          const n = new Notification(a.titulo || P.marcaAtual?.nome || "Aviso", { body: a.corpo || "", icon: P.marcaAtual?.logo || "icone.png" });
          n.onclick = () => { window.focus(); if (a.projeto_id) P.abrirProjeto(a.projeto_id); };
        }
      }).subscribe();
  });
  document.addEventListener("skl-proc-saiu", () => { if (canal) { P.sb.removeChannel(canal); canal = null; } avisos = []; P.$("sinoConta").hidden = true; });

  // ---------- Configurações → Avisos ----------
  P.renderConfigAvisos = async (el) => {
    const E = P.estado.escritorio; const pode = P.pode("configurar");
    const pref = P.estado.avisosPref || {};
    const indivLiberado = !!E.funcoes?.resumo_individual;
    el.innerHTML = P.vazio("Carregando…");
    const [ sit, setoresR, membrosR, prev, emails ] = await Promise.all([
      P.situacaoAparelho(),
      P.sb.from("proc_setores").select("*").eq("escritorio_id", E.id).order("nome"),
      P.sb.from("proc_setor_membros").select("setor_id, usuario_id"),
      pode ? P.sb.functions.invoke("proc-avisos", { body: { acao: "previa", escritorio_id: E.id } }) : Promise.resolve({ data: null }),
      pode ? P.sb.rpc("proc_emails_situacao", { p_escritorio: E.id }) : Promise.resolve({ data: null }),
    ]);
    const setores = setoresR.data || []; const membros = membrosR.data || [];
    const previa = prev.data; const emailLigado = !!previa?.email_ligado;
    const nomeDe = (uid) => P.nomeUsuario(uid);
    const txtAparelho = sit.modo === "programa"
      ? (sit.permissao === "granted" ? "✅ Ligado no programa: o alerta aparece enquanto o programa estiver aberto." : "Desligado neste computador.")
      : sit.modo === "sem_suporte" ? "Este navegador não aceita alertas. No iPhone, adicione o link à tela de início e abra por lá."
      : sit.inscrito && sit.permissao === "granted" ? "✅ Ligado neste aparelho." : "Desligado neste aparelho.";
    el.innerHTML = `
      <div class="cartao"><h3>📱 Alerta neste aparelho</h3>
        <p class="ajuda">Cada pendência, compromisso, exigência, etapa ou vencimento tem o campo "Avisar no celular": quem cadastra escolhe quando ser avisado.
        Na hora marcada aparece o alerta na tela do aparelho de quem é responsável. Ligue em cada aparelho que você usa (celular, computador).</p>
        <p><strong>${esc(txtAparelho)}</strong></p>
        <div class="acoes">
          ${sit.modo !== "sem_suporte" ? `<button type="button" class="botao-principal" data-c="ativar">Ativar avisos neste aparelho</button>` : ""}
          <button type="button" class="botao" data-c="testar">Enviar um aviso de teste</button>
          ${sit.inscrito ? `<button type="button" class="link-botao" data-c="desativar">Desligar neste aparelho</button>` : ""}
        </div>
        <label class="check"><input type="checkbox" id="avPadrao" ${pref.celular_padrao === false ? "" : "checked"}> Já marcar o aviso nos itens novos que eu cadastrar</label>
      </div>
      <div class="cartao"><h3>✉️ E-mail do dia</h3>
        <p class="ajuda">Todo dia útil às 7h sai um e-mail por <strong>setor</strong>, com o que cada pessoa do setor tem para o dia (pendências, compromissos,
        exigências, etapas e vencimentos; o setor marcado como Financeiro recebe também as parcelas a receber). Setor com e-mail próprio recebe uma vez
        nesse endereço; sem e-mail, cada pessoa do setor recebe o resumo do setor.</p>
        ${indivLiberado ? `<label class="check"><input type="checkbox" id="avIndiv" ${pref.resumo_individual ? "checked" : ""}> Quero receber também o meu resumo individual</label>`
          : `<p class="sub">Resumo individual por pessoa: opcional (fale com a SKL).</p>`}
        ${pode ? `<p class="${emailLigado ? "" : "aviso"}">${emailLigado ? "✅ Envio de e-mail ligado." : "O envio de e-mail ainda não foi ligado pela SKL. A prévia abaixo já mostra o que sairá."}</p>
          <div class="linha"><input type="email" id="avRespEmail" placeholder="E-mail para respostas (ex.: contato@seuescritorio.com.br)" value="${esc(E.config?.email_contato || "")}">
            <button type="button" class="botao" data-c="salvarResp">Salvar</button></div>
          <div class="acoes"><button type="button" class="botao" data-c="previa">Ver o resumo de hoje (${(previa?.envios || []).length})</button>
            ${emailLigado ? `<button type="button" class="botao" data-c="teste">Enviar o resumo de hoje para um e-mail de teste</button>` : ""}</div>
          ${(emails.data?.ultimos || []).length ? `<details><summary>Últimos envios · ${emails.data.mes} neste mês</summary><ul class="lista-itens">${emails.data.ultimos.map((l) => `<li><div><div class="titulo">${esc(l.assunto || "")}</div><div class="sub">${esc(l.para || "")}${l.erro ? " · " + esc(l.erro) : ""}</div></div><div class="quando">${esc(l.status)}<br><small>${esc(P.dataHoraBR(l.created_at))}</small></div></li>`).join("")}</ul></details>` : ""}` : ""}
      </div>
      <div class="cartao"><div class="cartao-cab"><h3>👥 Setores</h3>${pode ? `<button type="button" class="botao-principal" data-c="novoSetor">+ Setor</button>` : ""}</div>
        ${setores.length ? `<ul class="lista-itens">${setores.map((s) => { const ms = membros.filter((m) => m.setor_id === s.id).map((m) => nomeDe(m.usuario_id));
          return `<li class="${s.ativo ? "" : "feito"}"><div><div class="titulo">${esc(s.nome)} ${s.financeiro ? P.selo("Financeiro") : ""}</div>
            <div class="sub">${esc(ms.join(", ") || "sem pessoas")}</div><div class="sub">${s.email ? "E-mail do setor: " + esc(s.email) : "Sem e-mail próprio: cada pessoa recebe o resumo do setor"}</div></div>
            <div class="quando">${pode ? `<button type="button" class="link-botao" data-c="editarSetor" data-id="${s.id}">editar</button>` : ""}</div></li>`; }).join("")}</ul>`
          : P.vazio("Nenhum setor. Crie os setores (ex.: Geo, Ambiental, Financeiro) para o e-mail do dia sair.")}
      </div>`;

    el.querySelector("#avPadrao").onchange = async (e) => { await salvarPref({ celular_padrao: e.target.checked }); };
    el.querySelector("#avIndiv")?.addEventListener("change", async (e) => { await salvarPref({ resumo_individual: e.target.checked }); });
    el.onclick = async (e) => {
      const b = e.target.closest("[data-c]"); if (!b) return;
      const c = b.dataset.c;
      try {
        if (c === "ativar") { await P.ativarAvisosAparelho(); P.toast("Avisos ligados neste aparelho."); return P.renderConfigAvisos(el); }
        if (c === "desativar") { await P.desativarAvisosAparelho(); P.toast("Desligado neste aparelho."); return P.renderConfigAvisos(el); }
        if (c === "testar") { const { error } = await P.sb.rpc("proc_aviso_teste", { p_escritorio: E.id }); if (error) throw error; P.toast("Aviso de teste agendado: chega em até 1 minuto.", 6000); return; }
        if (c === "salvarResp") {
          const v = el.querySelector("#avRespEmail").value.trim();
          if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { P.toast("E-mail inválido."); return; }
          const { data, error } = await P.sb.rpc("proc_configurar_escritorio", { p_escritorio: E.id, p_dados: { config: { email_contato: v } } });
          if (error) throw error; Object.assign(P.estado.escritorio, data); P.toast("Salvo."); return;
        }
        if (c === "previa") return mostrarPrevia(previa?.envios || []);
        if (c === "teste") {
          const r = await P.form({ titulo: "Enviar o resumo de hoje para teste", campos: [ { id: "email", rotulo: "E-mail", tipo: "email", obrig: true } ],
            valores: { email: P.estado.usuario.email && /\.[a-z]{2,}$/i.test(P.estado.usuario.email) ? P.estado.usuario.email : "" }, salvarTexto: "Enviar",
            aoSalvar: async (v) => {
              const { data, error } = await P.sb.functions.invoke("proc-avisos", { body: { acao: "teste", escritorio_id: E.id, email: v.email } });
              const erro = data?.erro || (error && (await error.context?.json?.().catch(() => null))?.erro) || error?.message;
              if (erro) throw new Error(erro === "EMAIL_DESLIGADO" ? "O envio de e-mail ainda não foi ligado." : erro);
              return data;
            } });
          if (r) P.toast(`${r.enviados} e-mail(s) de teste enviados.`, 6000);
          return P.renderConfigAvisos(el);
        }
        if (c === "novoSetor" || c === "editarSetor") {
          const s = setores.find((x) => x.id === b.dataset.id);
          const r = await P.form({ titulo: s ? `Setor ${s.nome}` : "Novo setor", campos: [
            { id: "nome", rotulo: "Nome do setor", obrig: true, placeholder: "Ex.: Geo, Ambiental, Financeiro" },
            { id: "email", rotulo: "E-mail do setor (opcional)", tipo: "email", ajuda: "Se tiver (ex.: geo@escritorio.com.br), o resumo vai uma vez só para ele." },
            { id: "financeiro", rotulo: "Financeiro", tipo: "checkbox", texto: "Recebe também as parcelas a receber do escritório" },
            { id: "ativo", rotulo: "Situação", tipo: "checkbox", texto: "Setor ativo (recebe o e-mail do dia)" },
            { id: "membros", rotulo: "Pessoas do setor", tipo: "checks", largura: "inteira", opcoes: () => P.estado.equipe.filter((u) => u.ativo).map((u) => [ u.usuario_id, u.nome ]) },
          ], valores: s ? { ...s, membros: membros.filter((m) => m.setor_id === s.id).map((m) => m.usuario_id) } : { ativo: true, membros: [] },
          aoSalvar: async (v) => { const { data, error } = await P.sb.rpc("proc_setor_salvar", { p_escritorio: E.id, p_dados: { ...v, id: s?.id } }); if (error) throw new Error(P.msgErro(error)); return data; },
          aoExcluir: s ? async () => { const { error } = await P.sb.rpc("proc_setor_excluir", { p_id: s.id }); if (error) throw new Error(P.msgErro(error)); } : null,
          excluirTexto: "Excluir setor" });
          if (r) P.renderConfigAvisos(el);
        }
      } catch (err) { P.toast(P.msgErro(err), 7000); }
    };
  };
  async function salvarPref(dados) {
    const { data, error } = await P.sb.rpc("proc_meus_avisos", { p_escritorio: P.estado.escritorio.id, p_dados: dados });
    if (error) { P.toast(P.msgErro(error)); return; }
    P.estado.avisosPref = data || {}; P.toast("Preferência salva.");
  }
  function mostrarPrevia(envios) {
    const d = document.createElement("dialog"); d.className = "form-dialog";
    d.innerHTML = `<div class="form-corpo"><header><h2>Resumo de hoje (prévia)</h2><p class="ajuda">É isto que cada setor recebe por e-mail às 7h.</p></header>
      <div class="sino-lista">${envios.length ? envios.map((e) => `<div class="previa-email"><h3>${esc(e.nome_destino)} — ${e.total} itens${e.atrasados ? `, ${e.atrasados} atrasados` : ""}</h3>
        <p class="sub">Para: ${esc((e.para || []).join(", ") || "ninguém com e-mail válido no setor")}</p>
        ${(e.secoes || []).map((s) => `<h4>${esc(s.titulo)}</h4><ul class="lista-itens">${(s.itens || []).map((i) => `<li><div><div class="titulo">${P.selo(i.tipo + (i.atrasado ? " · atrasado" : ""), i.atrasado ? "alerta" : "")}${i.hora ? `<strong>${esc(i.hora)}</strong> ` : ""}${esc(i.texto)}</div><div class="sub">${esc(i.processo || "")}</div></div></li>`).join("")}</ul>`).join("")}</div>`).join("")
        : P.vazio("Nada para hoje.")}</div>
      <footer><span class="espaco"></span><button type="button" class="botao-principal" data-f="fechar">Fechar</button></footer></div>`;
    document.body.appendChild(d);
    d.addEventListener("close", () => d.remove());
    d.querySelector('[data-f="fechar"]').onclick = () => d.close();
    d.showModal();
  }
})();

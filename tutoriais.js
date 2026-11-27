// SKL Processos — Tutoriais (passo a passo de cada tela).
(() => {
  "use strict";
  const P = window.SKLProc; const { esc } = P;
  const T = [
    { t: "Primeiro: o programa só funciona se for alimentado", p: [
      "O sistema é uma ferramenta de gestão e acompanhamento. Ele não faz o processo andar sozinho: mostra o que precisa ser feito, por quem e quando.",
      "Regra de ouro: toda vez que algo acontecer (protocolou, voltou exigência, cliente mandou documento, confrontante assinou), registre no processo. Leva segundos.",
      "O programa não guarda arquivos. Plantas, DWG, matrículas e memoriais continuam nas pastas do seu computador; aqui fica onde cada coisa está.",
    ] },
    { t: "Hoje", p: [
      "É a primeira tela. Mostra o que precisa de atenção nos próximos 7 dias, as exigências abertas, a agenda, licenças vencendo e os processos parados.",
      "Cada pendência mostra QUEM PRECISA AGIR (cliente, cartório, órgão, confrontante…) e QUEM ACOMPANHA no escritório.",
      "Marque \"Só o que eu acompanho\" para ver só as suas. Toque em um item para abrir o processo.",
    ] },
    { t: "Abrir um processo novo", p: [
      "Processos → + Novo processo. Escreva o título, escolha o cliente e o imóvel (ou cadastre na hora pelas opções \"+ Cadastrar…\").",
      "Escolha o modelo do primeiro serviço (ex.: Georreferenciamento rural, CAR, PRAD). As etapas do modelo são copiadas para o serviço e você pode ajustar.",
      "O código (ano-número) é automático. Em \"Pasta do processo\" escreva o nome da pasta onde ficam os arquivos dele.",
      "Um processo pode ter vários serviços (ex.: georreferenciamento + desmembramento + CAR): use \"+ Serviço\" na ficha.",
    ] },
    { t: "Ficha do processo", p: [
      "Serviços e etapas: mude a situação de cada etapa e marque o checklist. Etapa que não faz parte do contrato vira \"Não se aplica\".",
      "Pendências: o que falta, quem age, quem acompanha e quando conferir de novo. \"✓ Resolver\" fecha; \"Adiar\" muda a data de conferir e pode anotar o motivo.",
      "Protocolos e exigências: cada protocolo (cartório, SIGEF, INTERMAT, prefeitura, órgão ambiental) com número, data, validade e as exigências que voltaram.",
      "Confrontantes e assinaturas: quem precisa assinar e a situação (pendente, assinou, recusou, notificar pelo cartório).",
      "Documentos: versões de planta, memorial, ART… Versão protocolada fica travada: para mudar, crie \"nova versão\".",
      "Histórico: tudo que mudou fica registrado sozinho (quem, quando, o quê). Use \"Anotar\" para ligações e conversas.",
    ] },
    { t: "Pasta do processo", p: [
      "Configurações → Este computador → Pasta raiz: escolha a pasta onde ficam as pastas dos processos (ex.: G:\\Meu Drive\\PROCESSOS).",
      "Na ficha, o botão 📁 Pasta do processo abre a pasta no Explorer. Cada computador configura a sua pasta raiz uma vez.",
      "Pelo celular ou navegador o botão não abre pastas (o celular não enxerga o seu computador); o caminho aparece só para consulta.",
    ] },
    { t: "Imóveis e matrículas", p: [
      "Imóveis guardam o que é permanente: matrículas, proprietários, CCIR/CAR/SIGEF (rural) ou inscrição, quadra e lote (urbano).",
      "Origem e destino das áreas: registre de qual matrícula saiu cada área (desmembramento), quais se juntaram (remembramento/unificação) ou a retificação. Sem matrícula nova ainda? Deixe em branco e escreva o nome da área (Área 01, Remanescente).",
      "Quando o cliente voltar anos depois, a ficha do imóvel mostra todos os processos e o histórico.",
    ] },
    { t: "Agenda", p: [
      "Junta compromissos (campo, cartório, reunião) com tudo que tem data: conferir pendência, prazos, exigências, etapas, vencimentos de licença e parcelas.",
      "Itens atrasados aparecem no topo. \"+ Compromisso\" agenda campo ou visita.",
    ] },
    { t: "Financeiro", p: [
      "Parcelas a receber por marco do serviço (entrada, entrega da planta, certificação). \"✓ Recebi\" registra a data, o valor e a conta.",
      "Custas: o que foi pago no processo (prenotação, ART, taxa do órgão, deslocamento). Se o escritório adiantou e vai cobrar do cliente, fica \"a cobrar\" até marcar \"✓ Reembolsado\".",
      "Notas emitidas: só o registro (número, data, valor). A nota continua sendo emitida no sistema da prefeitura ou pelo contador.",
    ] },
    { t: "Busca", p: [ "O campo de busca no topo (ou Ctrl+K) acha processo, imóvel, pessoa, matrícula e protocolo. Ignora acento e aceita erro de digitação." ] },
    { t: "Equipe e acessos", p: [
      "Configurações → Equipe → + Criar acesso. Preencha nome, e-mail, tipo de acesso e uma senha inicial.",
      "Use o e-mail de verdade da pessoa: é com ele que ela entra e é para ele que vai o e-mail do dia (quando o setor não tem e-mail próprio).",
      "Tipos: Administrador (tudo), Técnico (processos, sem financeiro), Financeiro (financeiro e custas), Consulta (só vê).",
      "Quem esquecer a senha usa \"Esqueci minha senha\" na tela de entrada. O administrador também pode usar \"nova senha\" na lista da equipe.",
      "Tudo que um computador altera aparece nos outros na hora (bolinha verde no topo = conectado).",
    ] },
    { t: "Marca do escritório (nome, logo e cores)", p: [
      "Configurações → Escritório → Marca do escritório. Só o administrador altera.",
      "Escreva o nome que deve aparecer, toque em \"Escolher logo\" (PNG com fundo transparente fica melhor) e escolha a cor principal e a cor de destaque. O quadro ao lado mostra como vai ficar.",
      "Toque em \"Salvar marca\". O nome, a logo e as cores passam a aparecer na tela de todos, no e-mail do dia e nos alertas do celular. Quem estiver com o sistema aberto vê a marca nova ao entrar de novo.",
      "Prefira uma cor principal escura: o texto do menu e dos botões é branco.",
    ] },
    { t: "Avisos no celular", p: [
      "Ligue os avisos em cada aparelho que você usa: Configurações → Avisos → \"Ativar avisos neste aparelho\" e permita as notificações. Depois toque em \"Enviar um aviso de teste\": em até 1 minuto o alerta aparece.",
      "No iPhone, primeiro adicione o link à tela de início (Safari → Compartilhar → Adicionar à Tela de Início) e abra o sistema por esse ícone.",
      "Ao cadastrar uma pendência, compromisso, exigência, etapa, parcela ou vencimento de licença, use o campo \"Avisar no celular\" para escolher quando ser avisado e o horário.",
      "O alerta vai para quem é responsável pelo item. Os avisos também ficam no sino 🔔 do topo.",
      "Item resolvido ou cancelado não avisa mais. O aviso de vencimento de licença continua valendo mesmo com o serviço concluído.",
    ] },
    { t: "E-mail do dia e setores", p: [
      "Todo dia útil às 7h sai um e-mail por setor com o que cada pessoa tem para o dia: pendências, compromissos, exigências, etapas e vencimentos.",
      "Configurações → Avisos → Setores → + Setor. Dê o nome (ex.: Geo, Ambiental, Financeiro) e marque as pessoas do setor.",
      "Setor com e-mail próprio (ex.: geo@seuescritorio.com.br) recebe uma vez só nesse endereço. Sem e-mail próprio, cada pessoa do setor recebe o resumo no e-mail com que entra no sistema.",
      "Marque \"Financeiro\" no setor que deve receber também as parcelas a receber.",
      "Em \"E-mail para respostas\" coloque o e-mail do escritório: quem responder o resumo fala com ele.",
      "\"Ver o resumo de hoje\" mostra o que vai sair. \"Enviar o resumo de hoje para um e-mail de teste\" manda para o e-mail que você escolher.",
      "Se o primeiro e-mail cair no spam, marque \"Não é spam\" e adicione o remetente aos contatos.",
    ] },
  ];
  function render(el) {
    el.innerHTML = `<div class="cartao"><p class="ajuda">Passo a passo rápido de cada parte do sistema. Suporte: contato@sklgeosolucoes.com.br · (66) 99273-7646.</p></div>
      ${T.map((x, i) => `<details class="cartao tutorial" ${i === 0 ? "open" : ""}><summary>${esc(x.t)}</summary><ol>${x.p.map((l) => `<li>${esc(l)}</li>`).join("")}</ol></details>`).join("")}`;
  }
  P.pagina("tutoriais", { titulo: "Tutoriais", render });
})();

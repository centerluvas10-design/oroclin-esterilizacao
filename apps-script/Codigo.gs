/**
 * Oroclin · Controle de esterilização — servidor de dados (Google Apps Script)
 *
 * Grava tudo na planilha à qual este script está vinculado.
 * Cada aba guarda um tipo de registro: cargas, equipamentos, pessoas, kits, config.
 * A coluna "dados_json" é a fonte oficial; as demais colunas existem para leitura humana.
 *
 * Instalação: veja o README do repositório.
 * PIN: Configurações do projeto > Propriedades do script > PIN
 */

const COLECOES = ["cargas", "equipamentos", "pessoas", "kits", "config"];

const CABECALHOS = {
  cargas: ["id", "lote", "data_esterilizacao", "validade", "autoclave", "operador", "situacao",
           "qtd_pacotes", "parametros", "pacote_teste", "pacotes", "atualizado_em", "dados_json"],
  equipamentos: ["id", "nome", "modelo", "serie", "ativo", "atualizado_em", "dados_json"],
  pessoas: ["id", "nome", "funcao", "ativo", "atualizado_em", "dados_json"],
  kits: ["id", "nome", "itens", "embalagem", "ativo", "atualizado_em", "dados_json"],
  config: ["id", "atualizado_em", "dados_json"]
};

const SITUACAO = { preparada: "Aguardando ciclo", liberada: "Liberada", liberada_ib: "Liberada · IB em leitura",
                   reprovada: "Reprovada", cancelada: "Cancelada" };

/* ---------------- instalação ---------------- */

/** Rode UMA vez pelo editor (botão Executar) para criar as abas e os kits iniciais. */
function configurar() {
  COLECOES.forEach(aba);
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("PIN")) props.setProperty("PIN", "trocar-este-pin");
  const kits = aba("kits");
  if (kits.getLastRow() < 2) {
    const agora = new Date().toISOString();
    [
      ["kclin", "Kit clínico", "Espelho, sonda exploradora, pinça clínica"],
      ["kperio", "Kit periodontia / raspagem", "Espelho, sonda milimetrada, curetas Gracey, foices"],
      ["kcir", "Kit cirúrgico", "Cabo de bisturi, descolador, alavancas, fórceps, porta-agulha, tesoura, pinças"],
      ["kdent", "Kit dentística", "Espátulas, calcadores, brunidor, porta-matriz, grampos"],
      ["korto", "Kit ortodontia", "Alicate 139, alicate de corte distal, How, posicionador de braquete, pinça"],
      ["kalta", "Caneta de alta rotação", "Peça de mão de alta rotação"],
      ["kbaixa", "Contra-ângulo / micromotor", "Contra-ângulo e/ou micromotor"],
      ["kbrocas", "Brocas e pontas", "Brocas, pontas diamantadas"]
    ].forEach(function (k) {
      gravar("kits", k[0], { nome: k[1], itens: k[2], embalagem: "Papel grau cirúrgico", ativo: true, criadoEm: agora });
    });
  }
  Logger.log("Pronto. Agora troque o PIN em Propriedades do script e publique como App da Web.");
}

/* ---------------- entrada HTTP ---------------- */

function doGet() {
  return ContentService.createTextOutput("Servidor da Oroclin ativo. Use o sistema pelo link do GitHub Pages.");
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return saida({ erro: "Requisição inválida.", codigo: "invalid_argument" }); }
  const pin = PropertiesService.getScriptProperties().getProperty("PIN");
  if (!pin || String(req.pin || "") !== pin) {
    Utilities.sleep(800); // atrasa tentativas de adivinhar o PIN
    return saida({ erro: "PIN incorreto.", codigo: "pin" });
  }
  try {
    const leitura = { ping: 1, tudo: 1, get: 1, consulta: 1 };
    if (leitura[req.acao]) return saida({ resultado: executar(req) });
    const trava = LockService.getScriptLock();
    trava.waitLock(20000);
    try { return saida({ resultado: executar(req) }); }
    finally { SpreadsheetApp.flush(); trava.releaseLock(); }
  } catch (err) {
    return saida({ erro: String(err && err.message || err), codigo: err && err.codigo || "erro" });
  }
}

function executar(req) {
  switch (req.acao) {
    case "ping": return { ok: true };
    case "tudo": return tudo(req.desde);
    case "get": validarColecao(req.col); return ler(req.col, req.id);
    case "consulta": return consultaCargas(req.de, req.ate);
    case "set": validarColecao(req.col); return gravar(req.col, req.id, req.dados);
    case "update": validarColecao(req.col); return atualizar(req.col, req.id, req.dados);
    case "novaCarga": return novaCarga(req.dados);
    default: throw erro("Ação desconhecida: " + req.acao, "invalid_argument");
  }
}

/* ---------------- operações ---------------- */

/** Cadastros completos + cargas recentes ou ainda em aberto. */
function tudo(desde) {
  const r = {};
  ["equipamentos", "pessoas", "kits"].forEach(function (c) { r[c] = lerTodos(c); });
  const cfg = ler("config", "geral");
  r.config = cfg ? cfg : {};
  const corte = desde || isoDias(-400);
  r.cargas = lerTodos("cargas").filter(function (c) {
    return c.data >= corte || c.status === "preparada" || c.status === "liberada_ib";
  });
  return r;
}

function consultaCargas(de, ate) {
  return lerTodos("cargas").filter(function (c) { return c.data >= de && c.data <= ate; });
}

/** Cria a carga gerando o lote único do dia e os códigos dos pacotes, sob trava. */
function novaCarga(dados) {
  if (!dados || !/^\d{4}-\d{2}-\d{2}$/.test(dados.data)) throw erro("Data inválida.", "invalid_argument");
  const prefixo = "L" + dados.data.replace(/-/g, "") + "-";
  const ids = colunaIds("cargas");
  let seq = 0;
  ids.forEach(function (id) {
    if (String(id).indexOf(prefixo) === 0) seq = Math.max(seq, parseInt(String(id).slice(prefixo.length), 10) || 0);
  });
  const lote = prefixo + ("0" + (seq + 1)).slice(-2);
  dados.lote = lote;
  dados.pacotes = (dados.pacotes || []).map(function (p, i) {
    p.codigo = lote + "-P" + ("0" + (i + 1)).slice(-2);
    return p;
  });
  dados.status = "preparada";
  dados.usos = {};
  dados.criadoEm = new Date().toISOString();
  gravar("cargas", lote, dados);
  return dados;
}

/* ---------------- armazenamento ---------------- */

function aba(col) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(col);
  if (!sh) {
    sh = ss.insertSheet(col);
    sh.getRange(1, 1, 1, CABECALHOS[col].length).setValues([CABECALHOS[col]]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function colunaIds(col) {
  const sh = aba(col);
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, 1).getValues().map(function (r) { return r[0]; });
}

function linhaDe(col, id) {
  const sh = aba(col);
  const n = sh.getLastRow() - 1;
  if (n < 1) return 0;
  const achado = sh.getRange(2, 1, n, 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
  return achado ? achado.getRow() : 0;
}

function ler(col, id) {
  const linha = linhaDe(col, id);
  if (!linha) return null;
  const sh = aba(col);
  const json = sh.getRange(linha, CABECALHOS[col].length).getValue();
  const d = JSON.parse(json || "{}");
  d.id = String(id);
  return d;
}

function lerTodos(col) {
  const sh = aba(col);
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const w = CABECALHOS[col].length;
  return sh.getRange(2, 1, n, w).getValues().map(function (r) {
    const d = JSON.parse(r[w - 1] || "{}");
    d.id = String(r[0]);
    return d;
  });
}

function gravar(col, id, dados) {
  if (!id || !/^[A-Za-z0-9_.\-]{1,80}$/.test(String(id))) throw erro("Identificador inválido.", "invalid_argument");
  const limpo = JSON.parse(JSON.stringify(dados || {}));
  delete limpo.id;
  const json = JSON.stringify(limpo);
  if (json.length > 45000) throw erro("Registro grande demais para uma célula da planilha. Divida a carga.", "quota_exceeded");
  const linhaValores = [String(id)].concat(colunasLegiveis(col, limpo), [new Date().toISOString(), json]);
  const sh = aba(col);
  const linha = linhaDe(col, id);
  if (linha) sh.getRange(linha, 1, 1, linhaValores.length).setValues([linhaValores]);
  else sh.appendRow(linhaValores);
  limpo.id = String(id);
  return limpo;
}

function atualizar(col, id, parcial) {
  const atual = ler(col, id);
  if (!atual) throw erro("Registro não encontrado.", "invalid_argument");
  delete atual.id;
  return gravar(col, id, mesclar(atual, parcial || {}));
}

/** Mescla objetos recursivamente; listas e valores simples são substituídos. */
function mesclar(base, novo) {
  Object.keys(novo).forEach(function (k) {
    const v = novo[k];
    if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) {
      base[k] = mesclar(base[k], v);
    } else {
      base[k] = v;
    }
  });
  return base;
}

function colunasLegiveis(col, d) {
  const ativo = d.ativo === false ? "não" : "sim";
  if (col === "equipamentos") return [d.nome || "", d.modelo || "", d.serie || "", ativo];
  if (col === "pessoas") return [d.nome || "", d.funcao || "", ativo];
  if (col === "kits") return [d.nome || "", d.itens || "", d.embalagem || "", ativo];
  if (col === "config") return [];
  // cargas
  const ci = d.ciclo || {};
  const parametros = ci.temperatura != null ? ci.temperatura + " °C | " + ci.pressao + " " + (ci.pressaoUnid || "") + " | " + ci.tempo + " min" : "";
  const teste = ci.integrador ? "Integrador T" + ci.integrador.tipo + ": " + ci.integrador.resultado +
    (ci.ib && ci.ib.usado ? " | IB: " + ci.ib.resultado + (ci.ib.loteIB ? " (lote " + ci.ib.loteIB + ")" : "") : "") : "";
  const pacotes = (d.pacotes || []).map(function (p) {
    const u = (d.usos || {})[p.codigo];
    return p.codigo + " " + p.kit + (u ? " → " + u.desfecho + (u.paciente ? " (" + u.paciente + ")" : "") : "");
  }).join("\n");
  return [d.lote || "", d.data || "", d.validade || "", d.equipamentoNome || "", d.operadorNome || "",
          SITUACAO[d.status] || d.status || "", (d.pacotes || []).length, parametros, teste, pacotes];
}

/* ---------------- utilidades ---------------- */

function validarColecao(col) {
  if (COLECOES.indexOf(col) < 0) throw erro("Coleção inválida.", "invalid_argument");
}
function erro(msg, codigo) { const e = new Error(msg); e.codigo = codigo; return e; }
function isoDias(n) { const d = new Date(); d.setDate(d.getDate() + n); return Utilities.formatDate(d, "America/Fortaleza", "yyyy-MM-dd"); }
function saida(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

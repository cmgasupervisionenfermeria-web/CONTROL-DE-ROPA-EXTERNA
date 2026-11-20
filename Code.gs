/**
 * Control de Ropa Hospitalaria — CMGA (versión 3: lavandería propia y ropa quirúrgica)
 * Backend Google Apps Script + Google Sheets · Gerencia de Enfermería
 *
 * Hojas que crea automáticamente (un registro por fila: resumen legible + datos completos en JSON):
 *   Ropa sucia, Lavados, Resurtidos, Conteos fisicos, Bajas, Altas, Esterilizaciones, Salidas de bultos
 *   Configuracion -> prendas, servicios, stock autorizado, bultos y parámetros
 * Este mismo proyecto atiende también la app de lavandería externa (peticiones con app=ext), al final del archivo.
 *
 * Para actualizar: Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión → Implementar (conserva la URL)
 */

var HOJAS = {
  sucia: 'Ropa sucia', lavados: 'Lavados', surtidos: 'Resurtidos', conteos: 'Conteos fisicos',
  bajas: 'Bajas', altas: 'Altas', esteril: 'Esterilizaciones', usos: 'Salidas de bultos'
};
var COLECCIONES = Object.keys(HOJAS);
var ENCABEZADO = ['id', 'folio', 'fecha', 'hora', 'ubicación / servicio', 'total', 'resumen', 'datos (JSON)', 'actualizado'];
var HOJA_CONFIG = 'Configuracion';

function doGet(e) {
  if (e && e.parameter && e.parameter.app === 'ext') return EXT_doGet(e);
  var action = (e && e.parameter && e.parameter.action) || 'getAll';
  try {
    if (action === 'getAll') return json_({ ok: true, data: leerTodo_() });
    if (action === 'ping') return json_({ ok: true, version: 3, ts: new Date().toISOString() });
    return json_({ ok: false, error: 'Acción no reconocida: ' + action });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    if (body.app === 'ext') { lock.releaseLock(); return EXT_doPost(e); }
    if (body.action === 'upsert') { upsert_(body.col, body.rec); return json_({ ok: true, id: body.rec.id }); }
    if (body.action === 'delete') { borrar_(body.col, body.id); return json_({ ok: true }); }
    if (body.action === 'saveConfig') { guardarConfig_(body.config); return json_({ ok: true }); }
    return json_({ ok: false, error: 'Acción no reconocida: ' + body.action });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function leerTodo_() {
  var out = { config: leerConfig_() };
  COLECCIONES.forEach(function (col) {
    var sh = hoja_(HOJAS[col]);
    var last = sh.getLastRow(), lista = [];
    if (last > 1) {
      sh.getRange(2, 1, last - 1, ENCABEZADO.length).getValues().forEach(function (r) {
        if (!r[0]) return;
        try { lista.push(JSON.parse(r[7])); } catch (x) { /* fila dañada: se omite */ }
      });
    }
    out[col] = lista;
  });
  return out;
}

function leerConfig_() {
  var sh = hoja_(HOJA_CONFIG);
  if (sh.getLastRow() < 2) return null;
  var v = sh.getRange(2, 2).getValue();
  if (!v) return null;
  try { return JSON.parse(v); } catch (x) { return null; }
}

function upsert_(col, rec) {
  if (!HOJAS[col]) throw new Error('Colección inválida: ' + col);
  if (!rec || !rec.id) throw new Error('Registro sin id');
  var sh = hoja_(HOJAS[col]);
  var fila = [
    rec.id, texto_(rec.folio), texto_(rec.fecha), texto_(rec.hora),
    rec.origen || rec.destino || rec.servicio || rec.ubic || rec.ciclo || rec.sala || '',
    total_(rec.items), resumen_(rec), JSON.stringify(rec),
    texto_(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'))
  ];
  var n = buscarFila_(sh, rec.id);
  if (n) sh.getRange(n, 1, 1, fila.length).setValues([fila]);
  else sh.appendRow(fila);
}

function borrar_(col, id) {
  if (!HOJAS[col]) throw new Error('Colección inválida: ' + col);
  var sh = hoja_(HOJAS[col]);
  var n = buscarFila_(sh, id);
  if (n) sh.deleteRow(n);
}

function guardarConfig_(config) {
  hoja_(HOJA_CONFIG).getRange(2, 1, 1, 3).setValues([[
    'config', JSON.stringify(config),
    texto_(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'))
  ]]);
}

function hoja_(nombre) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    var enc = nombre === HOJA_CONFIG ? ['clave', 'valor (JSON)', 'actualizado'] : ENCABEZADO;
    sh.getRange(1, 1, 1, enc.length).setValues([enc]).setFontWeight('bold').setBackground('#1B3A6B').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  }
  return sh;
}

function buscarFila_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}

function total_(items) {
  var t = 0;
  Object.keys(items || {}).forEach(function (k) {
    var v = items[k];
    t += (v && typeof v === 'object') ? (Number(v.e) || 0) : (Number(v) || 0);
  });
  return t;
}

function resumen_(rec) {
  var it = rec.items || {};
  return Object.keys(it).map(function (k) {
    var v = it[k];
    return k + ': ' + ((v && typeof v === 'object') ? ('había ' + (v.c || 0) + ', entregado ' + (v.e || 0)) : v);
  }).join(' · ');
}

/** Antepone apóstrofo para que Sheets no convierta fechas, horas ni folios. */
function texto_(v) { return v === '' || v === null || v === undefined ? '' : "'" + String(v); }

function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

/** Ejecutar una vez desde el editor para crear todas las hojas de la versión 3. */
function inicializarHojas() {
  COLECCIONES.forEach(function (c) { hoja_(HOJAS[c]); });
  hoja_(HOJA_CONFIG);
}

/* =====================================================================
 * APP DE LAVANDERÍA EXTERNA (repo CONTROL-DE-ROPA-EXTERNA, vigente hasta febrero 2027)
 * Peticiones con app=ext. Usa las hojas Envios, Recepciones, Ajustes, Conteos, Surtidos y Config,
 * y la carpeta de Drive para las fotos de las notas del proveedor.
 * ===================================================================== */

var EXT_COLECCIONES = ['envios', 'recepciones', 'ajustes', 'conteos', 'surtidos'];
var EXT_HOJAS = { envios: 'Envios', recepciones: 'Recepciones', ajustes: 'Ajustes', conteos: 'Conteos', surtidos: 'Surtidos' };
var EXT_ENCABEZADO = ['id', 'folio', 'fecha', 'tipo / servicio', 'total piezas', 'resumen', 'datos (JSON)', 'actualizado'];

function EXT_doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'getAll';
  try {
    if (action === 'getAll') return EXT_json_({ ok: true, data: EXT_leerTodo_() });
    if (action === 'ping') return EXT_json_({ ok: true, ts: new Date().toISOString() });
    return EXT_json_({ ok: false, error: 'Acción no reconocida: ' + action });
  } catch (err) {
    return EXT_json_({ ok: false, error: String(err) });
  }
}

function EXT_doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    if (body.action === 'upsert') {
      var rec = body.rec;
      if (body.foto && body.foto.base64) rec.fotoNota = EXT_guardarFoto_(body.foto, rec);
      else if (rec && rec.fotoNota && rec.fotoNota.pendiente) rec.fotoNota = EXT_fotoExistente_(body.col, rec.id) || rec.fotoNota;
      EXT_upsert_(body.col, rec);
      return EXT_json_({ ok: true, rec: { id: rec.id, fotoNota: rec.fotoNota || null } });
    }
    if (body.action === 'delete') { EXT_borrar_(body.col, body.id); return EXT_json_({ ok: true }); }
    if (body.action === 'saveConfig') { EXT_guardarConfig_(body.config); return EXT_json_({ ok: true }); }
    return EXT_json_({ ok: false, error: 'Acción no reconocida: ' + body.action });
  } catch (err) {
    return EXT_json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- lectura ---------- */

function EXT_leerTodo_() {
  var out = { config: EXT_leerConfig_() };
  EXT_COLECCIONES.forEach(function (col) {
    var sh = EXT_hoja_(EXT_HOJAS[col]);
    var last = sh.getLastRow();
    var lista = [];
    if (last > 1) {
      var vals = sh.getRange(2, 1, last - 1, EXT_ENCABEZADO.length).getValues();
      vals.forEach(function (r) {
        if (!r[0]) return;
        try { lista.push(JSON.parse(r[6])); } catch (x) { /* fila dañada: se omite */ }
      });
    }
    out[col] = lista;
  });
  return out;
}

function EXT_leerConfig_() {
  var sh = EXT_hoja_('Config');
  if (sh.getLastRow() < 2) return null;
  var v = sh.getRange(2, 2).getValue();
  if (!v) return null;
  try { return JSON.parse(v); } catch (x) { return null; }
}

/* ---------- escritura ---------- */

function EXT_upsert_(col, rec) {
  if (EXT_COLECCIONES.indexOf(col) < 0) throw new Error('Colección inválida: ' + col);
  if (!rec || !rec.id) throw new Error('Registro sin id');
  var sh = EXT_hoja_(EXT_HOJAS[col]);
  var fila = [
    rec.id,
    EXT_comoTexto_(rec.folio || ''),
    EXT_comoTexto_(rec.fecha || ''),
    rec.servicioNombre || rec.tipo || '',
    EXT_totalPiezas_(rec),
    rec.resumen || '',
    JSON.stringify(rec),
    EXT_comoTexto_(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'))
  ];
  var n = EXT_buscarFila_(sh, rec.id);
  if (n) sh.getRange(n, 1, 1, fila.length).setValues([fila]);
  else sh.appendRow(fila);
}

function EXT_borrar_(col, id) {
  if (EXT_COLECCIONES.indexOf(col) < 0) throw new Error('Colección inválida: ' + col);
  var sh = EXT_hoja_(EXT_HOJAS[col]);
  var n = EXT_buscarFila_(sh, id);
  if (n) sh.deleteRow(n);
}

function EXT_guardarConfig_(config) {
  var sh = EXT_hoja_('Config');
  sh.getRange(2, 1, 1, 3).setValues([[
    'config',
    JSON.stringify(config),
    EXT_comoTexto_(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'))
  ]]);
}

/* ---------- fotos de notas (Google Drive) ---------- */

function EXT_guardarFoto_(foto, rec) {
  var carpeta = EXT_carpetaFotos_();
  var nombre = (rec.folio || rec.id) + '_' + (foto.nombre || 'nota.jpg');
  var blob = Utilities.newBlob(Utilities.base64Decode(foto.base64), foto.mime || 'image/jpeg', nombre);
  var f = carpeta.createFile(blob);
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { /* política del dominio: queda privada */ }
  return { id: f.getId(), url: f.getUrl(), nombre: nombre };
}

function EXT_fotoExistente_(col, id) {
  var sh = EXT_hoja_(EXT_HOJAS[col]);
  var n = EXT_buscarFila_(sh, id);
  if (!n) return null;
  try { var r = JSON.parse(sh.getRange(n, 7).getValue()); return r.fotoNota && r.fotoNota.id ? r.fotoNota : null; } catch (e) { return null; }
}

function EXT_carpetaFotos_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('CARPETA_FOTOS');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { } }
  var c = DriveApp.createFolder('Control de Ropa CMGA - Fotos de notas');
  props.setProperty('CARPETA_FOTOS', c.getId());
  return c;
}

/** Ejecutar una vez desde el editor para autorizar el acceso a Drive y crear la carpeta de fotos. */
function EXT_autorizarDrive() {
  Logger.log('Carpeta de fotos: ' + EXT_carpetaFotos_().getUrl());
}

/* ---------- utilidades ---------- */

function EXT_hoja_(nombre) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    if (nombre === 'Config') sh.getRange(1, 1, 1, 3).setValues([['clave', 'valor (JSON)', 'actualizado']]);
    else sh.getRange(1, 1, 1, EXT_ENCABEZADO.length).setValues([EXT_ENCABEZADO]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#1B3A6B').setFontColor('#FFFFFF');
  }
  return sh;
}

function EXT_buscarFila_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}

function EXT_totalPiezas_(rec) {
  var t = 0, it = rec.items || {};
  Object.keys(it).forEach(function (k) {
    var v = it[k];
    if (typeof v === 'number') t += v;
    else if (v && typeof v === 'object') Object.keys(v).forEach(function (s) { t += Number(v[s]) || 0; });
  });
  return t;
}

/** Antepone apóstrofo para que Sheets no convierta fechas/folios. */
function EXT_comoTexto_(v) {
  return v === '' || v === null || v === undefined ? '' : "'" + String(v);
}

function EXT_json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Ejecutar una vez desde el editor para crear todas las hojas. */
function EXT_inicializarHojas() {
  ['Envios', 'Recepciones', 'Ajustes', 'Conteos', 'Surtidos', 'Config'].forEach(EXT_hoja_);
}

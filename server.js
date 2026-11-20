// server.js — dcamp playground(사내 배포)용 Node 서버
//
// 배경: 보안 정책으로 Vercel 사용이 금지되어 playground(Dockerfile 기반)로 이전.
//       Vercel이 해 주던 두 가지를 이 파일이 대신한다.
//       1) 정적 파일 제공 (index.html, fund.html, drypowder.html, fonts/ …)
//       2) api/*.js 서버 함수 실행 — 함수 코드는 그대로 두고, Vercel식 req/res
//          (req.query, req.body, res.status().json()/send())만 흉내 낸다.
//
// 공개 허용 목록(STATIC_FILES/fonts)에 없는 파일은 내보내지 않는다 → 소스·package.json 노출 방지.
// 환경변수: GOOGLE_SERVICE_ACCOUNT_JSON, GEMINI_API_KEY (선택: GSA_KEY), PORT(기본 3000)
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;

// 서버 함수 라우트: /api/<이름> → api/<이름>.js
const API = {
  sheet: require('./api/sheet'),
  briefing: require('./api/briefing'),
  funds: require('./api/funds'),
};

// 브라우저에 내보내도 되는 파일만 명시
const STATIC_FILES = new Set([
  'index.html',
  'fund.html',
  'drypowder.html',
  'presentation.html',
  'funds_data.js',
]);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
};
const MAX_BODY = 1024 * 1024; // 1MB — 브리핑 payload는 수십 KB

// Vercel 함수가 기대하는 res 메서드 추가
function decorate(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
  res.send = (data) => {
    if (data !== null && typeof data === 'object' && !Buffer.isBuffer(data)) return res.json(data);
    res.end(data == null ? '' : data);
    return res;
  };
  return res;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleApi(name, req, res, url) {
  const fn = API[name];
  if (!fn) return res.status(404).json({ ok: false, error: 'not found' });
  req.query = Object.fromEntries(url.searchParams);
  if (req.method === 'POST' || req.method === 'PUT') {
    let raw;
    try { raw = await readBody(req); } catch (e) { return res.status(413).json({ ok: false, error: '요청이 너무 큽니다.' }); }
    const type = String(req.headers['content-type'] || '');
    if (type.includes('application/json')) {
      try { req.body = raw ? JSON.parse(raw) : {}; } catch (e) { req.body = raw; }
    } else {
      req.body = raw;
    }
  }
  try {
    await fn(req, res);
  } catch (err) {
    console.error(`[api/${name}]`, err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: '서버 오류' });
  }
  if (!res.writableEnded) res.end();
}

function sendFile(res, rel, extraHeaders) {
  const abs = path.join(ROOT, rel);
  fs.readFile(abs, (err, buf) => {
    if (err) return res.status(404).send('Not found');
    res.setHeader('Content-Type', MIME[path.extname(rel).toLowerCase()] || 'application/octet-stream');
    for (const [k, v] of Object.entries(extraHeaders || {})) res.setHeader(k, v);
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  decorate(res);
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch (e) { return res.status(400).send('Bad request'); }
  let p;
  try { p = decodeURIComponent(url.pathname); } catch (e) { return res.status(400).send('Bad request'); }

  // 헬스체크
  if (p === '/healthz') return res.status(200).send('ok');

  // 서버 함수: /api/sheet, /api/briefing, /api/funds (끝의 / 나 .js 허용)
  const m = p.match(/^\/api\/([a-z]+)(?:\.js)?\/?$/);
  if (m) return handleApi(m[1], req, res, url);

  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).send('Method not allowed');

  if (p === '/' || p === '') return sendFile(res, 'index.html', { 'Cache-Control': 'no-cache' });

  const rel = p.replace(/^\/+/, '');
  if (STATIC_FILES.has(rel)) return sendFile(res, rel, { 'Cache-Control': 'no-cache' });
  // 확장자 없는 주소도 허용 (/fund → fund.html)
  if (STATIC_FILES.has(rel + '.html')) return sendFile(res, rel + '.html', { 'Cache-Control': 'no-cache' });

  // 폰트 (vercel.json의 캐시 헤더 이식)
  const f = rel.match(/^fonts\/([A-Za-z0-9._-]+)$/);
  if (f && /\.(ttf|woff2?)$/i.test(f[1])) {
    return sendFile(res, path.join('fonts', f[1]), {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    });
  }

  res.status(404).send('Not found');
});

server.listen(PORT, () => console.log(`invest-kpi listening on :${PORT}`));

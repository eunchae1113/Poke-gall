// 포케갤 로컬 CORS 프록시 서버
// Qwen / Together / OpenRouter 등 OpenAI 호환 API는
// 브라우저 직접 호출 시 CORS 오류 발생 → 이 서버가 대신 호출합니다.
//
// 실행: node server.js   (Node.js 만 있으면 추가 설치 불필요)
// 기본 포트: 3333
//
// Anthropic(Claude) 키는 프록시 없이 바로 사용 가능합니다.

const http  = require('http');
const https = require('https');
const url   = require('url');

const PORT = 3333;

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST' || req.url !== '/proxy') {
    res.writeHead(404); res.end('Not found'); return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let payload;
    try { payload = JSON.parse(body); } catch(e) { res.writeHead(400); res.end('Bad JSON'); return; }

    const { targetUrl, headers = {}, body: apiBody } = payload;
    if (!targetUrl) { res.writeHead(400); res.end('targetUrl required'); return; }

    const parsed = url.parse(targetUrl);
    const options = {
      hostname: parsed.hostname,
      path:     parsed.path,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', ...headers },
    };

    const apiReq = https.request(options, apiRes => {
      let data = '';
      apiRes.on('data', chunk => { data += chunk; });
      apiRes.on('end', () => {
        res.writeHead(apiRes.statusCode, { 'Content-Type': 'application/json' });
        res.end(data);
      });
    });

    apiReq.on('error', e => {
      res.writeHead(502);
      res.end(JSON.stringify({ error: { message: e.message } }));
    });

    apiReq.write(JSON.stringify(apiBody));
    apiReq.end();
  });
}).listen(PORT, () => {
  console.log(`포케갤 프록시 서버 실행중 → http://localhost:${PORT}`);
  console.log('Qwen 등 OpenAI 호환 API 사용 시 이 서버를 먼저 실행하세요.');
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
const cloudflareHeaders = await readFile(new URL("../_headers", import.meta.url), "utf8");

assert.match(html, /auth\.signInWithPassword/, "o login deve continuar usando o Supabase Auth");
assert.match(html, /navigator\.mediaDevices\.getUserMedia/, "o acesso à câmera deve permanecer disponível");
assert.doesNotMatch(html, /service_role/i, "uma chave service_role nunca pode ir para o navegador");
assert.doesNotMatch(html, /sb_secret_/i, "uma chave secreta do Supabase nunca pode ir para o navegador");
assert.doesNotMatch(html, /face-api\.js@master/, "modelos faciais não podem vir de uma branch mutável");
assert.match(html, /@supabase\/supabase-js@\d+\.\d+\.\d+/, "o SDK do Supabase deve usar versão exata");
assert.doesNotMatch(html, /src=["']http:\/\//i, "scripts externos devem usar HTTPS");

const globalHeaders = config.headers.find(({ source }) => source === "/(.*)")?.headers ?? [];
const header = (name) => globalHeaders.find(({ key }) => key.toLowerCase() === name.toLowerCase())?.value;

assert.equal(header("X-Content-Type-Options"), "nosniff");
assert.equal(header("X-Frame-Options"), "SAMEORIGIN");
assert.match(header("Content-Security-Policy") ?? "", /frame-ancestors 'self'/);
assert.match(header("Permissions-Policy") ?? "", /camera=\(self\)/);

// O arquivo _headers (Cloudflare Pages) precisa espelhar o vercel.json para que
// a troca de hospedagem não perca nenhuma proteção.
// Formato: linha sem indentação = padrão de URL; linhas indentadas = "Nome: valor".
function parseCloudflareHeaders(text) {
  const rules = new Map();
  let current = null;
  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith("#")) continue;
    if (/^\S/.test(rawLine)) {
      current = new Map();
      rules.set(rawLine.trim(), current);
      continue;
    }
    assert.ok(current, `cabeçalho fora de um bloco de rota em _headers: ${rawLine}`);
    const idx = rawLine.indexOf(":");
    assert.ok(idx > 0, `linha inválida em _headers: ${rawLine}`);
    current.set(rawLine.slice(0, idx).trim().toLowerCase(), rawLine.slice(idx + 1).trim());
  }
  return rules;
}

const cfRules = parseCloudflareHeaders(cloudflareHeaders);
const vercelToCloudflare = { "/(.*)": "/*", "/": "/", "/index.html": "/index.html" };
for (const { source, headers } of config.headers) {
  const cfPath = vercelToCloudflare[source];
  assert.ok(cfPath, `rota ${source} do vercel.json não tem equivalente em _headers`);
  const cfHeaders = cfRules.get(cfPath);
  assert.ok(cfHeaders, `_headers não define a rota ${cfPath}`);
  for (const { key, value } of headers) {
    assert.equal(cfHeaders.get(key.toLowerCase()), value, `_headers diverge do vercel.json em ${cfPath} → ${key}`);
  }
}

console.log("Verificações de segurança do ShopBox Ponto concluídas.");

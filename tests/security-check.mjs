import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));

assert.match(html, /auth\.signInWithPassword/, "o login deve continuar usando o Supabase Auth");
assert.match(html, /navigator\.mediaDevices\.getUserMedia/, "o acesso à câmera deve permanecer disponível");
assert.doesNotMatch(html, /service_role/i, "uma chave service_role nunca pode ir para o navegador");
assert.doesNotMatch(html, /face-api\.js@master/, "modelos faciais não podem vir de uma branch mutável");
assert.match(html, /@supabase\/supabase-js@\d+\.\d+\.\d+/, "o SDK do Supabase deve usar versão exata");

const globalHeaders = config.headers.find(({ source }) => source === "/(.*)")?.headers ?? [];
const header = (name) => globalHeaders.find(({ key }) => key.toLowerCase() === name.toLowerCase())?.value;

assert.equal(header("X-Content-Type-Options"), "nosniff");
assert.equal(header("X-Frame-Options"), "SAMEORIGIN");
assert.match(header("Content-Security-Policy") ?? "", /frame-ancestors 'self'/);
assert.match(header("Permissions-Policy") ?? "", /camera=\(self\)/);

console.log("Verificações de segurança do ShopBox Ponto concluídas.");

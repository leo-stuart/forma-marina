#!/usr/bin/env node
/**
 * Confere se o lado do Supabase está pronto e se um arquivo volta idêntico.
 * Rode depois de criar o bucket, rodar o SQL e preencher SUPABASE_SECRET_KEY.
 *
 *   node --env-file=.env.local scripts/verificar-supabase.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const BUCKET = "fotos";

let falhas = 0;
const ok = (m) => console.log(`  ok   ${m}`);
const erro = (m) => {
  falhas++;
  console.log(`  FALHA ${m}`);
};

if (!url || !secret) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SECRET_KEY.");
  process.exit(1);
}
if (!secret.startsWith("sb_secret_") && !secret.startsWith("eyJ")) {
  console.error("SUPABASE_SECRET_KEY não parece uma chave secreta.");
  process.exit(1);
}

const db = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log("\n1. Bucket");
const { data: buckets, error: erroBuckets } = await db.storage.listBuckets();
if (erroBuckets) erro(`não deu para listar buckets: ${erroBuckets.message}`);
else {
  const b = buckets.find((x) => x.name === BUCKET);
  if (!b) erro(`bucket "${BUCKET}" não existe`);
  else {
    ok(`bucket "${BUCKET}" existe`);
    b.public ? erro("bucket está PÚBLICO — deveria ser privado") : ok("é privado");
    const limite = b.file_size_limit;
    if (!limite || limite >= 50 * 1024 * 1024) ok(`limite de tamanho: ${limite ?? "global"}`);
    else erro(`limite de ${limite} bytes é baixo para fotos 4K (queremos 50MB)`);
  }
}

console.log("\n2. Tabela");
const { error: erroTabela } = await db.from("fotos").select("id").limit(1);
if (erroTabela) erro(`tabela public.fotos inacessível: ${erroTabela.message}`);
else ok("tabela public.fotos existe e responde à chave secreta");

console.log("\n3. RLS (a chave publicável NÃO pode ler)");
const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!pub) erro("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ausente");
else {
  const anon = createClient(url, pub, { auth: { persistSession: false } });
  const { data, error } = await anon.from("fotos").select("mensagem").limit(1);
  if (error || !data || data.length === 0) ok("mensagens protegidas do anon");
  else erro("ANON CONSEGUIU LER MENSAGENS — revise o RLS");
}

console.log("\n4. Upload assinado, ida e volta");
const id = `teste-${randomUUID().slice(0, 8)}`;
const path = `originais/${id}.jpg`;
const sha = (b) => createHash("sha256").update(b).digest("hex");
// JPEG mínimo válido, com recheio para não ser trivial
const original = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]),
  Buffer.alloc(200_000, 0x5a),
  Buffer.from([0xff, 0xd9]),
]);

const { data: assinado, error: erroAssinar } =
  await db.storage.from(BUCKET).createSignedUploadUrl(path);
if (erroAssinar) erro(`createSignedUploadUrl falhou: ${erroAssinar.message}`);
else {
  ok("URL de upload assinada emitida");
  const anon = createClient(url, pub, { auth: { persistSession: false } });
  const { error: erroUpload } = await anon.storage
    .from(BUCKET)
    .uploadToSignedUrl(path, assinado.token, original, { contentType: "image/jpeg" });
  if (erroUpload) erro(`upload com a chave publicável falhou: ${erroUpload.message}`);
  else {
    ok("upload feito com a chave publicável (é o que o navegador faz)");
    const { data: baixado, error: erroDownload } =
      await db.storage.from(BUCKET).download(path);
    if (erroDownload) erro(`download falhou: ${erroDownload.message}`);
    else {
      const volta = Buffer.from(await baixado.arrayBuffer());
      sha(volta) === sha(original)
        ? ok(`voltou byte-idêntico (${volta.length} bytes)`)
        : erro("ARQUIVO VOLTOU DIFERENTE — algo reescreveu os bytes");
    }
    const { data: assinadas } = await db.storage
      .from(BUCKET)
      .createSignedUrls([path], 60);
    assinadas?.[0]?.signedUrl
      ? ok("URL assinada de leitura gerada")
      : erro("createSignedUrls não devolveu URL");

    await db.storage.from(BUCKET).remove([path]);
    ok("objeto de teste removido");
  }
}

console.log(
  falhas === 0
    ? "\nTudo certo — pode usar /foto e /galeria.\n"
    : `\n${falhas} verificação(ões) falharam.\n`
);
process.exit(falhas === 0 ? 0 : 1);

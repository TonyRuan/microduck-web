import { cp } from "node:fs/promises";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (e) =>
        e.isDirectory() ? walk(dir + "/" + e.name) : [dir + "/" + e.name],
      ),
    )
  ).flat();
}
await cp("licenses", "dist/licenses", { recursive: true });
await cp("LICENSE", "dist/LICENSE");
await cp("THIRD_PARTY_NOTICES.md", "dist/THIRD_PARTY_NOTICES.md");
const files = (await walk("dist")).filter((p) => !p.endsWith("/sw.js")).sort();
const hash = createHash("sha256");
for (const p of files) hash.update(await readFile(p));
const version = hash.digest("hex").slice(0, 16);
const urls = files.map((p) => "./" + p.slice(5));
await writeFile(
  "dist/sw.js",
  `const VERSION=${JSON.stringify(version)},FILES=${JSON.stringify(urls)};
const PREFIX='microduck-'+self.registration.scope+'-',CACHE=PREFIX+VERSION;
self.addEventListener('install',event=>event.waitUntil((async()=>{const c=await caches.open(CACHE);for(let i=0;i<FILES.length;i+=4)await c.addAll(FILES.slice(i,i+4));await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith(PREFIX)&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==location.origin||!u.href.startsWith(self.registration.scope))return;
event.respondWith((async()=>{const c=await caches.open(CACHE);if(event.request.mode==='navigate'){try{return await fetch(event.request);}catch{return (await c.match(new URL('./index.html',self.registration.scope)))||Response.error();}}return (await c.match(event.request))||fetch(event.request);})());});
`,
);
console.log("Offline cache:", version, files.length, "files");

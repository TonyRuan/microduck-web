import { msg } from "../i18n/core";
import { parseManifest } from "./manifest";
import type { SavedPolicy } from "../types";
export async function imported(
  bytes: ArrayBuffer,
  manifest: unknown,
  name: string,
  source: string,
  hold: number,
): Promise<SavedPolicy> {
  if (bytes.byteLength > 32 * 1024 * 1024)
    throw new Error(msg("单个模型限 32 MB"));
  const def = parseManifest(manifest, name, source, hold);
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  def.id = "import-" + hash;
  def.hash = hash;
  return { def, bytes, manifest, savedAt: Date.now() };
}
async function fetchFile(url: string, maxBytes: number) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(45000),
    credentials: "omit",
  });
  if (!r.ok)
    throw new Error(
      msg("下载失败 ({0})；可以下载文件后使用本地导入", r.status),
    );
  if (Number(r.headers.get("content-length")) > maxBytes)
    throw new Error(msg("文件超出大小限制"));
  const reader = r.body!.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error(msg("文件超出大小限制"));
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const b of chunks) {
    all.set(b, offset);
    offset += b.length;
  }
  return all.buffer;
}
export async function fromHub(
  text: string,
  hold: number,
  fallback: Record<string, unknown>,
) {
  const input = text
    .trim()
    .replace(/^https:\/\/huggingface.co\//, "")
    .replace(/\/$/, "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(input))
    throw new Error(msg("请输入 Hugging Face 模型仓库，如 作者/microduck-bow"));
  const api = await fetch("https://huggingface.co/api/models/" + input, {
    signal: AbortSignal.timeout(15000),
    credentials: "omit",
  });
  if (!api.ok)
    throw new Error(msg("未找到公开模型仓库；也可以使用本地文件导入"));
  const info = await api.json();
  if (!/^[a-f0-9]{40}$/.test(info.sha))
    throw new Error(msg("无法确认模型版本"));
  const base = `https://huggingface.co/${input}/resolve/${info.sha}/`;
  const hasManifest = (info.siblings ?? []).some(
    (x: { rfilename: string }) => x.rfilename === "manifest.json",
  );
  const raw = hasManifest
    ? JSON.parse(
        new TextDecoder().decode(
          await fetchFile(base + "manifest.json", 1024 * 1024),
        ),
      )
    : {
        ...fallback,
        name: fallback.name || input.split("/")[1],
        description: msg("仓库未提供 manifest.json，使用手动填写的动作信息。"),
      };
  const files = (info.siblings ?? [])
    .map((x: { rfilename: string }) => x.rfilename)
    .filter((x: string) => /^[\w.-]+\.onnx$/.test(x));
  if (raw.policies || files.length !== 1)
    throw new Error(
      msg("该仓库包含多个策略；请下载需要的 ONNX 及单个策略清单后导入"),
    );
  const bytes = await fetchFile(base + files[0], 32 * 1024 * 1024);
  return imported(
    bytes,
    raw,
    files[0].replace(/\.onnx$/, ""),
    input + "@" + info.sha,
    hold,
  );
}

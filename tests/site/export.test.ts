import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const outputDirectory = path.resolve("out");
const basePath = "/project-apps/dart-room";
const sharePath = "/projects/dart-room/play";

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory);
  const files = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(directory, entry);
    return (await stat(absolutePath)).isDirectory()
      ? collectFiles(absolutePath)
      : [absolutePath];
  }));
  return files.flat();
}

test("the embedded build exports a subpath-safe, non-indexable artifact", async () => {
  const html = await readFile(path.join(outputDirectory, "index.html"), "utf8");

  assert.match(html, /<meta name="robots" content="noindex, nofollow"/);
  assert.match(html, new RegExp(`<link rel="canonical" href="[^"]+${sharePath}"`));
  assert.match(html, new RegExp(`${basePath.replaceAll("/", "\\/")}\\/_next\\/`));
  assert.match(html, new RegExp(`${basePath.replaceAll("/", "\\/")}\\/game-og\\.png`));

  const localReferences = Array.from(html.matchAll(/(?:href|src)="([^"]+)"/g), (match) => match[1])
    .filter((reference) => reference.includes("/_next/") || reference.endsWith("/game-og.png"));

  assert.ok(localReferences.length > 0, "expected exported asset references");
  for (const reference of localReferences) {
    const pathname = new URL(reference, "https://example.test").pathname;
    assert.ok(pathname.startsWith(`${basePath}/`), `${reference} must include the embedded base path`);
    const artifactPath = path.join(outputDirectory, pathname.slice(basePath.length + 1));
    await assert.doesNotReject(() => stat(artifactPath), `${reference} must resolve inside the export`);
  }
});

test("the embedded client shares the public play route instead of the raw artifact", async () => {
  const files = await collectFiles(path.join(outputDirectory, "_next", "static"));
  const scripts = files.filter((file) => file.endsWith(".js"));
  const bundles = await Promise.all(scripts.map((file) => readFile(file, "utf8")));

  assert.ok(bundles.some((bundle) => bundle.includes(sharePath)), "share route must be compiled into the client");
});

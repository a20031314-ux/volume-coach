// Builds docs/privacy/index.html from src/content/privacy.json (the same text the app shows).
// Host docs/ with GitHub Pages (or anywhere) and put the URL in Play Console and the app.
import { readFileSync, writeFileSync } from 'node:fs';

const p = JSON.parse(readFileSync(new URL('../src/content/privacy.json', import.meta.url), 'utf8'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const body = p.sections.map((s) => `<h2>${esc(s.h)}</h2>\n${s.p.map((x) => `<p>${esc(x)}</p>`).join('\n')}`).join('\n');
const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)}</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--ink:#14171f;--muted:#5b6270}
@media (prefers-color-scheme:dark){:root{--bg:#0f1115;--ink:#e9ebf0;--muted:#9aa1ae}}
body{background:var(--bg);color:var(--ink);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;margin:0}
main{max-width:720px;margin:0 auto;padding:32px 16px 64px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 8px}p{margin:6px 0}.m{color:var(--muted)}
</style></head><body><main>
<h1>${esc(p.title)}</h1>
<p class="m">시행일 ${esc(p.effective)} · 운영자 ${esc(p.operator)} · 문의 ${esc(p.contact)}</p>
${body}
</main></body></html>
`;
writeFileSync(new URL('../docs/privacy/index.html', import.meta.url), html);
console.log('wrote docs/privacy/index.html');

(async () => {
  const out = {};
  out.title = document.title;
  out.url = location.href;
  out.hasAPI = typeof window.API === 'object';
  out.hasAGNES = typeof window.AGNES === 'object';

  const auth = await window.AUTH.login('tester@pc', '123456');
  out.login = { ok: auth.ok, families: (auth.families || []).length, error: auth.error || '' };

  const r = await fetch('/assets/img/fridge.jpg');
  const buf = await r.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const dataUrl = 'data:image/jpeg;base64,' + btoa(bin);

  const results = await window.API.recognize([dataUrl], [dataUrl]);
  out.recognize = {
    count: results.length,
    items: results.map((x) => x.name + ' ' + x.qty + x.unit + ' / ' + x.exp),
    meta: window.DB.intake.meta || null
  };
  return out;
})()

(async () => {
  const out = {};
  const label = document.querySelector('label[for="login-phone"]');
  out.label = label ? label.textContent.trim() : '';
  out.inputType = (document.getElementById('login-phone') || {}).type || '';

  const bad = await window.AUTH.requestCode('13800138000');
  out.phoneRejected = !bad.ok;
  out.phoneError = bad.error || '';

  const sent = await window.AUTH.requestCode('covabond@163.com');
  out.sent = sent;
  return out;
})()

/* 启核图策 · 验证码邮件发送（最小 SMTP 实现，不引第三方依赖）

   只做一件事：把一封 UTF-8 纯文本邮件通过 SMTP 提交给邮件服务商（默认 163 的 465 SSL）。
   为什么要自己写：后端目前只有 express + mysql2 两个依赖，为一个"发验证码"再拉一棵依赖树
   不划算；SMTP 提交流程本身很短（EHLO → AUTH LOGIN → MAIL → RCPT → DATA → QUIT）。

   凭据只从环境变量读（backend/.env 已在 .gitignore 里）：
     MAIL_HOST  smtp.163.com         SMTP 服务器
     MAIL_PORT  465                  SSL 端口（163/QQ/Gmail 都用 465）
     MAIL_USER  covabond@163.com     发信账号（完整邮箱）
     MAIL_PASS  <授权码>             163 的"SMTP 授权码"，不是邮箱登录密码
     MAIL_FROM  可选，缺省等于 MAIL_USER
*/

const tls = require('tls');

function crlf(s) {
  return s + '\r\n';
}

function b64(s) {
  return Buffer.from(String(s), 'utf8').toString('base64');
}

/** RFC2047 编码主题（中文主题必须编码，否则部分客户端显示乱码） */
function encodeHeader(s) {
  return '=?UTF-8?B?' + b64(s) + '?=';
}

/** SMTP 会话：把收到的数据切成行，按顺序交给 expect() */
class Session {
  constructor(sock) {
    this.sock = sock;
    this.lines = [];
    this.wake = null;
    this.err = null;
    this.buf = '';
    sock.setEncoding('utf8');
    sock.on('data', (chunk) => this.onData(chunk));
    sock.on('error', (e) => this.fail(e));
    sock.on('close', () => this.fail(new Error('连接被对端关闭')));
  }

  fail(e) {
    this.err = e;
    if (this.wake) {
      const w = this.wake;
      this.wake = null;
      w();
    }
  }

  onData(chunk) {
    this.buf += chunk;
    let idx = this.buf.indexOf('\r\n');
    while (idx >= 0) {
      this.lines.push(this.buf.slice(0, idx));
      this.buf = this.buf.slice(idx + 2);
      idx = this.buf.indexOf('\r\n');
    }
    if (this.wake) {
      const w = this.wake;
      this.wake = null;
      w();
    }
  }

  nextLine() {
    if (this.lines.length > 0) {
      return Promise.resolve(this.lines.shift());
    }
    if (this.err) {
      return Promise.reject(this.err);
    }
    return new Promise((resolve, reject) => {
      this.wake = () => {
        if (this.err) {
          reject(this.err);
        } else {
          resolve(this.lines.shift());
        }
      };
    });
  }

  write(s) {
    this.sock.write(crlf(s));
  }

  /** 读到一条最终响应（多行响应以 "250-" 续行，最后一条是 "250 "） */
  async expect() {
    for (;;) {
      const line = await this.nextLine();
      if (/^\d{3}-/.test(line)) {
        continue;
      }
      return line;
    }
  }
}

function isOk(line, codes) {
  const c = Number(String(line).slice(0, 3));
  return codes.indexOf(c) >= 0;
}

/**
 * 发一封纯文本邮件。成功 resolve(true)；失败 reject(Error)，由调用方决定是否降级。
 * 参数缺任何一个凭据都会直接 reject，绝不静默当成功。
 */
function sendMail(opts) {
  const host = opts.host || process.env.MAIL_HOST || 'smtp.163.com';
  const port = Number(opts.port || process.env.MAIL_PORT || 465);
  const user = opts.user || process.env.MAIL_USER || '';
  const pass = opts.pass || process.env.MAIL_PASS || '';
  const from = opts.from || process.env.MAIL_FROM || user;
  if (user === '' || pass === '') {
    return Promise.reject(new Error('未配置发信账号（MAIL_USER / MAIL_PASS）'));
  }
  return new Promise((resolve, reject) => {
    const sock = tls.connect({ host, port, servername: host }, async () => {
      const s = new Session(sock);
      const done = (e) => {
        try {
          sock.destroy();
        } catch (_x) {
          /* 忽略关闭异常 */
        }
        if (e) {
          reject(e);
        } else {
          resolve(true);
        }
      };
      try {
        let line = await s.expect();                                // 220 就绪
        if (!isOk(line, [220])) {
          throw new Error('SMTP 未就绪: ' + line);
        }
        s.write('EHLO nexcoregraph');                               // 打招呼
        line = await s.expect();
        if (!isOk(line, [250])) {
          throw new Error('EHLO 失败: ' + line);
        }
        s.write('AUTH LOGIN');                                      // 认证
        line = await s.expect();
        if (!isOk(line, [334])) {
          throw new Error('AUTH LOGIN 失败: ' + line);
        }
        s.write(b64(user));
        line = await s.expect();
        if (!isOk(line, [334])) {
          throw new Error('账号被拒: ' + line);
        }
        s.write(b64(pass));
        line = await s.expect();
        if (!isOk(line, [235])) {
          throw new Error('授权码被拒（163 要用 SMTP 授权码，不是登录密码）: ' + line);
        }
        s.write('MAIL FROM:<' + from + '>');                        // 发件人
        line = await s.expect();
        if (!isOk(line, [250])) {
          throw new Error('MAIL FROM 失败: ' + line);
        }
        s.write('RCPT TO:<' + opts.to + '>');                       // 收件人
        line = await s.expect();
        if (!isOk(line, [250, 251])) {
          throw new Error('RCPT TO 失败: ' + line);
        }
        s.write('DATA');                                            // 正文
        line = await s.expect();
        if (!isOk(line, [354])) {
          throw new Error('DATA 被拒: ' + line);
        }
        const head = [
          'From: ' + encodeHeader('启核图策') + ' <' + from + '>',
          'To: <' + opts.to + '>',
          'Subject: ' + encodeHeader(opts.subject),
          'MIME-Version: 1.0',
          'Content-Type: text/plain; charset=UTF-8',
          'Content-Transfer-Encoding: base64',
          'Date: ' + new Date().toUTCString()
        ].join('\r\n');
        // 正文用 base64 分行，避免中文/长行触发 SMTP 行限制
        const bodyB64 = b64(opts.text).replace(/(.{76})/g, '$1\r\n');
        s.sock.write(head + '\r\n\r\n' + bodyB64 + '\r\n.\r\n');
        line = await s.expect();
        if (!isOk(line, [250])) {
          throw new Error('正文被拒: ' + line);
        }
        s.write('QUIT');
        done(null);
      } catch (e) {
        done(e);
      }
    });
    sock.on('error', (e) => reject(e));
    sock.setTimeout(20000, () => {
      sock.destroy();
      reject(new Error('SMTP 连接超时'));
    });
  });
}

module.exports = { sendMail };

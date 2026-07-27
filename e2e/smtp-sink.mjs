// Minimal SMTP sink for local verification: speaks just enough SMTP to accept a
// message, then prints the envelope sender and the From: header it received.
// The app's SMTP fallback points at localhost:1025, so this captures exactly
// what VerShip puts on the wire.
//   node e2e/smtp-sink.mjs        (Ctrl-C to stop)
import net from 'node:net';

const PORT = Number(process.env.SMTP_SINK_PORT || 1025);

net.createServer((sock) => {
  let inData = false;
  let buf = '';
  let mailFrom = '';
  const w = (s) => sock.write(s + '\r\n');
  w('220 vership-sink ESMTP');

  sock.on('data', (chunk) => {
    const s = chunk.toString();
    if (inData) {
      buf += s;
      if (buf.includes('\r\n.\r\n')) {
        inData = false;
        const headers = buf.split('\r\n\r\n')[0];
        const from = (headers.match(/^From:\s*(.+)$/im) || [])[1] || '(no From header)';
        const subj = (headers.match(/^Subject:\s*(.+)$/im) || [])[1] || '(no Subject)';
        const to = (headers.match(/^To:\s*(.+)$/im) || [])[1] || '(no To)';
        console.log('--- message received ---');
        console.log(`envelope MAIL FROM: ${mailFrom}`);
        console.log(`From:    ${from}`);
        console.log(`To:      ${to}`);
        console.log(`Subject: ${subj}`);
        buf = '';
        w('250 OK queued');
      }
      return;
    }
    for (const line of s.split('\r\n').filter(Boolean)) {
      const cmd = line.toUpperCase();
      if (cmd.startsWith('EHLO') || cmd.startsWith('HELO')) w('250-vership-sink\r\n250 AUTH PLAIN LOGIN');
      else if (cmd.startsWith('AUTH')) w('235 auth ok');
      else if (cmd.startsWith('MAIL FROM')) { mailFrom = line.slice(line.indexOf(':') + 1).trim(); w('250 OK'); }
      else if (cmd.startsWith('RCPT TO')) w('250 OK');
      else if (cmd === 'DATA') { inData = true; w('354 send data'); }
      else if (cmd.startsWith('QUIT')) { w('221 bye'); sock.end(); }
      else w('250 OK');
    }
  });
  sock.on('error', () => {});
}).listen(PORT, () => console.log(`SMTP sink listening on ${PORT}`));

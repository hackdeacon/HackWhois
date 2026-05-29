/**
 * SSL/TLS Certificate Provider — fetches certificate info via TLS handshake.
 */
const tls = require('tls');

async function getCertificate(hostname, port = 443) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: hostname, port, servername: hostname, rejectUnauthorized: false, timeout: 8000 },
      () => {
        try {
          const cert = socket.getPeerCertificate();
          socket.destroy();
          if (!cert || !cert.subject) {
            resolve({ success: false, error: 'No certificate returned' });
            return;
          }
          resolve({
            success: true,
            data: {
              subject: cert.subject.CN || null,
              issuer: cert.issuer?.O || cert.issuer?.CN || null,
              valid_from: cert.valid_from ? new Date(cert.valid_from).toISOString() : null,
              valid_to: cert.valid_to ? new Date(cert.valid_to).toISOString() : null,
              serial_number: cert.serialNumber || null,
              fingerprint: cert.fingerprint256 || cert.fingerprint || null,
              alt_names: cert.subjectaltname
                ? cert.subjectaltname.split(',').map(s => s.trim().replace(/^DNS:/, ''))
                : [],
              protocol: socket.getProtocol?.() || null,
            },
          });
        } catch (e) {
          socket.destroy();
          resolve({ success: false, error: e.message });
        }
      }
    );

    socket.on('error', () => {
      resolve({ success: false, error: 'TLS connection failed' });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ success: false, error: 'TLS connection timed out' });
    });
  });
}

module.exports = { getCertificate };

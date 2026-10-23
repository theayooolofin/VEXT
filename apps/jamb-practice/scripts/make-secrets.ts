// npm run make:vapid            -> prints a VAPID key pair for Web Push
// npm run make:admin-hash -- "password"  -> prints a bcrypt hash for ADMIN_PASSWORD_HASH
// npm run make:secret           -> prints a random 48-byte secret
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import webpush from 'web-push';

const [cmd, arg] = process.argv.slice(2);

if (cmd === 'vapid') {
  const k = webpush.generateVAPIDKeys();
  console.log(`VAPID_PUBLIC_KEY=${k.publicKey}\nVAPID_PRIVATE_KEY=${k.privateKey}`);
} else if (cmd === 'admin-hash') {
  if (!arg || arg.length < 12) {
    console.error('Give a password of at least 12 characters: npm run make:admin-hash -- "your password"');
    process.exit(1);
  }
  // base64url so the value has no "$" for .env files to mangle.
  console.log(Buffer.from(bcrypt.hashSync(arg, 12)).toString('base64url'));
} else if (cmd === 'secret') {
  console.log(randomBytes(48).toString('base64url'));
} else {
  console.error('Commands: vapid, admin-hash, secret');
  process.exit(1);
}

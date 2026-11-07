require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const content = fs.readFileSync(envPath, 'utf8');
const secret = crypto.randomBytes(48).toString('base64url');
const updated = /^JWT_SECRET=.*$/m.test(content)
  ? content.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`)
  : `${content.trimEnd()}\nJWT_SECRET=${secret}\n`;

fs.writeFileSync(envPath, updated, { mode: 0o600 });
console.log('A new local JWT secret was generated. Existing login tokens are now invalid.');

require('dotenv').config();
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const baseUrl = 'http://127.0.0.1:5000';

async function request(route, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`${method} ${route} returned HTTP ${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}

async function verifyStatus(route, expectedStatus, token) {
  const response = await fetch(`${baseUrl}${route}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (response.status !== expectedStatus) {
    throw new Error(`${route} expected HTTP ${expectedStatus}, received ${response.status}`);
  }
  console.log(`PASS ${route} (${expectedStatus})`);
}

async function verifyUploadRejection(token, mimeType, size, expectedStatus, filename) {
  const form = new FormData();
  form.append('file', new Blob([Buffer.alloc(size)], { type: mimeType }), filename);
  const response = await fetch(`${baseUrl}/api/content`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: form,
  });
  if (response.status !== expectedStatus) {
    throw new Error(`Upload ${filename} expected HTTP ${expectedStatus}, received ${response.status}`);
  }
  console.log(`PASS upload rejection for ${filename} (HTTP ${expectedStatus})`);
}

async function login(email, password) {
  const result = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  return result.token;
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const email = `brandguard-smoke-${crypto.randomUUID()}@example.invalid`;
  let password = `${crypto.randomBytes(24).toString('base64url')}!`;
  let testUserId;

  try {
    await verifyStatus('/health', 200);
    await verifyStatus('/health/db', 200);
    const registration = await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Temporary API Smoke Test', email, password },
    });
    testUserId = registration.user.id;
    console.log('PASS POST /api/auth/register (database-backed)');

    let token = await login(email, password);
    await verifyStatus('/api/auth/me', 200, token);
    const newPassword = `${crypto.randomBytes(24).toString('base64url')}!`;
    const profile = await request('/api/auth/profile', {
      method: 'PUT',
      token,
      body: { full_name: 'Temporary API Profile Test', current_password: password, new_password: newPassword },
    });
    if (profile.user.name !== 'Temporary API Profile Test') {
      throw new Error('Profile update did not persist the updated name.');
    }
    password = newPassword;
    token = await login(email, password);
    console.log('PASS profile update and password change');
    for (const route of [
      '/api/dashboard',
      '/api/brands',
      '/api/organizations',
      '/api/guidelines',
      '/api/content',
      '/api/content/categories',
      '/api/notifications',
      '/api/analytics',
    ]) {
      await verifyStatus(route, 200, token);
    }
    await verifyUploadRejection(token, 'text/html', 64, 415, 'unsupported.html');
    await verifyUploadRejection(token, 'text/plain', 10 * 1024 * 1024 + 1, 413, 'oversized.txt');
    await verifyStatus('/api/reviews', 403, token);
    await verifyStatus('/api/users', 403, token);
    console.log('PASS role enforcement for CONTENT_CREATOR');

    await connection.execute("UPDATE users SET role = 'reviewer' WHERE user_id = ?", [testUserId]);
    token = await login(email, password);
    await verifyStatus('/api/reviews', 200, token);
    await verifyStatus('/api/users', 403, token);
    console.log('PASS role enforcement for REVIEWER');

    await connection.execute("UPDATE users SET role = 'admin' WHERE user_id = ?", [testUserId]);
    token = await login(email, password);
    for (const route of ['/api/reviews', '/api/users', '/api/reports', '/api/audit-logs']) {
      await verifyStatus(route, 200, token);
    }
    console.log('PASS role enforcement for ADMIN');
  } finally {
    if (testUserId) {
      await connection.execute('DELETE FROM users WHERE user_id = ?', [testUserId]);
      console.log('Temporary smoke-test account removed.');
    }
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`API smoke test failed: ${error.message}`);
  process.exitCode = 1;
});

const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const readline = require('readline');
const { withTransaction, query } = require('../config/db');

function prompt(label) {
  const interfaceInstance = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => interfaceInstance.question(label, (answer) => {
    interfaceInstance.close();
    resolve(answer.trim());
  }));
}

function promptSecret(label) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Run this command in an interactive Command Prompt so the password can be entered without echo.');
  }
  return new Promise((resolve, reject) => {
    let value = '';
    const input = process.stdin;
    const finish = (error) => {
      input.removeListener('data', onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') return finish(new Error('Admin bootstrap cancelled.'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
        } else if (character >= ' ') {
          value += character;
        }
      }
    };

    process.stdout.write(label);
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

async function main() {
  const fullName = await prompt('Administrator full name: ');
  const email = (await prompt('Administrator email: ')).toLowerCase();
  const password = await promptSecret('Administrator password (12+ characters): ');
  if (!fullName || !email || !password || password.length < 12) {
    throw new Error('Name, email, and a password of at least 12 characters are required.');
  }

  const admins = await query("SELECT user_id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1");
  if (admins.length) {
    throw new Error('An active administrator already exists; bootstrap refused.');
  }
  const [existing] = await query('SELECT user_id FROM users WHERE email = ? LIMIT 1', [email]);
  if (existing) {
    throw new Error('That email already belongs to an account. Use the existing account or select another email.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = await withTransaction(async (connection) => {
    const [user] = await connection.execute(
      `INSERT INTO users (full_name, email, password_hash, role, status)
       VALUES (?, ?, ?, 'admin', 'active')`,
      [fullName, email, passwordHash]
    );
    await connection.execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'admin_bootstrapped', 'user', ?, 'First administrator account created')`,
      [user.insertId, user.insertId]
    );
    return user.insertId;
  });

  console.log(`Administrator account created (user ID ${userId}).`);
}

main().catch((error) => {
  console.error(`Admin bootstrap failed: ${error.message}`);
  process.exitCode = 1;
});

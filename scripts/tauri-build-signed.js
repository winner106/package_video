import { spawn } from 'node:child_process'
// scripts/tauri-build-signed.mjs
import fs from 'node:fs'
import path from 'node:path'

const keyPath = path.resolve(process.cwd(), 'keys', 'updater.key')
const pwPath = path.resolve(process.cwd(), 'keys', 'updater.key.password')

if (!fs.existsSync(keyPath)) {
  console.error(`[error] key file not found: ${keyPath}`)
  process.exit(1)
}
if (!fs.existsSync(pwPath)) {
  console.error(`[error] password file not found: ${pwPath}`)
  console.error(`Create it with the key password (plain text, one line).`)
  process.exit(1)
}

const password = fs.readFileSync(pwPath, 'utf8').trim()
if (!password) {
  console.error(`[error] password file is empty: ${pwPath}`)
  process.exit(1)
}

const env = {
  ...process.env,
  TAURI_SIGNING_PRIVATE_KEY: keyPath, // ✅ use absolute path
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: password, // ✅ read from file
}

// Run: pnpm tauri build
const cmd = 'pnpm'
const args = ['tauri', 'build']

const child = spawn(cmd, args, {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32', // needed on Windows for pnpm.cmd
})

child.on('exit', code => process.exit(code ?? 1))

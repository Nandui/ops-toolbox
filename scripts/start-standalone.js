/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const root = process.cwd()
const standaloneDir = path.join(root, '.next', 'standalone')
const serverPath = path.join(standaloneDir, 'server.js')
const staticSrc = path.join(root, '.next', 'static')
const staticDest = path.join(standaloneDir, '.next', 'static')
const envPath = path.join(root, '.env.local')

function parseEnvValue(raw) {
  let value = raw.trim()
  if (!value) return ''

  const isSingleQuoted = value.startsWith("'") && value.endsWith("'")
  const isDoubleQuoted = value.startsWith('"') && value.endsWith('"')

  if (isSingleQuoted || isDoubleQuoted) {
    value = value.slice(1, -1)
    if (isDoubleQuoted) {
      value = value
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
    }
  }

  return value
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed
    const eqIndex = normalized.indexOf('=')
    if (eqIndex <= 0) continue

    const key = normalized.slice(0, eqIndex).trim()
    if (!key) continue

    const value = parseEnvValue(normalized.slice(eqIndex + 1))
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function syncStandaloneAssets() {
  if (!fs.existsSync(staticSrc)) return
  fs.mkdirSync(path.dirname(staticDest), { recursive: true })
  fs.rmSync(staticDest, { recursive: true, force: true })
  fs.cpSync(staticSrc, staticDest, { recursive: true })
}

if (!fs.existsSync(serverPath)) {
  console.error(`Standalone server not found at ${serverPath}. Run \"npm run build\" first.`)
  process.exit(1)
}

syncStandaloneAssets()
loadEnvFile(envPath)

const child = spawn(process.execPath, [serverPath], {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
})

child.on('exit', code => {
  process.exit(code ?? 0)
})

child.on('error', error => {
  console.error(error)
  process.exit(1)
})

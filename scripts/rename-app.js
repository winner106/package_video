import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

/**
 * Rename the app across config and localization files.
 *
 * Usage:
 *   node scripts/rename-app.js --name "New App"
 *
 * Notes:
 * - --name is required. This sets the display name.
 * - package.json "name" is set to a safe slug derived from --name (spaces become "-").
 * - Tauri identifier is set to `com.{slug}.app` (replacing the "example" segment).
 */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function parseArgs() {
  const args = process.argv.slice(2)
  const params = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name') {
      params.name = args[++i]
    }
  }
  if (!params.name) {
    console.error('Error: --name is required. Example: node scripts/rename-app.js --name "My App"')
    process.exit(1)
  }
  return params
}

function slugify(str) {
  return (
    str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'app'
  )
}

function updateJson(filePath, mutator) {
  const content = fs.readFileSync(filePath, 'utf8')
  const data = JSON.parse(content)
  mutator(data)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  console.log(`Updated ${filePath}`)
}

function updateTauriConfig(appName, identifier) {
  const filePath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json')
  updateJson(filePath, data => {
    if (!data.productName) {
      console.warn(`Warning: productName not found in ${filePath}`)
    }
    data.productName = appName
    data.identifier = identifier
  })
}

function updatePackageJson(appName) {
  const filePath = path.join(__dirname, '..', 'package.json')
  updateJson(filePath, data => {
    data.name = slugify(appName)
    if (data.productName) {
      data.productName = appName
    }
  })
}

function updateCargoToml(appName) {
  const filePath = path.join(__dirname, '..', 'src-tauri', 'Cargo.toml')
  const content = fs.readFileSync(filePath, 'utf8')
  const updated = content.replace(/name\s*=\s*".*?"/, `name = "${slugify(appName)}"`)
  fs.writeFileSync(filePath, updated)
  console.log(`Updated ${filePath}`)
}

function updateLocales(appName) {
  const localesDir = path.join(__dirname, '..', 'locales')
  const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'))
  files.forEach(file => {
    const filePath = path.join(localesDir, file)
    updateJson(filePath, data => {
      if (data['app.name'] !== undefined) data['app.name'] = appName
      if (data['titlebar.default'] !== undefined) data['titlebar.default'] = appName
    })
  })
}

function updateTrayTooltip(appName) {
  const filePath = path.join(__dirname, '..', 'src-tauri', 'src', 'commands', 'tray.rs')
  const content = fs.readFileSync(filePath, 'utf8')
  const updated = content.replace(/\.tooltip\(".*?"\)/, `.tooltip("${appName}")`)
  if (content === updated) {
    console.warn(`Warning: did not find .tooltip("...") pattern in ${filePath}`)
  } else {
    fs.writeFileSync(filePath, updated)
    console.log(`Updated ${filePath}`)
  }
}

function main() {
  const { name } = parseArgs()
  const slug = slugify(name)
  const identifier = `com.${slug}.app`
  updateTauriConfig(name, identifier)
  updatePackageJson(name)
  updateCargoToml(name)
  updateLocales(name)
  updateTrayTooltip(name)
  console.log('Rename complete.')
}

main()

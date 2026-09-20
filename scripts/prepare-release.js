import { execSync } from 'child_process'
import fs from 'fs'
import readline from 'readline'

function exec(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      cwd: options.cwd ?? process.cwd(),
      shell: true,
      ...options,
    })
  } catch (error) {
    throw new Error(`Command failed: ${command}\n${error.message}`)
  }
}

function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

/**
 * Replace the first occurrence of a JSON top-level field like:
 *   "version": "x.y.z"
 * while preserving original file formatting and ordering.
 */
function replaceJsonStringFieldPreserveFormatting(fileText, key, newValue) {
  // Matches "key": "...." (allow spaces/newlines)
  const re = new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`)
  const m = fileText.match(re)
  if (!m) return { updatedText: null, oldValue: null }
  const oldValue = m[1]
  const updatedText = fileText.replace(re, `"${key}": "${newValue}"`)
  return { updatedText, oldValue }
}

/**
 * Replace the first occurrence of a TOML field like:
 *   version = "x.y.z"
 * while preserving the rest of the file.
 */
function replaceTomlStringField(fileText, key, newValue) {
  const re = new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, 'm')
  const m = fileText.match(re)
  if (!m) return { updatedText: null, oldValue: null }
  const oldValue = m[1]
  const updatedText = fileText.replace(re, `${key} = "${newValue}"`)
  return { updatedText, oldValue }
}

async function prepareRelease() {
  const version = process.argv[2]

  if (!version || !version.match(/^v?\d+\.\d+\.\d+$/)) {
    console.error('❌ Usage: node scripts/prepare-release.js v1.0.0')
    console.error('   or: pnpm run release:prepare v1.0.0')
    process.exit(1)
  }

  const cleanVersion = version.replace(/^v/, '')
  const tagVersion = version.startsWith('v') ? version : `v${version}`

  console.log(`🚀 Preparing release ${tagVersion}...\n`)

  try {
    // Check git status
    console.log('🔍 Checking git status...')
    const gitStatus = exec('git status --porcelain', { silent: true })
    if (gitStatus.trim()) {
      console.error('❌ Working directory is not clean. Please commit or stash changes first.')
      console.log('Uncommitted changes:')
      console.log(gitStatus)
      process.exit(1)
    }
    console.log('✅ Working directory is clean')

    // Run all checks first
    console.log('\n🔍 Running pre-release checks...')
    exec('pnpm run check:all')
    console.log('✅ All checks passed')

    // Update package.json (preserve formatting)
    console.log('\n📝 Updating package.json...')
    const pkgPath = 'package.json'
    const pkgText = fs.readFileSync(pkgPath, 'utf8')
    const pkgRes = replaceJsonStringFieldPreserveFormatting(pkgText, 'version', cleanVersion)
    if (!pkgRes.updatedText) {
      throw new Error('Cannot find "version" field in package.json')
    }
    fs.writeFileSync(pkgPath, pkgRes.updatedText)
    console.log(`   ${pkgRes.oldValue} → ${cleanVersion}`)

    // Update Cargo.toml (preserve formatting)
    console.log('📝 Updating Cargo.toml...')
    const cargoPath = 'src-tauri/Cargo.toml'
    const cargoToml = fs.readFileSync(cargoPath, 'utf8')
    const cargoRes = replaceTomlStringField(cargoToml, 'version', cleanVersion)
    if (!cargoRes.updatedText) {
      // Fallback: some Cargo.toml may have multiple `version =` lines; update the first one
      const fallbackOld = cargoToml.match(/version\s*=\s*"([^"]*)"/)
      if (!fallbackOld) throw new Error('Cannot find version in src-tauri/Cargo.toml')
      const updatedCargo = cargoToml.replace(/version\s*=\s*"[^"]*"/, `version = "${cleanVersion}"`)
      fs.writeFileSync(cargoPath, updatedCargo)
      console.log(`   ${fallbackOld[1]} → ${cleanVersion}`)
    } else {
      fs.writeFileSync(cargoPath, cargoRes.updatedText)
      console.log(`   ${cargoRes.oldValue} → ${cleanVersion}`)
    }

    // Update tauri.conf.json (preserve formatting)
    console.log('📝 Updating tauri.conf.json...')
    const tauriConfigPath = 'src-tauri/tauri.conf.json'
    const tauriText = fs.readFileSync(tauriConfigPath, 'utf8')
    const tauriRes = replaceJsonStringFieldPreserveFormatting(tauriText, 'version', cleanVersion)
    if (!tauriRes.updatedText) {
      throw new Error('Cannot find "version" field in src-tauri/tauri.conf.json')
    }
    fs.writeFileSync(tauriConfigPath, tauriRes.updatedText)
    console.log(`   ${tauriRes.oldValue} → ${cleanVersion}`)

    // Update lock files using pnpm (quiet)
    console.log('\n📦 Updating lock files (pnpm)...')
    exec('pnpm install', { silent: true })
    console.log('✅ Lock files updated')

    // Verify configurations (parse only for reading, do NOT re-write)
    console.log('\n🔍 Verifying configurations...')
    let tauriConfigObj = null
    try {
      tauriConfigObj = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'))
    } catch (e) {
      console.warn('⚠️  Warning: Failed to parse tauri.conf.json for verification')
    }

    if (tauriConfigObj) {
      if (!tauriConfigObj.bundle?.createUpdaterArtifacts) {
        console.warn('⚠️  Warning: createUpdaterArtifacts not enabled in tauri.conf.json')
      } else {
        console.log('✅ Updater artifacts enabled')
      }

      if (!tauriConfigObj.plugins?.updater?.pubkey) {
        console.warn('⚠️  Warning: Updater public key not configured')
      } else {
        console.log('✅ Updater public key configured')
      }
    }

    // Final check that Rust code compiles
    console.log('\n🔍 Running final compilation check...')
    exec('cargo check', { cwd: 'src-tauri' })
    console.log('✅ Rust compilation check passed')

    console.log(`\n🎉 Successfully prepared release ${tagVersion}!`)
    console.log('\n📋 Git commands to execute:')
    console.log(`   git add .`)
    console.log(`   git commit -m "chore: release ${tagVersion}"`)
    console.log(`   git tag ${tagVersion}`)
    console.log(`   git push origin main --tags`)

    console.log('\n🚀 After pushing:')
    console.log('   • GitHub Actions will automatically build the release')
    console.log('   • A draft release will be created on GitHub')
    console.log("   • You'll need to manually publish the draft release")
    console.log('   • Users will receive auto-update notifications')

    // Interactive execution option
    const answer = await askQuestion('\n❓ Would you like me to execute these git commands? (y/N): ')

    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      console.log('\n⚡ Executing git commands...')

      console.log('📝 Adding changes...')
      exec('git add .')

      console.log('💾 Creating commit...')
      exec(`git commit -m "chore: release ${tagVersion}"`)

      console.log('🏷️  Creating tag...')
      exec(`git tag ${tagVersion}`)

      console.log('📤 Pushing to remote...')
      exec('git push origin main --tags')

      console.log(`\n🎊 Release ${tagVersion} has been published!`)
      const remoteUrl = exec('git remote get-url origin', { silent: true }).trim()
      const repoPath = remoteUrl
        .replace(/^git@github\.com:/, '')
        .replace(/^https:\/\/github\.com\//, '')
        .replace(/\.git$/, '')

      console.log(`📱 Check GitHub Actions: https://github.com/${repoPath}/actions`)
      console.log(`📦 Releases: https://github.com/${repoPath}/releases`)

      console.log('\n⚠️  Remember: You need to manually publish the draft release on GitHub!')
    } else {
      console.log('\n📝 Git commands saved for manual execution.')
      console.log("   Run them when you're ready to release.")
    }
  } catch (error) {
    console.error('\n❌ Pre-release preparation failed:', error.message)
    process.exit(1)
  }
}

// Run
prepareRelease()

#!/usr/bin/env bun

type Check = {
  title: string
  command: string[]
  cwd?: string
}

import { join } from 'node:path'

const rootDir = join(import.meta.dir, '..', '..')
const checks: Check[] = [
  {
    title: 'Server persistent JSON migrations',
    command: [process.execPath, 'test', 'src/server/__tests__/persistence-upgrade.test.ts'],
  },
  {
    title: 'Desktop localStorage migrations',
    command: [process.execPath, 'run', 'test', '--', 'src/lib/persistenceMigrations.test.ts'],
    cwd: 'desktop',
  },
]

async function runCheck(check: Check): Promise<number> {
  const cwd = check.cwd ? join(rootDir, check.cwd) : rootDir
  console.log(`\n[persistence-upgrade] ${check.title}`)
  console.log(`$ ${check.command.join(' ')}`)
  try {
    const { execSync } = await import('node:child_process')
    const cmdStr = check.command.map((a) => /[ "']/.test(a) ? `"${a}"` : a).join(' ')
    execSync(cmdStr, { cwd, stdio: 'inherit', maxBuffer: 50 * 1024 * 1024 })
    return 0
  } catch (err: any) {
    return err.status ?? 1
  }
}

let failures = 0
for (const check of checks) {
  const code = await runCheck(check)
  if (code !== 0) {
    failures += 1
  }
}

if (failures > 0) {
  console.error(`\n[persistence-upgrade] failed checks: ${failures}`)
  process.exit(1)
}

console.log('\n[persistence-upgrade] all checks passed')

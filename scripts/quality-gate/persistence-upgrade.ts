#!/usr/bin/env bun

type Check = {
  title: string
  command: string[]
  cwd?: string
}

const rootDir = process.cwd()
const checks: Check[] = [
  {
    title: 'Server persistent JSON migrations',
    command: ['bun', 'test', 'src/server/__tests__/persistence-upgrade.test.ts'],
  },
  {
    title: 'Desktop localStorage migrations',
    command: ['bun', 'run', 'test', '--', 'src/lib/persistenceMigrations.test.ts'],
    cwd: 'desktop',
  },
]

async function runCheck(check: Check): Promise<number> {
  const cwd = check.cwd ? `${rootDir}/${check.cwd}` : rootDir
  console.log(`\n[persistence-upgrade] ${check.title}`)
  const cmd = check.command[0] === 'bun'
    ? [process.execPath, ...check.command.slice(1)]
    : check.command
  const cmdStr = cmd.map((a) => /[ "']/.test(a) ? `"${a}"` : a).join(' ')
  console.log(`$ ${cmdStr}`)
  try {
    const { execSync } = await import('node:child_process')
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

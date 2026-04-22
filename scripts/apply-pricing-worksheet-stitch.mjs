import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()

const targetPath = path.join(
  repoRoot,
  'src/components/pricing/PricingWorksheetPage.tsx'
)

const replacementPath = path.join(
  repoRoot,
  'src/components/pricing/PricingWorksheetPage.next.tsx'
)

const backupPath = path.join(
  repoRoot,
  'src/components/pricing/PricingWorksheetPage.pre_stitch_backup.tsx'
)

function fail(message) {
  console.error(`[stitch] ${message}`)
  process.exit(1)
}

if (!fs.existsSync(targetPath)) fail('Target file not found.')
if (!fs.existsSync(replacementPath)) fail('Replacement file not found.')

const current = fs.readFileSync(targetPath, 'utf8')
const next = fs.readFileSync(replacementPath, 'utf8')

if (!current.includes("'use client'")) {
  fail('Target file does not look correct.')
}

if (!next.includes("'use client'")) {
  fail('Replacement file does not look correct.')
}

if (current.trim() === next.trim()) {
  console.log('[stitch] No changes needed.')
  process.exit(0)
}

fs.writeFileSync(backupPath, current, 'utf8')
fs.writeFileSync(targetPath, next, 'utf8')

console.log('[stitch] Replacement applied.')

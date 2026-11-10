import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const root = new URL('../', import.meta.url)
const appConfig = fs.readFileSync(new URL('src/app.config.ts', root), 'utf8')
const packageJson = JSON.parse(fs.readFileSync(new URL('package.json', root), 'utf8'))

describe('weapp project contract', () => {
  it('declares the four primary tabs', () => {
    for (const page of [
      'pages/workbench/index',
      'pages/home/index',
      'pages/library/index',
      'pages/mine/index'
    ]) expect(appConfig).toContain(`'${page}'`)
  })

  it('exposes one production verification command', () => {
    expect(packageJson.scripts['verify:weapp']).toBeTruthy()
  })
})

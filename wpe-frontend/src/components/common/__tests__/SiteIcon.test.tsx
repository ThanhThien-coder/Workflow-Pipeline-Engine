// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { SiteIcon, brandOf, hostOf, siteLabel } from '../SiteIcon'

describe('SiteIcon', () => {
  it('hostOf: bỏ www, viết thường; link hỏng hoặc không phải http(s) trả null', () => {
    expect(hostOf('https://WWW.GitHub.com/org/repo')).toBe('github.com')
    expect(hostOf('javascript:alert(1)')).toBeNull()
    expect(hostOf('not a url')).toBeNull()
    expect(hostOf(null)).toBeNull()
  })

  it('brandOf: khớp tên miền và tên miền con, không khớp nhầm chuỗi trong đường dẫn', () => {
    expect(brandOf('https://github.com/demo/app/pull/3')?.key).toBe('github')
    expect(brandOf('https://demo.github.io/site')?.key).toBe('github')
    expect(brandOf('https://www.figma.com/file/abc')?.key).toBe('figma')
    expect(brandOf('https://youtu.be/xyz')?.key).toBe('youtube')
    expect(brandOf('https://evil.com/github.com')).toBeNull()
    expect(brandOf('https://notgithub.com/x')).toBeNull()
  })

  it('siteLabel: tách Google Docs/Sheets/Slides theo đường dẫn, tên miền lạ thì trả tên miền', () => {
    expect(siteLabel('https://docs.google.com/document/d/1')).toBe('Google Docs')
    expect(siteLabel('https://docs.google.com/spreadsheets/d/1')).toBe('Google Sheets')
    expect(siteLabel('https://docs.google.com/presentation/d/1')).toBe('Google Slides')
    expect(siteLabel('https://api.team.dev/swagger')).toBe('api.team.dev')
    expect(siteLabel('bad')).toBe('Link')
  })

  it('vẽ SVG thương hiệu, chữ cái đầu cho tên miền lạ, icon link cho link hỏng', () => {
    const { container, rerender } = render(<SiteIcon url="https://github.com/x" />)
    expect(container.querySelector('svg path')).toBeTruthy()
    expect(container.querySelector('title')?.textContent).toBe('GitHub')

    rerender(<SiteIcon url="https://api.team.dev/docs" />)
    expect(container.textContent).toBe('a')

    rerender(<SiteIcon url={null} />)
    expect(container.querySelectorAll('svg path')).toHaveLength(2)
  })
})

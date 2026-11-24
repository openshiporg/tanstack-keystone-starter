import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  DropdownMenuGroup,
  DropdownMenuLabel,
} from '../src/components/ui/dropdown-menu'

describe('Base UI dropdown menu groups', () => {
  it('renders labels inside the required group context', () => {
    expect(() =>
      renderToStaticMarkup(
        createElement(
          DropdownMenuGroup,
          null,
          createElement(DropdownMenuLabel, null, 'Display columns'),
        ),
      ),
    ).not.toThrow()
  })
})

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Custom JSX factory que cria elementos com Symbol(react.element) (React 18).
 * Necessário porque Next.js 15 usa React 19 canary (Symbol(react.transitional.element))
 * mas @react-pdf/renderer v3.4 espera React 18 elements.
 *
 * Importar este `h` e adicionar o pragma nos arquivos de componentes PDF:
 *   @jsxRuntime classic
 *   @jsx h
 */

const REACT_ELEMENT_TYPE = Symbol.for('react.element')

export function h(type: any, props: any, ...children: any[]): any {
  const { key, ref, ...rest } = props || {}
  const flatChildren =
    children.length === 0
      ? undefined
      : children.length === 1
        ? children[0]
        : children
  return {
    '$$typeof': REACT_ELEMENT_TYPE,
    type,
    key: key ?? null,
    ref: ref ?? null,
    props:
      flatChildren !== undefined ? { ...rest, children: flatChildren } : { ...rest },
    _owner: null,
    _store: {},
  }
}

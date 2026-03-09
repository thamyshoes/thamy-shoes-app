import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { FichaTemplate, type FichaTemplateProps } from './templates/ficha-template'

/**
 * Wrapper isolado para renderizar PDF.
 * Este arquivo é listado em serverExternalPackages (via barrel)
 * para garantir que usa o mesmo React que @react-pdf/renderer.
 */
export async function renderFichaPdf(props: FichaTemplateProps): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(FichaTemplate, props) as any
  return renderToBuffer(element)
}

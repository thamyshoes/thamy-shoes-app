import React from 'react'
import { FichaTemplate, type FichaTemplateProps } from './ficha-template'
import { Setor } from '@/types'

type Props = Omit<FichaTemplateProps, 'setor'>

export function FichaPalmilha(props: Props) {
  return <FichaTemplate {...props} setor={Setor.PALMILHA} />
}

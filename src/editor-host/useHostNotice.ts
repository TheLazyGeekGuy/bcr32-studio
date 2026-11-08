import {useEffect, useState} from 'react'
import {expireHostNotice} from './notice-expiry'

/** Common lifetime policy for standalone and workspace notifications. */
export function useHostNotice() {
  const [notice, setNotice] = useState('')
  useEffect(() => expireHostNotice(notice, setNotice), [notice])
  return [notice, setNotice] as const
}

'use client'

import { startTransition, useActionState, useEffect, useId, useRef, useState } from 'react'
import { FileText, Paperclip, Send } from 'lucide-react'
import { declineDispute } from '@/app/(portal)/disputes/actions'
import { EVIDENCE, parseDecline } from '@/lib/disputes/rules'
import { MAX_FILES, checkFiles } from '@/lib/disputes/files'
import { fileSize } from '@/lib/disputes/view'
import { shrinkImage } from './shrink-image'
import { declineBtn, quietBtn, secondaryBtn } from './buttons'

const NOTE_MAX = 500

const choice =
  'flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg border border-line-strong bg-white px-3 py-2.5 text-[15px] leading-snug has-[:checked]:border-nets-blue has-[:checked]:bg-nets-blue-soft has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-nets-blue'
const box = 'mt-0.5 size-[18px] flex-none accent-nets-blue focus-visible:outline-none'
const errorText = 'm-0 text-[14px] font-medium text-bad'

/**
 * "Tell NETS why the payment was right": the Decline form inside an open dispute. Photos are made smaller in
 * the browser when picked; the fields and files are checked here first, then again on the server. What was
 * typed stays after an error.
 * @param {{
 *   disputeId: string, reasons: {value: string, label: string}[],
 *   headingRef: React.RefObject<HTMLHeadingElement | null>, onCancel: () => void, onDone: (message: string) => void,
 * }} props
 */
export function DeclineForm({ disputeId, reasons, headingRef, onCancel, onDone }) {
  const [state, formAction, sending] = useActionState(declineDispute, null)
  const [reason, setReason] = useState('')
  const [evidence, setEvidence] = useState(/** @type {string[]} */ ([]))
  const [note, setNote] = useState('')
  const [files, setFiles] = useState(/** @type {{key: string, file: File}[]} */ ([]))
  const [preparing, setPreparing] = useState(false)
  const [localErrors, setLocalErrors] = useState(/** @type {Record<string, string> | null} */ (null))
  const [fileError, setFileError] = useState(/** @type {string | null} */ (null))
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const id = useId()
  const busy = sending || preparing

  // A successful answer closes the form; the case then shows "Waiting for NETS".
  useEffect(() => {
    if (state?.ok) onDone(state.message)
  }, [state, onDone])

  const serverErrors = state && !state.ok ? (state.errors ?? {}) : {}
  const errors = localErrors ?? serverErrors
  const formMessage = !localErrors && state && !state.ok ? (state.message ?? null) : null
  const ids = { reason: `${id}-reason-err`, evidence: `${id}-evidence-err`, note: `${id}-note-err`, files: `${id}-files-err`, help: `${id}-files-help` }

  /** @param {React.ChangeEvent<HTMLInputElement>} e */
  async function addFiles(e) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (picked.length === 0) return
    if (files.length + picked.length > MAX_FILES) {
      setFileError(`You can add up to ${MAX_FILES} files.`)
      return
    }
    setFileError(null)
    setPreparing(true)
    try {
      const small = await Promise.all(picked.map((f) => shrinkImage(f)))
      setFiles((list) => [...list, ...small.map((file, i) => ({ key: `${Date.now()}-${i}-${file.name}`, file }))])
    } finally {
      setPreparing(false)
    }
  }

  /** @param {React.FormEvent<HTMLFormElement>} e */
  async function submit(e) {
    e.preventDefault()
    if (busy) return
    const fd = new FormData(e.currentTarget)
    fd.delete('files')
    for (const { file } of files) fd.append('files', file, file.name)

    const parsed = parseDecline(fd)
    const heads = await Promise.all(files.map(async ({ file }) => new Uint8Array(await file.slice(0, 8).arrayBuffer())))
    const check = checkFiles(files.map(({ file }, i) => ({ name: file.name, size: file.size, head: heads[i] })))
    if (!parsed.ok || !check.ok) {
      setLocalErrors(parsed.ok ? {} : parsed.errors)
      setFileError(check.ok ? null : check.message)
      return
    }
    setLocalErrors(null)
    setFileError(null)
    startTransition(() => formAction(fd))
  }

  /** @param {string} value */
  const toggleEvidence = (value) =>
    setEvidence((list) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]))

  const left = MAX_FILES - files.length

  return (
    <form onSubmit={submit} noValidate className="mt-[18px] flex flex-col gap-[18px] border-t border-line pt-[18px]" aria-labelledby={`${id}-h`}>
      <input type="hidden" name="disputeId" value={disputeId} />
      <h3 id={`${id}-h`} ref={headingRef} tabIndex={-1} className="text-[18px] font-[650] outline-none">
        Tell NETS why the payment was right
      </h3>

      <fieldset
        className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0"
        aria-describedby={errors.declineReason ? ids.reason : undefined}
        aria-invalid={errors.declineReason ? true : undefined}
      >
        <legend className="mb-2 p-0 text-[15px] font-semibold">Why do you disagree?</legend>
        <div className="grid gap-2">
          {reasons.map((r) => (
            <label key={r.value} className={choice}>
              <input
                type="radio"
                name="declineReason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className={box}
              />
              {r.label}
            </label>
          ))}
        </div>
        {errors.declineReason ? <p id={ids.reason} className={errorText}>{errors.declineReason}</p> : null}
      </fieldset>

      <fieldset
        className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0"
        aria-describedby={errors.evidence ? ids.evidence : undefined}
        aria-invalid={errors.evidence ? true : undefined}
      >
        <legend className="p-0 text-[15px] font-semibold">What proof do you have?</legend>
        <p className="m-0 text-[14px] text-ink-2">Tick all that you can send.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {EVIDENCE.map((ev) => (
            <label key={ev.value} className={choice}>
              <input
                type="checkbox"
                name="evidence"
                value={ev.value}
                checked={evidence.includes(ev.value)}
                onChange={() => toggleEvidence(ev.value)}
                className={box}
              />
              {ev.label}
            </label>
          ))}
        </div>
        {errors.evidence ? <p id={ids.evidence} className={errorText}>{errors.evidence}</p> : null}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-note`} className="text-[15px] font-semibold">
          Anything else NETS should know?
        </label>
        <textarea
          id={`${id}-note`}
          name="note"
          value={note}
          maxLength={NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
          aria-describedby={`${id}-count${errors.note ? ` ${ids.note}` : ''}`}
          aria-invalid={errors.note ? true : undefined}
          className="min-h-[88px] w-full resize-y rounded-lg border border-line-strong bg-white px-3.5 py-3 text-[16px] text-ink placeholder:text-ink-3 focus:border-nets-blue focus:shadow-[0_0_0_3px_var(--nets-blue-soft)] focus:outline-none aria-invalid:border-bad"
        />
        <div className="flex flex-wrap justify-between gap-x-3">
          {errors.note ? <p id={ids.note} className={errorText}>{errors.note}</p> : <span />}
          <span id={`${id}-count`} className="ml-auto text-[13px] text-ink-3 tabular-nums">
            {note.length}/{NOTE_MAX}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span id={`${id}-files-lab`} className="text-[15px] font-semibold">Add photos or PDFs</span>
        <p id={ids.help} className="m-0 -mt-1 text-[14px] text-ink-2">
          Up to 3 files, 2 MB each. On a phone you can take a photo.
        </p>
        {files.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Files to send">
            {files.map(({ key, file }) => (
              <li key={key} className="flex min-w-0 items-center gap-2.5 rounded-lg border border-line bg-white py-1 pr-1 pl-2.5 text-[14px]">
                <FileText className="size-4 flex-none text-nets-blue" aria-hidden="true" />
                <span className="min-w-0 truncate">{file.name}</span>
                <span className="ml-auto flex-none text-ink-3 tabular-nums">{fileSize(file.size)}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFiles((list) => list.filter((f) => f.key !== key))
                    setFileError(null)
                  }}
                  className={`${quietBtn} max-sm:w-auto`}
                  aria-label={`Remove ${file.name}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {left > 0 ? (
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 rounded-lg border border-dashed border-line-strong bg-page p-3.5 text-[14px] text-ink-2">
            <label
              className={`${secondaryBtn} has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-nets-blue ${preparing ? 'opacity-60' : ''}`}
            >
              <Paperclip className="size-4" aria-hidden="true" />
              {preparing ? 'Getting the file ready…' : 'Add a file'}
              <input
                ref={inputRef}
                type="file"
                name="files"
                multiple
                accept="image/jpeg,image/png,application/pdf"
                onChange={addFiles}
                disabled={preparing}
                aria-describedby={`${ids.help}${fileError ? ` ${ids.files}` : ''}`}
                className="sr-only"
              />
            </label>
            {left === MAX_FILES ? 'JPG, PNG or PDF' : `${left} more ${left === 1 ? 'file' : 'files'} allowed`}
          </div>
        ) : null}
        {fileError ? <p id={ids.files} className={errorText}>{fileError}</p> : null}
      </div>

      {formMessage ? (
        <p role="alert" className="m-0 rounded-lg bg-bad-bg px-3.5 py-2.5 text-[15px] font-medium text-bad">
          {formMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2.5">
        <button type="submit" disabled={busy} className={declineBtn}>
          <Send className="size-4" aria-hidden="true" />
          {sending ? 'Sending…' : 'Send my answer to NETS'}
        </button>
        <button type="button" onClick={onCancel} disabled={sending} className={quietBtn}>
          Cancel
        </button>
      </div>
    </form>
  )
}

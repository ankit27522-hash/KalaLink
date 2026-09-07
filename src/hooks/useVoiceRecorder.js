// src/hooks/useVoiceRecorder.js
//
// Encapsulates the mic-capture lifecycle: requesting permission, recording
// with MediaRecorder, stopping/canceling, and sending the resulting clip to
// the voice-to-text backend. KalaLinkForm just calls toggleRecording(key)
// per field and reacts to activeField/status.
//
// Only one recording is active at a time (matches the original UI, which
// only ever listened on one field via a single SpeechRecognition instance).
// Starting a recording on a different field stops+discards whatever was
// active before.

import { useCallback, useRef, useState } from 'react'
import { transcribeAudio } from '../services/voiceToTextService.js'

export function useVoiceRecorder({ onTranscribed, onError }) {
  const [activeField, setActiveField] = useState(null) // field currently recording
  const [status, setStatus] = useState('idle') // 'idle' | 'recording' | 'transcribing'

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const cancelledRef = useRef(false)

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const stopActiveRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    } else {
      releaseStream()
      setActiveField(null)
      setStatus('idle')
    }
  }, [releaseStream])

  const startRecording = useCallback(
    async (fieldKey) => {
      // Switching fields mid-recording: cancel the old one without sending it.
      if (activeField && activeField !== fieldKey) {
        cancelledRef.current = true
        stopActiveRecording()
      }

      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (err) {
        onError?.(
          "Couldn't access your microphone. Please allow microphone permission and try again."
        )
        return
      }

      streamRef.current = stream
      chunksRef.current = []
      cancelledRef.current = false

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '' // let the browser pick a default if webm isn't supported

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
  releaseStream()
  const wasCancelled = cancelledRef.current
  const chunks = chunksRef.current
  chunksRef.current = []

  if (wasCancelled || chunks.length === 0) {
    setActiveField(null)
    setStatus('idle')
    return
  }

  setStatus('transcribing')
  try {
    const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
    const result = await transcribeAudio(blob)
    if (result.text) {
      onTranscribed?.(fieldKey, result.text)
    } else {
      onError?.("Didn't catch that — no speech detected. Try again.")
    }
  } catch (err) {
    onError?.(err.message || 'Transcription failed. Please try again.')
  } finally {
    setActiveField(null)
    setStatus('idle')
  }
}

      mediaRecorderRef.current = recorder
      recorder.start()
      setActiveField(fieldKey)
      setStatus('recording')
    },
    [activeField, onError, onTranscribed, releaseStream, stopActiveRecording]
  )

  const toggleRecording = useCallback(
    (fieldKey) => {
      if (activeField === fieldKey && status === 'recording') {
        cancelledRef.current = false
        stopActiveRecording()
      } else {
        startRecording(fieldKey)
      }
    },
    [activeField, status, startRecording, stopActiveRecording]
  )

  return { activeField, status, toggleRecording }
}

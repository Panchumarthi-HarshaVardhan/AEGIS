// ============================================================
// JARVIS Guardian AI — Voice Input Hook
// Captures microphone audio via MediaRecorder + AnalyserNode
// and sends to the main process for transcription via IPC
// ============================================================

import { useState, useRef, useCallback, useEffect } from 'react'

export interface UseVoiceReturn {
  isListening: boolean
  isTranscribing: boolean
  transcript: string | null
  error: string | null
  startListening: () => Promise<void>
  stopListening: () => void
  audioLevel: number
}

/**
 * Voice input hook that captures audio from the microphone,
 * visualises audio levels, and sends buffers to the main process
 * for transcription via `window.electronAPI.transcribeAudio`.
 */
export function useVoice(): UseVoiceReturn {
  const [isListening, setIsListening] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>(0)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  /** Poll the analyser node for audio levels and update state */
  const updateAudioLevel = useCallback((): void => {
    const analyser = analyserRef.current
    if (!analyser) return

    const dataArray = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(dataArray)

    // Calculate RMS for a normalized audio level (0..1)
    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128
      sum += normalized * normalized
    }
    const rms = Math.sqrt(sum / dataArray.length)
    const level = Math.min(1, rms * 3) // amplify for visual effect

    setAudioLevel(level)
    animFrameRef.current = requestAnimationFrame(updateAudioLevel)
  }, [])

  /** Start capturing audio from the microphone */
  const startListening = useCallback(async (): Promise<void> => {
    if (isListening || isTranscribing) return

    setError(null)
    setTranscript(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      })

      streamRef.current = stream

      // Set up AudioContext + AnalyserNode for level metering
      const audioCtx = new AudioContext()
      audioContextRef.current = audioCtx

      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)
      analyserRef.current = analyser

      // Start the level polling loop
      animFrameRef.current = requestAnimationFrame(updateAudioLevel)

      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e: BlobEvent): void => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = async (): Promise<void> => {
        // Stop level monitoring
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current)
        }
        setAudioLevel(0)

        // Combine chunks into a single buffer
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const arrayBuffer = await blob.arrayBuffer()

        // Clean up audio resources
        if (audioContextRef.current) {
          await audioContextRef.current.close().catch(() => {})
          audioContextRef.current = null
        }
        analyserRef.current = null

        // Stop all media tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }

        // Send to main process for transcription
        setIsTranscribing(true)
        try {
          const text = await window.electronAPI.transcribeAudio(arrayBuffer)
          setTranscript(text)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Transcription failed'
          setError(message)
          console.error('[useVoice] Transcription error:', err)
        } finally {
          setIsTranscribing(false)
        }
      }

      recorder.start(250) // collect data every 250ms
      setIsListening(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Microphone access denied'
      setError(message)
      console.error('[useVoice] Start error:', err)

      // Clean up on error
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [isListening, isTranscribing, updateAudioLevel])

  /** Stop the MediaRecorder (triggers onstop → transcription) */
  const stopListening = useCallback((): void => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsListening(false)
  }, [])

  return {
    isListening,
    isTranscribing,
    transcript,
    error,
    startListening,
    stopListening,
    audioLevel,
  }
}

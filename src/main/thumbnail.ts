import { spawn } from 'node:child_process'

export class ThumbnailGenerationError extends Error {
  constructor(readonly technicalDetails: string) {
    super('Failed to generate video thumbnail.')
    this.name = 'ThumbnailGenerationError'
  }
}

export function calculateThumbnailTimestamp(duration: number | null): number {
  if (duration === null || !Number.isFinite(duration) || duration <= 0) {
    return 0
  }

  return Math.min(duration * 0.1, 10, duration)
}

export function generateVideoThumbnail(filePath: string, duration: number | null): Promise<string> {
  const timestamp = calculateThumbnailTimestamp(duration)
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-ss',
    timestamp.toFixed(3),
    '-i',
    filePath,
    '-frames:v',
    '1',
    '-an',
    '-vf',
    'scale=640:360:force_original_aspect_ratio=decrease',
    '-f',
    'image2pipe',
    '-vcodec',
    'mjpeg',
    'pipe:1'
  ]

  return new Promise((resolve, reject) => {
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    const ffmpeg = spawn('ffmpeg', args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    ffmpeg.stdout.on('data', (chunk: Buffer) => {
      stdout.push(chunk)
    })

    ffmpeg.stderr.on('data', (chunk: Buffer) => {
      stderr.push(chunk)
    })

    ffmpeg.once('error', (error) => {
      reject(new ThumbnailGenerationError(`Failed to start ffmpeg: ${error.message}`))
    })

    ffmpeg.once('close', (exitCode, signal) => {
      if (exitCode !== 0) {
        const errorOutput = Buffer.concat(stderr).toString('utf8').trim()
        const detail = errorOutput || `Exit code ${String(exitCode)}, signal ${signal ?? 'none'}`
        reject(new ThumbnailGenerationError(`ffmpeg exited unsuccessfully: ${detail}`))
        return
      }

      const jpeg = Buffer.concat(stdout)
      if (jpeg.length === 0) {
        reject(new ThumbnailGenerationError('ffmpeg returned an empty thumbnail buffer.'))
        return
      }

      resolve(`data:image/jpeg;base64,${jpeg.toString('base64')}`)
    })
  })
}

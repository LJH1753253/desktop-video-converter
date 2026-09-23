import { randomUUID } from 'node:crypto'
import { constants, type Stats } from 'node:fs'
import { access, link, rename, stat, unlink } from 'node:fs/promises'
import { dirname, join, parse } from 'node:path'
import type { OutputFormat, VideoConversionErrorCode } from '../shared/video-conversion'

export type CommitMode = 'create' | 'replace'

export interface FileIdentitySnapshot {
  dev: number
  ino: number
  size: number
  mtimeMs: number
}

type OutputStagingErrorCode = Extract<
  VideoConversionErrorCode,
  'OUTPUT_PATH_UNAVAILABLE' | 'OUTPUT_CONFLICT' | 'OUTPUT_COMMIT_FAILED' | 'OUTPUT_REPLACE_FAILED'
>

export class OutputStagingError extends Error {
  constructor(
    readonly code: OutputStagingErrorCode,
    readonly technicalDetails: string
  ) {
    super('Unable to commit staged video output.')
    this.name = 'OutputStagingError'
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

function isMissingFileError(error: unknown): boolean {
  return isNodeError(error) && error.code === 'ENOENT'
}

function outputPathUnavailable(operation: string, filePath: string, error: unknown): never {
  throw new OutputStagingError(
    'OUTPUT_PATH_UNAVAILABLE',
    `${operation} failed for ${filePath}: ${String(error)}`
  )
}

function padTwo(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatLocalTimestamp(date: Date): string {
  return (
    [String(date.getFullYear()), padTwo(date.getMonth() + 1), padTwo(date.getDate())].join('-') +
    `_${padTwo(date.getHours())}-${padTwo(date.getMinutes())}-${padTwo(date.getSeconds())}`
  )
}

export async function getFileIdentity(filePath: string): Promise<FileIdentitySnapshot | null> {
  try {
    const fileStats = await stat(filePath)
    return {
      dev: fileStats.dev,
      ino: fileStats.ino,
      size: fileStats.size,
      mtimeMs: fileStats.mtimeMs
    }
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return null
    }

    outputPathUnavailable('Output path inspection', filePath, error)
  }
}

export async function validateOutputDirectory(finalOutputPath: string): Promise<void> {
  const outputDirectory = dirname(finalOutputPath)

  let directoryStats: Stats
  try {
    directoryStats = await stat(outputDirectory)
  } catch (error: unknown) {
    outputPathUnavailable('Output directory inspection', outputDirectory, error)
  }

  if (!directoryStats.isDirectory()) {
    outputPathUnavailable(
      'Output directory validation',
      outputDirectory,
      new Error('The output parent path is not a directory.')
    )
  }

  try {
    await access(outputDirectory, constants.W_OK)
  } catch (error: unknown) {
    outputPathUnavailable('Output directory write access check', outputDirectory, error)
  }
}

export function hasSameFileIdentity(
  expected: FileIdentitySnapshot,
  actual: FileIdentitySnapshot | null
): boolean {
  return (
    actual !== null &&
    expected.dev === actual.dev &&
    expected.ino === actual.ino &&
    expected.size === actual.size &&
    expected.mtimeMs === actual.mtimeMs
  )
}

async function findAvailablePath(createCandidate: (suffix: string) => string): Promise<string> {
  let suffix = ''
  let index = 0

  while (true) {
    const candidate = createCandidate(suffix)
    const identity = await getFileIdentity(candidate)

    if (identity === null) {
      return candidate
    }

    index += 1
    suffix = ` (${index})`
  }
}

export function createBaseOutputPath(inputPath: string, format: OutputFormat): string {
  const input = parse(inputPath)
  const timestamp = formatLocalTimestamp(new Date())
  return join(input.dir, `${input.name}-converted-${timestamp}.${format}`)
}

export async function createTimestampedDefaultPath(
  inputPath: string,
  format: OutputFormat
): Promise<string> {
  const basePath = createBaseOutputPath(inputPath, format)
  const parsed = parse(basePath)

  return findAvailablePath((suffix) => join(parsed.dir, `${parsed.name}${suffix}${parsed.ext}`))
}

export async function createTempOutputPath(
  finalOutputPath: string,
  format: OutputFormat
): Promise<string> {
  const parsed = parse(finalOutputPath)

  return findAvailablePath(() => join(parsed.dir, `.${parsed.name}.dvc-${randomUUID()}.${format}`))
}

export async function createBackupPath(
  finalOutputPath: string,
  format: OutputFormat
): Promise<string> {
  const parsed = parse(finalOutputPath)

  return findAvailablePath(() =>
    join(parsed.dir, `.${parsed.name}.dvc-backup-${randomUUID()}.${format}`)
  )
}

export async function cleanupStagedFile(filePath: string | null): Promise<void> {
  if (filePath === null) {
    return
  }

  try {
    await unlink(filePath)
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return
    }

    console.warn(`[OUTPUT_CLEANUP_FAILED] Unable to remove staged file: ${filePath}`, error)
  }
}

export async function commitCreate(tempOutputPath: string, finalOutputPath: string): Promise<void> {
  try {
    await link(tempOutputPath, finalOutputPath)
  } catch (error: unknown) {
    throw new OutputStagingError(
      isNodeError(error) && error.code === 'EEXIST' ? 'OUTPUT_CONFLICT' : 'OUTPUT_COMMIT_FAILED',
      `Unable to publish staged output ${tempOutputPath} to ${finalOutputPath}: ${String(error)}`
    )
  }

  await cleanupStagedFile(tempOutputPath)
}

export async function commitReplace(
  tempOutputPath: string,
  finalOutputPath: string,
  originalIdentity: FileIdentitySnapshot,
  backupPath: string
): Promise<void> {
  const initialIdentity = await getFileIdentity(finalOutputPath)
  if (!hasSameFileIdentity(originalIdentity, initialIdentity)) {
    throw new OutputStagingError(
      'OUTPUT_CONFLICT',
      `Final output changed before backup creation: ${finalOutputPath}`
    )
  }

  try {
    await link(finalOutputPath, backupPath)
  } catch (error: unknown) {
    throw new OutputStagingError(
      'OUTPUT_REPLACE_FAILED',
      `Unable to create backup ${backupPath} for ${finalOutputPath}: ${String(error)}`
    )
  }

  const identityBeforeCommit = await getFileIdentity(finalOutputPath)
  if (!hasSameFileIdentity(originalIdentity, identityBeforeCommit)) {
    await cleanupStagedFile(backupPath)
    throw new OutputStagingError(
      'OUTPUT_CONFLICT',
      `Final output changed before replacement commit: ${finalOutputPath}`
    )
  }

  try {
    await rename(tempOutputPath, finalOutputPath)
  } catch (error: unknown) {
    await cleanupStagedFile(tempOutputPath)
    await cleanupStagedFile(backupPath)

    throw new OutputStagingError(
      'OUTPUT_REPLACE_FAILED',
      `Unable to replace ${finalOutputPath} with staged output: ${String(error)}`
    )
  }

  await cleanupStagedFile(tempOutputPath)
  await cleanupStagedFile(backupPath)
}

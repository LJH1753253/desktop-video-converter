declare global {
  interface Window {
    desktopVideoConverter: Readonly<Record<string, never>>
  }
}

export {}

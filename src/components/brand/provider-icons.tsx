// Sign-in provider marks. Their colours are set by Google's and Apple's
// branding rules, the one deliberate exception to "tokens only".

export function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.87c2.27-2.09 3.57-5.17 3.57-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.27v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.27 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.6 4.59 1.8l3.43-3.43A12 12 0 0 0 1.27 6.6l4 3.1C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function AppleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      <path
        fill="currentColor"
        d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79a4.43 4.43 0 0 0-3.74 2.27c-1.6 2.77-.41 6.87 1.15 9.12.76 1.1 1.66 2.33 2.85 2.29 1.14-.05 1.57-.74 2.95-.74 1.38 0 1.77.74 2.97.71 1.23-.02 2.01-1.12 2.76-2.22a9.8 9.8 0 0 0 1.25-2.57 3.98 3.98 0 0 1-2.36-3.64ZM14.1 5.86a4 4 0 0 0 .93-2.86 4.06 4.06 0 0 0-2.63 1.36 3.8 3.8 0 0 0-.96 2.76c1 .08 2.02-.51 2.66-1.26Z"
      />
    </svg>
  );
}

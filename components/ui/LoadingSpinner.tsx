export default function LoadingSpinner() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
    </svg>
  );
}

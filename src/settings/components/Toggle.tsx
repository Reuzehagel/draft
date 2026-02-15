interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, disabled }: ToggleProps): React.ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-5 w-9 shrink-0 items-center rounded-full
        transition-colors duration-200 ease-in-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
        disabled:cursor-not-allowed disabled:opacity-50
        before:absolute before:-inset-2 before:content-['']
        ${checked ? 'bg-primary' : 'bg-input'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-sm ring-0
          transition duration-200 ease-in-out
          ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}
        `}
      />
    </button>
  );
}

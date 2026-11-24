import { useMemo } from 'react';
import zxcvbn from 'zxcvbn';

// Labels for zxcvbn's five guessability scores: https://github.com/dropbox/zxcvbn#usage
const levels = [
  { label: 'Very weak', color: '#ef4444' },
  { label: 'Weak', color: '#f97316' },
  { label: 'Fair', color: '#eab308' },
  { label: 'Strong', color: '#22c55e' },
  { label: 'Very strong', color: '#16a34a' },
];

type Props = { password: string; name: string; email: string; theme: 'dark' | 'light' };

export default function PasswordStrength({ password, name, email, theme }: Props) {
  const { score, feedback } = useMemo(() => {
    // bcrypt uses the first 72 bytes. Skip any UTF-8 character cut off at that boundary.
    const bytes = new TextEncoder().encode(password.slice(0, 72));
    const scoredPassword = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes.subarray(0, 72), { stream: true });
    return zxcvbn(scoredPassword, [...name.trim().split(/\s+/), email, email.split('@')[0]]);
  }, [password, name, email]);
  const { label, color } = levels[score];
  const tip = feedback.warning || feedback.suggestions[0];

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div
        role="meter"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={score}
        aria-valuetext={label}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.25rem' }}
      >
        {levels.map(({ label: level }, index) => (
          <span key={level} style={{ height: '4px', borderRadius: '2px', background: index <= score ? color : theme === 'dark' ? '#444' : '#ddd' }} />
        ))}
      </div>
      <p id="password-strength-feedback" role="status" style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: theme === 'dark' ? '#a0a0a0' : '#555' }}>
        <strong>{label}</strong>{tip && ` · ${tip}`}
      </p>
    </div>
  );
}

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const result = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password, fullName);
    setBusy(false);
    if (result.error) setError(result.error.message);
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.logo}>Mata Villas</div>
        <div style={styles.subtitle}>BuchAI &amp; RMS</div>
        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === 'signup' && (
            <input
              placeholder="Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              style={styles.input}
            />
          )}
          <input
            type="email"
            placeholder="E-Mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={styles.input}
          />
          {error && <div style={styles.error}>{error}</div>}
          <button type="submit" disabled={busy} style={styles.button}>
            {busy ? 'Bitte warten…' : mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
          </button>
        </form>
        <button
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
          style={styles.switchBtn}
        >
          {mode === 'login' ? 'Noch kein Konto? Registrieren' : 'Schon ein Konto? Anmelden'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-primary)' },
  card: { background: 'white', borderRadius: 12, padding: '40px 36px', width: 340, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
  logo: { fontSize: 22, fontWeight: 700, color: 'var(--color-primary)', textAlign: 'center' },
  subtitle: { fontSize: 13, color: 'var(--color-muted)', textAlign: 'center', marginBottom: 24 },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  input: { padding: '10px 12px', fontSize: 14 },
  button: { background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontWeight: 600, marginTop: 6 },
  switchBtn: { background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: 12.5, marginTop: 16, width: '100%' },
  error: { color: 'var(--color-danger)', fontSize: 12.5 },
};

import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Kassenbuch from './pages/Kassenbuch';
import Bankbuch from './pages/Bankbuch';
import Rooms from './pages/Rooms';
import Sales from './pages/Sales';
import Orders from './pages/Orders';
import Zahlungsabgleich from './pages/Zahlungsabgleich';
import Kontenplan from './pages/Kontenplan';

const NAV_ITEMS = [
  { to: '/', label: 'Übersicht', end: true },
  { to: '/kassenbuch', label: 'Kassenbuch' },
  { to: '/bankbuch', label: 'Bankbuch' },
  { to: '/kontenplan', label: 'Kontenplan' },
  { to: '/zahlungsabgleich', label: 'Zahlungsabgleich' },
  { to: '/rooms', label: 'Zimmer' },
  { to: '/sales', label: 'Umsätze' },
  { to: '/orders', label: 'Bestellungen' },
];

function Shell() {
  const { profile, signOut } = useAuth();
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>Mata Villas</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 20 }}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                ...styles.navLink,
                background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                fontWeight: isActive ? 700 : 400,
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <div style={{ fontSize: 12.5, opacity: 0.85 }}>{profile?.full_name || profile?.email}</div>
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 10 }}>{profile?.role}</div>
          <button onClick={signOut} style={styles.logoutBtn}>Abmelden</button>
        </div>
      </aside>
      <main style={styles.main}>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/kassenbuch" element={<Kassenbuch />} />
          <Route path="/bankbuch" element={<Bankbuch />} />
          <Route path="/kontenplan" element={<Kontenplan />} />
          <Route path="/zahlungsabgleich" element={<Zahlungsabgleich />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Gate() {
  const { session, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Lade…</div>;
  return session ? <Shell /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Gate />
      </HashRouter>
    </AuthProvider>
  );
}

const styles = {
  sidebar: {
    width: 220, background: 'var(--color-primary)', color: 'white',
    padding: '24px 18px', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh',
  },
  brand: { fontSize: 17, fontWeight: 700, letterSpacing: 0.2 },
  navLink: { color: 'white', textDecoration: 'none', padding: '9px 12px', borderRadius: 6, fontSize: 13.5 },
  logoutBtn: { background: 'rgba(255,255,255,0.12)', color: 'white', border: 'none', borderRadius: 6, padding: '7px 10px', fontSize: 12.5, width: '100%' },
  main: { flex: 1, padding: '28px 32px', overflow: 'auto' },
};

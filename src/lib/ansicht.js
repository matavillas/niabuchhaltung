import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Merkt sich die Ansicht (Filter, Scrollposition) einer Seite für die Dauer der Browser-Sitzung,
// damit man nach einem Wechsel z. B. Kassenbuch → Bank → Kassenbuch wieder dort landet, wo man war.

function lesen(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw == null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function schreiben(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Speicher nicht verfügbar – dann eben ohne Merken */
  }
}

export function useAnsicht(seite, name, standard) {
  const key = `ansicht:${seite}:${name}`;
  const [wert, setWert] = useState(() => {
    const gespeichert = lesen(key);
    return gespeichert === undefined ? standard : gespeichert;
  });
  useEffect(() => { schreiben(key, wert); }, [key, wert]);
  return [wert, setWert];
}

// Scrollposition der Tabelle merken und wiederherstellen, sobald die Daten geladen sind.
// Gibt einen ref zurück, der an den scrollenden Tabellen-Container gehängt wird.
export function useScrollMerken(seite, bereit) {
  const key = `ansicht:${seite}:scroll`;
  const ref = useRef(null);
  const wiederhergestellt = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!bereit || !el || wiederhergestellt.current) return;
    wiederhergestellt.current = true;
    const pos = lesen(key);
    if (pos && typeof pos.top === 'number') {
      requestAnimationFrame(() => { el.scrollTop = pos.top; el.scrollLeft = pos.left || 0; });
    }
  }, [bereit, key]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let t;
    const beiScroll = () => {
      clearTimeout(t);
      t = setTimeout(() => schreiben(key, { top: el.scrollTop, left: el.scrollLeft }), 150);
    };
    el.addEventListener('scroll', beiScroll, { passive: true });
    return () => {
      clearTimeout(t);
      el.removeEventListener('scroll', beiScroll);
    };
  }, [key, bereit]);

  return ref;
}

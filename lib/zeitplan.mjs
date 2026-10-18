// Täglicher Lauf zur festen Uhrzeit in einer Zeitzone (config.json → zeitplan).

function teile(jetzt, zeitzone) {
  const f = new Intl.DateTimeFormat("sv-SE", {
    timeZone: zeitzone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const [tag, uhr] = f.format(jetzt).split(" ");
  return { tag, uhr };
}

// Heute in der Zeitzone als YYYY-MM-DD.
export function heute(jetzt, zeitzone) {
  return teile(jetzt, zeitzone).tag;
}

// Fällig, wenn heute noch nicht gelaufen und die Uhrzeit (HH:MM) erreicht ist.
export function faellig(jetzt, letzterLauf, uhrzeit, zeitzone) {
  const { tag, uhr } = teile(jetzt, zeitzone);
  return letzterLauf !== tag && uhr >= uhrzeit.padStart(5, "0");
}

// Versatz der Zeitzone gegenüber UTC zum Zeitpunkt `datum`, in Millisekunden (z. B. +2 h im Berliner Sommer).
function versatz(datum, zeitzone) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: zeitzone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const t = Object.fromEntries(f.formatToParts(datum).map((p) => [p.type, Number(p.value)]));
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second) - Math.floor(datum.getTime() / 1000) * 1000;
}

// Ortszeit (Tag YYYY-MM-DD, Uhrzeit HH:MM) in der Zeitzone → Date.
export function ortszeit(tag, uhrzeit, zeitzone) {
  const [j, m, d] = tag.split("-").map(Number);
  const [h, min] = uhrzeit.split(":").map(Number);
  const utc = Date.UTC(j, m - 1, d, h, min);
  // Zweimal rechnen, damit es auch an den Tagen der Zeitumstellung stimmt.
  const erster = utc - versatz(new Date(utc), zeitzone);
  return new Date(utc - versatz(new Date(erster), zeitzone));
}

// Schiebt einen Zeitpunkt ins Zeitfenster (z. B. 09:00–21:00): davor → Beginn am selben Tag, danach → Beginn am nächsten Tag.
export function insZeitfenster(datum, { von, bis, zeitzone }) {
  const { tag, uhr } = teile(datum, zeitzone);
  if (uhr < von.padStart(5, "0")) return ortszeit(tag, von, zeitzone);
  if (uhr > bis.padStart(5, "0")) {
    const morgen = teile(new Date(ortszeit(tag, "12:00", zeitzone).getTime() + 24 * 60 * 60 * 1000), zeitzone).tag;
    return ortszeit(morgen, von, zeitzone);
  }
  return datum;
}

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

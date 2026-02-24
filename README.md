# Taschengeld

Einfaches Haushalt-Tool zum Verwalten von Taschengeld. Kinder können ihren Kontostand und Verlauf einsehen, Eltern können Abbuchungen und Einzahlungen vornehmen sowie Raten verwalten.

## Features

- Guthaben wird on-the-fly berechnet (Startguthaben + Wochenrate × vergangene Wochen − Abbuchungen + Einzahlungen) — kein Cron-Job nötig
- Kinder können Kontostand und Transaktionshistorie ohne Login einsehen
- Abbuchungen, Einzahlungen und Verwaltung sind per Passwort geschützt
- SQLite-Datenbank — keine externe Infrastruktur nötig

## Stack

- [React Router v7](https://reactrouter.com/) (SSR, Loaders/Actions)
- [Drizzle ORM](https://orm.drizzle.team/) + [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Vitest](https://vitest.dev/)

## Einrichtung

### Umgebungsvariablen

`.env` Datei im Projektverzeichnis anlegen:

```
ADMIN_PASSWORD=euer-passwort
SESSION_SECRET=langer-zufaelliger-string
```

### Dependencies installieren

```bash
npm install
```

### Entwicklungsserver starten

```bash
npm run dev
```

Die App ist dann unter `http://localhost:5173` erreichbar.

### Tests ausführen

```bash
npm test
```

## Deployment

### Docker Compose (empfohlen)

**1. Setup-Script ausführen**

```bash
curl -fsSL https://raw.githubusercontent.com/andreashouben/Taschengeld/main/setup.sh | bash
```

Das Script fragt nach dem Eltern-Passwort, generiert einen zufälligen `SESSION_SECRET` und legt `.env` sowie `docker-compose.yml` an.

**2. Starten**

```bash
docker compose up -d
```

Die App läuft auf Port 3000. Die Datenbank liegt persistent in `./data/database.sqlite`.

### Manueller Build (ohne Docker)

```bash
npm install
npm run build
ADMIN_PASSWORD=xxx SESSION_SECRET=yyy npm start
```

Der Server läuft standardmäßig auf Port 3000.

## Projektstruktur

```
app/
├── db/
│   ├── schema.ts          # Drizzle-Schema (children, transactions)
│   └── index.ts           # SQLite-Verbindung
├── lib/
│   ├── balance.ts         # Guthabenberechnung
│   ├── auth.ts            # Session-Auth (requireParent, isParent)
│   └── session.ts         # Cookie-Session-Storage
└── routes/
    ├── _index.tsx          # Dashboard
    ├── kinder.$id.tsx      # Kontostand + Abbuchung/Einzahlung
    ├── kinder.neu.tsx      # Kind anlegen
    ├── kinder.$id_.bearbeiten.tsx  # Kind bearbeiten
    ├── login.tsx           # Eltern-Login
    └── logout.tsx          # Logout
```

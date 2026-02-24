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

## Deployment (Homeserver)

### Docker Compose (empfohlen)

Das ist der einfachste Weg zum Betrieb auf einem Homeserver.

**1. Compose-Datei anlegen**

```bash
cp docker-compose.example.yml docker-compose.yml
```

**2. Zugangsdaten setzen**

`docker-compose.yml` öffnen und die Platzhalter ersetzen:

```yaml
environment:
  ADMIN_PASSWORD: euer-passwort          # Eltern-Login
  SESSION_SECRET: langer-zufaelliger-string  # mind. 32 Zeichen
```

Einen zufälligen `SESSION_SECRET` generieren:

```bash
openssl rand -base64 32
```

**3. Starten**

```bash
mkdir -p data   # Verzeichnis für die Datenbank
docker compose up -d
```

Die App läuft jetzt auf Port 3000. Die Datenbank liegt persistent in `./data/database.sqlite`.

**Updates einspielen**

```bash
docker compose pull
docker compose up -d
```

**Logs ansehen**

```bash
docker compose logs -f
```

**Stoppen**

```bash
docker compose down
```

### Reverse Proxy

Um die App unter einer eigenen Domain erreichbar zu machen, einen Reverse Proxy vorschalten. Beispiel für **Caddy**:

```
taschengeld.example.com {
    reverse_proxy localhost:3000
}
```

Oder **nginx**:

```nginx
server {
    server_name taschengeld.example.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

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

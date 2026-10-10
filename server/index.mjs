import { createServer } from './app.mjs';

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '0.0.0.0';
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
const server = createServer({ databasePath: process.env.DATABASE_PATH });
server.listen(port, host, () => console.log(`Unscroll API listening at http://${host}:${port}. Check /health for the selected grading and speech providers.`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));

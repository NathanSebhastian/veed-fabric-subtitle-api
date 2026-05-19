import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { fal } from '@fal-ai/client';
import { Hono } from 'hono';
import 'dotenv/config';
import generateRouter from './routes/generate.js';

const app = new Hono();
const port = Number.parseInt(process.env.PORT ?? '3000', 10);

fal.config({
  credentials: process.env.FAL_KEY,
});

if (!process.env.FAL_KEY) {
  console.warn('FAL_KEY is not set. /generate will fail until it is configured.');
}

app.route('/', generateRouter);
app.use('/*', serveStatic({ root: './public' }));

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`VEED demo running at http://localhost:${info.port}`);
});

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'samren-api' });
});

app.get('/api/anime', (req, res) => {
  res.json({
    success: true,
    data: {
      items: [],
      total: 0,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      hasNext: false,
    },
  });
});

app.get('/api/anime/:id', (req, res) => {
  res.json({
    success: true,
    data: { id: req.params.id, title: 'Sample Anime' },
  });
});

app.get('/api/search', (req, res) => {
  const { q } = req.query;
  res.json({
    success: true,
    data: { animes: [], total: 0, page: 1, hasNext: false },
  });
});

app.get('/api/schedule', (req, res) => {
  res.json({
    success: true,
    data: { schedule: [], date: new Date().toISOString() },
  });
});

app.get('/api/history/:userId', (req, res) => {
  res.json({
    success: true,
    data: { history: [] },
  });
});

app.get('/api/downloads/:userId', (req, res) => {
  res.json({
    success: true,
    data: { downloads: [] },
  });
});

app.post('/api/downloads', (req, res) => {
  res.json({
    success: true,
    data: { message: 'Download queued', id: 'download-1' },
  });
});

app.delete('/api/downloads/cache/:userId', (req, res) => {
  res.json({
    success: true,
    data: { message: 'Cache cleared' },
  });
});

app.get('/api/favorites/:userId', (req, res) => {
  res.json({
    success: true,
    data: { favorites: [] },
  });
});

app.post('/api/favorites/:userId', (req, res) => {
  res.json({
    success: true,
    data: { message: 'Added to favorites' },
  });
});

app.get('/api/users/:userId/preferences', (req, res) => {
  res.json({
    success: true,
    data: {
      player: 'auto',
      preferredQuality: '1080p',
      theme: 'dark',
      autoplay: true,
      autoNext: true,
      autoSkipIntro: false,
      autoSkipOutro: false,
      language: 'en',
      subtitles: true,
      dub: false,
    },
  });
});

app.patch('/api/users/:userId/preferences', (req, res) => {
  res.json({
    success: true,
    data: { ...req.body },
  });
});

const server = app.listen(PORT, () => {
  console.log(`Samren API Gateway running on port ${PORT}`);
});

export { app, server };

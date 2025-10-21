import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dashboardRouter from './routes/dashboard.js';
import duplicatesRouter from './routes/duplicates.js';
import viewRouter from './routes/view.js';
import infoRouter from './routes/info.js';

const app = express();
const HOST = process.env.HOST || 'localhost';
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', dashboardRouter);
app.use('/duplicates', duplicatesRouter);
app.use('/view', viewRouter);
app.use('/info', infoRouter);

app.listen(PORT, () => {
  console.log(`🌀 Server running at http://${HOST}:${PORT}`);
});

process.on('SIGINT', async () => {
    console.log('Caught Ctrl+C (SIGINT). Cleaning up...');
    // Perform cleanup here (e.g., close DB, stop server)
    process.exit(0); // Exit gracefully
  });
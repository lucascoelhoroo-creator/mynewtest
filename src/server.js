import { createApp } from './app.js';

const app = createApp();

const port = process.env.PORT || 3000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`AB Jump prototype running on http://localhost:${port}`);
});

// ecosystem.config.js — PM2 configuration for Smart Rescuer Ring
// Place this file in the project root on your VPS.
// Usage:
//   pm2 start ecosystem.config.js          # first launch
//   pm2 restart smart-rescuer-ring         # after redeploy
//   pm2 save                               # persist across VPS reboots
//   pm2 startup                            # auto-start on boot

module.exports = {
  apps: [
    {
      // ── Identity ──────────────────────────────────────────────────────────
      name: "smart-rescuer-ring",
      script: "server_dist/index.js", // compiled output from npm run server:build

      // ── Runtime ───────────────────────────────────────────────────────────
      interpreter: "node",
      node_args: "--experimental-vm-modules", // needed for ESM bundle (esbuild --format=esm)

      // ── Scaling ───────────────────────────────────────────────────────────
      instances: 1,      // single instance — change to "max" for cluster mode if your VPS has multiple cores
      exec_mode: "fork", // use "cluster" if you set instances > 1

      // ── Environment ───────────────────────────────────────────────────────
      env: {
        NODE_ENV: "production",
        PORT: 5000,
        HOST: "0.0.0.0",
      },
      // PM2 loads the .env file from the project root automatically when using env_file:
      env_file: ".env",

      // ── Reliability ───────────────────────────────────────────────────────
      watch: false,         // never watch in production — PM2 would restart on every file change
      max_memory_restart: "400M", // auto-restart if memory exceeds 400 MB (Hostinger VPS safety)
      restart_delay: 3000,  // wait 3 s between auto-restarts
      max_restarts: 10,     // stop restarting after 10 consecutive failures
      min_uptime: "10s",    // process must stay alive 10 s to count as a successful start

      // ── Logs ─────────────────────────────────────────────────────────────
      out_file: "./logs/pm2-out.log",
      error_file: "./logs/pm2-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },
  ],
};

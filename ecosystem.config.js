// PM2 ecosystem — cohérent avec PairsForm (port 3001) et Partiprism (port 3002)
module.exports = {
  apps: [
    {
      name: 'cuistot-api',
      script: 'apps/api/dist/index.js',
      cwd: '/var/www/cuistot_fute',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env_file: 'apps/api/.env',
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
      },
      error_file: '/var/log/pm2/cuistot-api-error.log',
      out_file: '/var/log/pm2/cuistot-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // Timeout HTTP long pour les appels LLM (génération plan ~30-40s)
      kill_timeout: 10000,
    },
  ],
}

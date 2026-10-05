module.exports = {
  apps: [
    {
      name: 'kaitoon-backend',
      script: '/root/kaitoon/server.py',
      interpreter: 'python3',
      args: '--host 0.0.0.0 --port 9000',
      cwd: '/root/kaitoon',
      env: {
        PYTHONPATH: '/root',
        PORT: '9000'
      },
      restart_delay: 2000,
      autorestart: true
    },
    {
      name: 'kaitoon-frontend',
      script: '/root/kaitoon/frontend/serve.js',
      cwd: '/root/kaitoon/frontend',
      env: {
        NODE_ENV: 'production',
        PORT: '5555'
      },
      restart_delay: 2000,
      autorestart: true
    }
  ]
};

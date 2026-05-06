module.exports = {
  apps: [{
    name: 'glory-pharmacy',
    script: 'server.js',
    cwd: '/home/ec2-user/glory-pharmacy/backend',
    env: {
      NODE_ENV: 'production',
      PORT: 5002
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/home/ec2-user/glory-pharmacy/logs/error.log',
    out_file: '/home/ec2-user/glory-pharmacy/logs/output.log',
  }]
};

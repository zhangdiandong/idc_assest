module.exports = {
  "apps": [
    {
      "name": "idc-backend",
      "script": "./server.js",
      "cwd": "/root/idc_assest/backend",
      "instances": 1,
      "exec_mode": "fork",
      "env": {
        "NODE_ENV": "production",
        "PORT": 8000
      },
      "max_memory_restart": "1G",
      "log_file": "/root/idc_assest/backend/logs/combined.log",
      "out_file": "/root/idc_assest/backend/logs/out.log",
      "error_file": "/root/idc_assest/backend/logs/error.log",
      "log_date_format": "YYYY-MM-DD HH:mm:ss Z",
      "merge_logs": true,
      "autorestart": true
    },
    {
      "name": "idc-frontend",
      "script": "server.prod.js",
      "cwd": "/root/idc_assest/frontend",
      "instances": 1,
      "exec_mode": "fork",
      "env": {
        "NODE_ENV": "production",
        "FRONT_PORT": 8080,
        "BACKEND_TARGET": "http://localhost:8000"
      },
      "max_memory_restart": "500M",
      "autorestart": true
    }
  ]
};
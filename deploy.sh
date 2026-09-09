#!/bin/bash

# HelpDesk API Deployment Script
# Usage: ./deploy.sh <VM_USER> <VM_HOST> <REMOTE_PATH>

VM_USER=${1:-azureuser}
VM_HOST=${2:-your-vm-ip}
REMOTE_PATH=${3:-/home/azureuser/helpdesk-api}

echo "Deploying HelpDesk API to ${VM_USER}@${VM_HOST}:${REMOTE_PATH}"

# Upload project files (exclude node_modules, .env, .git)
echo "Uploading files..."
scp -r \
  app.js \
  package.json \
  package-lock.json \
  prisma/ \
  routes/ \
  middleware/ \
  services/ \
  ${VM_USER}@${VM_HOST}:${REMOTE_PATH}/

# Run remote setup commands
echo "Running remote setup..."
ssh ${VM_USER}@${VM_HOST} << 'EOF'
  cd ${REMOTE_PATH}

  # Install dependencies
  npm install --production

  # Generate Prisma client
  npx prisma generate

  # Run database migrations
  npx prisma migrate deploy

  # Restart with PM2
  pm2 restart helpdesk-api || pm2 start app.js --name helpdesk-api
  pm2 save

  echo "Deployment complete!"
EOF

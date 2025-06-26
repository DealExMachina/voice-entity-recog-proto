#!/bin/bash
set -e

echo "🐳 Sales Buddy Docker Deployment Script"
echo "========================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "📋 Please create a .env file from docker.env.example:"
    echo "   cp docker.env.example .env"
    echo "   # Then edit .env with your actual API keys"
    exit 1
fi

# Check if OPENAI_API_KEY is set
if ! grep -q "OPENAI_API_KEY=" .env || grep -q "OPENAI_API_KEY=your_openai_api_key_here" .env; then
    echo "❌ OPENAI_API_KEY is not set in .env file!"
    echo "📝 Please edit .env and set your OpenAI API key"
    exit 1
fi

echo "🔨 Building and deploying Sales Buddy..."

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down --remove-orphans || true

# Remove old images (optional - comment out if you want to keep them)
echo "🧹 Cleaning up old images..."
docker-compose down --rmi local --remove-orphans || true

# Build and start containers
echo "🏗️  Building application..."
docker-compose build --no-cache

echo "🚀 Starting services..."
docker-compose up -d

# Wait for health check
echo "⏳ Waiting for application to be healthy..."
timeout=120
counter=0

while [ $counter -lt $timeout ]; do
    if docker-compose ps | grep -q "healthy"; then
        echo "✅ Application is healthy!"
        break
    fi
    
    if [ $counter -eq 0 ]; then
        echo "   Checking health status..."
    fi
    
    sleep 2
    counter=$((counter + 2))
    
    if [ $((counter % 20)) -eq 0 ]; then
        echo "   Still waiting... ($counter/$timeout seconds)"
    fi
done

if [ $counter -ge $timeout ]; then
    echo "❌ Application failed to become healthy within $timeout seconds"
    echo "📋 Checking logs:"
    docker-compose logs --tail=20
    exit 1
fi

# Show status
echo ""
echo "🎉 Deployment successful!"
echo "========================================"
echo "📊 Application Status:"
docker-compose ps

echo ""
echo "🌐 Application URL: http://localhost:3000"
echo "🏥 Health Check: http://localhost:3000/api/health"
echo ""
echo "📋 Useful commands:"
echo "   View logs:        docker-compose logs -f"
echo "   Stop application: docker-compose down"
echo "   Restart:          docker-compose restart"
echo "   Update:           ./scripts/deploy-docker.sh"
echo "" 
#!/bin/bash

# StellarRec Production Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CLUSTER_NAME="stellarrec-production"
AWS_REGION="us-west-2"
NAMESPACE="stellarrec-production"
MONITORING_NAMESPACE="stellarrec-monitoring"

echo -e "${BLUE}🚀 Starting StellarRec Production Deployment${NC}"
echo "=================================================="

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

# Check if required tools are installed
command -v kubectl >/dev/null 2>&1 || { print_error "kubectl is required but not installed. Aborting."; exit 1; }
command -v aws >/dev/null 2>&1 || { print_error "AWS CLI is required but not installed. Aborting."; exit 1; }
command -v terraform >/dev/null 2>&1 || { print_error "Terraform is required but not installed. Aborting."; exit 1; }
command -v docker >/dev/null 2>&1 || { print_error "Docker is required but not installed. Aborting."; exit 1; }

print_status "All required tools are installed"

# Check AWS credentials
aws sts get-caller-identity >/dev/null 2>&1 || { print_error "AWS credentials not configured. Aborting."; exit 1; }
print_status "AWS credentials configured"

# Step 1: Deploy Infrastructure with Terraform
echo -e "\n${BLUE}🏗️  Step 1: Deploying infrastructure with Terraform...${NC}"
cd terraform/production

# Initialize Terraform
terraform init

# Plan the deployment
terraform plan -out=tfplan

# Apply the infrastructure
terraform apply tfplan

# Get outputs
CLUSTER_ENDPOINT=$(terraform output -raw cluster_endpoint)
DATABASE_ENDPOINT=$(terraform output -raw database_endpoint)
REDIS_ENDPOINT=$(terraform output -raw redis_endpoint)

print_status "Infrastructure deployed successfully"

# Step 2: Configure kubectl
echo -e "\n${BLUE}⚙️  Step 2: Configuring kubectl...${NC}"
aws eks update-kubeconfig --region $AWS_REGION --name $CLUSTER_NAME
print_status "kubectl configured for EKS cluster"

# Step 3: Create namespaces
echo -e "\n${BLUE}📁 Step 3: Creating namespaces...${NC}"
kubectl apply -f ../k8s/production/namespace.yaml
print_status "Namespaces created"

# Step 4: Deploy secrets
echo -e "\n${BLUE}🔐 Step 4: Deploying secrets...${NC}"

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Create database secret
kubectl create secret generic database-secret \
  --from-literal=url="postgresql://stellarrec_admin:$(terraform output -raw database_password)@$DATABASE_ENDPOINT:5432/stellarrec" \
  --from-literal=host="$DATABASE_ENDPOINT" \
  --from-literal=port="5432" \
  --from-literal=database="stellarrec" \
  --from-literal=username="stellarrec_admin" \
  --from-literal=password="$(terraform output -raw database_password)" \
  --namespace=$NAMESPACE \
  --dry-run=client -o yaml | kubectl apply -f -

# Create Redis secret
kubectl create secret generic redis-secret \
  --from-literal=url="redis://$REDIS_ENDPOINT:6379" \
  --from-literal=host="$REDIS_ENDPOINT" \
  --from-literal=port="6379" \
  --namespace=$NAMESPACE \
  --dry-run=client -o yaml | kubectl apply -f -

# Create JWT secret
kubectl create secret generic jwt-secret \
  --from-literal=secret="$JWT_SECRET" \
  --namespace=$NAMESPACE \
  --dry-run=client -o yaml | kubectl apply -f -

print_status "Secrets deployed"

# Step 5: Build and push Docker images
echo -e "\n${BLUE}🐳 Step 5: Building and pushing Docker images...${NC}"

# Get ECR login
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com

# Build and push images for each service
SERVICES=("api-gateway" "user-service" "ai-service" "application-service" "letter-service" "timeline-service" "collaboration-service" "ai-writing-assistant" "file-management" "document-processing" "search-service" "content-discovery" "analytics-service" "predictive-analytics" "notification-service" "reminder-service" "monitoring-service")

for service in "${SERVICES[@]}"; do
    echo "Building $service..."
    
    # Build the image
    docker build -t stellarrec/$service:latest ../../services/$service/
    
    # Tag for ECR
    docker tag stellarrec/$service:latest $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com/stellarrec/$service:latest
    
    # Push to ECR
    docker push $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com/stellarrec/$service:latest
    
    print_status "$service image built and pushed"
done

# Step 6: Deploy applications
echo -e "\n${BLUE}🚀 Step 6: Deploying applications...${NC}"

# Deploy API Gateway
kubectl apply -f ../k8s/production/api-gateway.yaml

# Deploy AI Service
kubectl apply -f ../k8s/production/ai-service.yaml

# Wait for deployments to be ready
echo "Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/api-gateway -n $NAMESPACE
kubectl wait --for=condition=available --timeout=300s deployment/ai-service -n $NAMESPACE

print_status "Applications deployed successfully"

# Step 7: Deploy monitoring
echo -e "\n${BLUE}📊 Step 7: Deploying monitoring stack...${NC}"

# Create monitoring namespace if it doesn't exist
kubectl create namespace $MONITORING_NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Deploy Prometheus
kubectl apply -f ../monitoring/prometheus-config.yaml

# Deploy Grafana
kubectl apply -f ../monitoring/grafana-config.yaml

print_status "Monitoring stack deployed"

# Step 8: Run health checks
echo -e "\n${BLUE}🏥 Step 8: Running health checks...${NC}"

# Wait for services to be ready
sleep 30

# Check API Gateway health
API_GATEWAY_URL=$(kubectl get ingress api-gateway-ingress -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

if [ ! -z "$API_GATEWAY_URL" ]; then
    echo "Checking API Gateway health at $API_GATEWAY_URL..."
    
    # Wait for DNS propagation
    sleep 60
    
    # Health check with retry
    for i in {1..5}; do
        if curl -f -s "http://$API_GATEWAY_URL/health" > /dev/null; then
            print_status "API Gateway health check passed"
            break
        else
            print_warning "Health check attempt $i failed, retrying..."
            sleep 30
        fi
    done
else
    print_warning "API Gateway URL not available yet"
fi

# Step 9: Run integration tests
echo -e "\n${BLUE}🧪 Step 9: Running integration tests...${NC}"

# Run integration tests from the integration module
cd ../../integration
npm install
npm run test:integration

print_status "Integration tests completed"

# Step 10: Final validation
echo -e "\n${BLUE}✅ Step 10: Final validation...${NC}"

# Check all deployments
echo "Checking deployment status..."
kubectl get deployments -n $NAMESPACE
kubectl get services -n $NAMESPACE
kubectl get ingress -n $NAMESPACE

# Check monitoring
echo "Checking monitoring stack..."
kubectl get deployments -n $MONITORING_NAMESPACE

print_status "Deployment validation completed"

# Summary
echo -e "\n${GREEN}🎉 DEPLOYMENT COMPLETED SUCCESSFULLY! 🎉${NC}"
echo "=============================================="
echo "Cluster: $CLUSTER_NAME"
echo "Region: $AWS_REGION"
echo "Namespace: $NAMESPACE"
echo "API Gateway: http://$API_GATEWAY_URL"
echo "Grafana: $(kubectl get service grafana -n $MONITORING_NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'):3000"
echo ""
echo "Next steps:"
echo "1. Configure DNS records to point to the load balancer"
echo "2. Set up SSL certificates"
echo "3. Configure monitoring alerts"
echo "4. Run user acceptance testing"
echo ""
echo -e "${BLUE}📚 Check the operational runbook for post-deployment procedures${NC}"

exit 0
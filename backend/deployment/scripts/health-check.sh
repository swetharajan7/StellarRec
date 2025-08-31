#!/bin/bash

# StellarRec Production Health Check Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="stellarrec-production"
MONITORING_NAMESPACE="stellarrec-monitoring"

echo -e "${BLUE}🏥 StellarRec Production Health Check${NC}"
echo "====================================="

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

# Check if kubectl is configured
if ! kubectl cluster-info >/dev/null 2>&1; then
    print_error "kubectl is not configured or cluster is not accessible"
    exit 1
fi

print_status "Kubernetes cluster is accessible"

# Check namespace
if ! kubectl get namespace $NAMESPACE >/dev/null 2>&1; then
    print_error "Namespace $NAMESPACE does not exist"
    exit 1
fi

print_status "Namespace $NAMESPACE exists"

# Check deployments
echo -e "\n${BLUE}📋 Checking deployments...${NC}"

DEPLOYMENTS=$(kubectl get deployments -n $NAMESPACE -o jsonpath='{.items[*].metadata.name}')
FAILED_DEPLOYMENTS=()

for deployment in $DEPLOYMENTS; do
    READY=$(kubectl get deployment $deployment -n $NAMESPACE -o jsonpath='{.status.readyReplicas}')
    DESIRED=$(kubectl get deployment $deployment -n $NAMESPACE -o jsonpath='{.spec.replicas}')
    
    if [ "$READY" = "$DESIRED" ] && [ "$READY" != "0" ]; then
        print_status "$deployment: $READY/$DESIRED replicas ready"
    else
        print_error "$deployment: $READY/$DESIRED replicas ready"
        FAILED_DEPLOYMENTS+=($deployment)
    fi
done

# Check services
echo -e "\n${BLUE}🌐 Checking services...${NC}"

SERVICES=$(kubectl get services -n $NAMESPACE -o jsonpath='{.items[*].metadata.name}')

for service in $SERVICES; do
    ENDPOINTS=$(kubectl get endpoints $service -n $NAMESPACE -o jsonpath='{.subsets[*].addresses[*].ip}' | wc -w)
    
    if [ "$ENDPOINTS" -gt 0 ]; then
        print_status "$service: $ENDPOINTS endpoints available"
    else
        print_error "$service: No endpoints available"
    fi
done

# Check ingress
echo -e "\n${BLUE}🚪 Checking ingress...${NC}"

if kubectl get ingress api-gateway-ingress -n $NAMESPACE >/dev/null 2>&1; then
    INGRESS_HOST=$(kubectl get ingress api-gateway-ingress -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
    
    if [ ! -z "$INGRESS_HOST" ]; then
        print_status "Ingress: $INGRESS_HOST"
        
        # Test API Gateway health endpoint
        echo "Testing API Gateway health endpoint..."
        if curl -f -s --max-time 10 "http://$INGRESS_HOST/health" >/dev/null 2>&1; then
            print_status "API Gateway health endpoint responding"
        else
            print_warning "API Gateway health endpoint not responding"
        fi
    else
        print_warning "Ingress host not available"
    fi
else
    print_error "API Gateway ingress not found"
fi

# Check persistent volumes
echo -e "\n${BLUE}💾 Checking persistent volumes...${NC}"

PVS=$(kubectl get pv -o jsonpath='{.items[?(@.spec.claimRef.namespace=="'$NAMESPACE'")].metadata.name}')

for pv in $PVS; do
    STATUS=$(kubectl get pv $pv -o jsonpath='{.status.phase}')
    
    if [ "$STATUS" = "Bound" ]; then
        print_status "PV $pv: $STATUS"
    else
        print_error "PV $pv: $STATUS"
    fi
done

# Check secrets
echo -e "\n${BLUE}🔐 Checking secrets...${NC}"

REQUIRED_SECRETS=("database-secret" "redis-secret" "jwt-secret")

for secret in "${REQUIRED_SECRETS[@]}"; do
    if kubectl get secret $secret -n $NAMESPACE >/dev/null 2>&1; then
        print_status "Secret $secret exists"
    else
        print_error "Secret $secret missing"
    fi
done

# Check monitoring
echo -e "\n${BLUE}📊 Checking monitoring stack...${NC}"

if kubectl get namespace $MONITORING_NAMESPACE >/dev/null 2>&1; then
    # Check Prometheus
    if kubectl get deployment prometheus -n $MONITORING_NAMESPACE >/dev/null 2>&1; then
        PROMETHEUS_READY=$(kubectl get deployment prometheus -n $MONITORING_NAMESPACE -o jsonpath='{.status.readyReplicas}')
        if [ "$PROMETHEUS_READY" = "1" ]; then
            print_status "Prometheus: Ready"
        else
            print_error "Prometheus: Not ready"
        fi
    else
        print_error "Prometheus deployment not found"
    fi
    
    # Check Grafana
    if kubectl get deployment grafana -n $MONITORING_NAMESPACE >/dev/null 2>&1; then
        GRAFANA_READY=$(kubectl get deployment grafana -n $MONITORING_NAMESPACE -o jsonpath='{.status.readyReplicas}')
        if [ "$GRAFANA_READY" = "1" ]; then
            print_status "Grafana: Ready"
        else
            print_error "Grafana: Not ready"
        fi
    else
        print_error "Grafana deployment not found"
    fi
else
    print_error "Monitoring namespace not found"
fi

# Check resource usage
echo -e "\n${BLUE}📈 Checking resource usage...${NC}"

# Get node resource usage
echo "Node resource usage:"
kubectl top nodes 2>/dev/null || print_warning "Metrics server not available"

# Get pod resource usage
echo "Pod resource usage (top 10):"
kubectl top pods -n $NAMESPACE --sort-by=cpu 2>/dev/null | head -10 || print_warning "Pod metrics not available"

# Check for pod restarts
echo -e "\n${BLUE}🔄 Checking for pod restarts...${NC}"

PODS_WITH_RESTARTS=$(kubectl get pods -n $NAMESPACE -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.status.containerStatuses[0].restartCount}{"\n"}{end}' | awk '$2 > 0')

if [ -z "$PODS_WITH_RESTARTS" ]; then
    print_status "No pods with restarts"
else
    print_warning "Pods with restarts:"
    echo "$PODS_WITH_RESTARTS"
fi

# Check for failed pods
echo -e "\n${BLUE}❌ Checking for failed pods...${NC}"

FAILED_PODS=$(kubectl get pods -n $NAMESPACE --field-selector=status.phase=Failed -o jsonpath='{.items[*].metadata.name}')

if [ -z "$FAILED_PODS" ]; then
    print_status "No failed pods"
else
    print_error "Failed pods: $FAILED_PODS"
fi

# Summary
echo -e "\n${BLUE}📋 Health Check Summary${NC}"
echo "========================"

if [ ${#FAILED_DEPLOYMENTS[@]} -eq 0 ]; then
    print_status "All deployments are healthy"
    OVERALL_STATUS="HEALTHY"
else
    print_error "Failed deployments: ${FAILED_DEPLOYMENTS[*]}"
    OVERALL_STATUS="UNHEALTHY"
fi

# Generate health report
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
REPORT_FILE="/tmp/stellarrec-health-report-$(date +%Y%m%d-%H%M%S).txt"

cat > $REPORT_FILE << EOF
StellarRec Production Health Report
Generated: $TIMESTAMP

Overall Status: $OVERALL_STATUS

Deployments:
$(kubectl get deployments -n $NAMESPACE)

Services:
$(kubectl get services -n $NAMESPACE)

Ingress:
$(kubectl get ingress -n $NAMESPACE)

Recent Events:
$(kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp' | tail -10)

Resource Usage:
$(kubectl top nodes 2>/dev/null || echo "Metrics not available")

Pod Status:
$(kubectl get pods -n $NAMESPACE)
EOF

echo "Health report saved to: $REPORT_FILE"

# Exit with appropriate code
if [ "$OVERALL_STATUS" = "HEALTHY" ]; then
    echo -e "\n${GREEN}🎉 System is healthy!${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  System has issues that need attention${NC}"
    exit 1
fi
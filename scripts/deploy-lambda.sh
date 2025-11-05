#!/bin/bash

# Lambda Deployment Script for DreamUp
# 
# This script builds and deploys DreamUp to AWS Lambda.
# 
# Prerequisites:
# - AWS CLI installed and configured
# - Bun runtime installed locally
# - IAM role with Lambda permissions
# 
# Usage:
#   ./scripts/deploy-lambda.sh [function-name] [region]

set -e

FUNCTION_NAME="${1:-dreamup-qa-agent}"
REGION="${2:-us-east-1}"
BUILD_DIR="dist"
PACKAGE_DIR="lambda-package"

echo "🚀 Deploying DreamUp to AWS Lambda"
echo "Function Name: $FUNCTION_NAME"
echo "Region: $REGION"
echo ""

# Check prerequisites
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install AWS CLI."
    exit 1
fi

if ! command -v bun &> /dev/null; then
    echo "❌ Bun not found. Please install Bun runtime."
    exit 1
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf "$BUILD_DIR" "$PACKAGE_DIR"
mkdir -p "$BUILD_DIR" "$PACKAGE_DIR"

# Build TypeScript
echo "📦 Building TypeScript..."
bun run build

# Copy built files
echo "📋 Copying files to package..."
cp -r "$BUILD_DIR"/* "$PACKAGE_DIR/"
cp package.json "$PACKAGE_DIR/"

# Install production dependencies (Bun runtime)
echo "📥 Installing dependencies..."
cd "$PACKAGE_DIR"
bun install --production

# Create deployment package
echo "📦 Creating deployment package..."
cd ..
zip -r "$PACKAGE_DIR.zip" "$PACKAGE_DIR" -q

# Check if function exists
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" &> /dev/null; then
    echo "🔄 Updating existing function..."
    aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --zip-file "fileb://$PACKAGE_DIR.zip" \
        --region "$REGION" \
        --output json > /dev/null
else
    echo "⚠️  Function $FUNCTION_NAME not found."
    echo "Please create the function first using:"
    echo "  aws lambda create-function --function-name $FUNCTION_NAME --runtime provided.al2 --role <IAM-ROLE-ARN> --handler dist/main.handler --zip-file fileb://$PACKAGE_DIR.zip --region $REGION"
    echo ""
    echo "Or use the AWS Console/CloudFormation to create the function."
    exit 1
fi

# Update environment variables (if .env exists)
if [ -f .env ]; then
    echo "🔧 Updating environment variables..."
    # Extract environment variables from .env (excluding comments and empty lines)
    ENV_VARS=$(grep -v '^#' .env | grep -v '^$' | sed 's/^/"/' | sed 's/=.*$//' | tr '\n' ',' | sed 's/,$//')
    
    # Note: This is a simplified version. For production, use AWS Secrets Manager or Parameter Store.
    echo "⚠️  Note: Environment variables should be set manually via AWS Console or:"
    echo "  aws lambda update-function-configuration --function-name $FUNCTION_NAME --environment Variables={$(cat .env | grep -v '^#' | grep -v '^$' | tr '\n' ',' | sed 's/,$//')} --region $REGION"
fi

# Update function configuration
echo "⚙️  Updating function configuration..."
aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --timeout 600 \
    --memory-size 2048 \
    --region "$REGION" \
    --output json > /dev/null

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Test the function with:"
echo "  aws lambda invoke --function-name $FUNCTION_NAME --region $REGION --payload '{\"gameUrl\":\"https://example.com/game\"}' response.json"
echo ""
echo "Or use the AWS Console to test the function."
echo ""
echo "📊 View logs:"
echo "  aws logs tail /aws/lambda/$FUNCTION_NAME --follow --region $REGION"

# Cleanup
echo "🧹 Cleaning up..."
rm -rf "$PACKAGE_DIR" "$PACKAGE_DIR.zip"

echo ""
echo "✨ Done!"


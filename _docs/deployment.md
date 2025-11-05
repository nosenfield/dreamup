# Deployment Guide

Complete guide for deploying DreamUp to AWS Lambda.

## Table of Contents

- [Prerequisites](#prerequisites)
- [IAM Role Setup](#iam-role-setup)
- [Lambda Function Creation](#lambda-function-creation)
- [Deployment Steps](#deployment-steps)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [Monitoring and Logging](#monitoring-and-logging)
- [Cost Optimization](#cost-optimization)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying, ensure you have:

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured
   ```bash
   aws configure
   ```
3. **Bun Runtime** installed locally (for building)
4. **IAM Role** with Lambda execution permissions (see below)
5. **API Keys** ready:
   - Browserbase API key
   - Browserbase Project ID
   - OpenAI API key

## IAM Role Setup

Create an IAM role for Lambda execution:

### 1. Create IAM Role

**Via AWS Console:**
1. Go to IAM → Roles → Create Role
2. Select "AWS Service" → "Lambda"
3. Attach policies:
   - `AWSLambdaBasicExecutionRole` (for CloudWatch Logs)
   - (Optional) Custom policy for VPC access if needed

**Via AWS CLI:**
```bash
# Create role
aws iam create-role \
  --role-name lambda-execution-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach execution policy
aws iam attach-role-policy \
  --role-name lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

### 2. Get Role ARN

```bash
aws iam get-role --role-name lambda-execution-role --query 'Role.Arn' --output text
```

Save this ARN for use in Lambda configuration.

## Lambda Function Creation

### Option 1: Create Function First (Recommended)

Create the function with minimal configuration, then deploy code:

```bash
# Update scripts/lambda-config.json with your values
# Then create function:
aws lambda create-function \
  --function-name dreamup-qa-agent \
  --runtime provided.al2 \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-execution-role \
  --handler dist/main.handler \
  --zip-file fileb://scripts/dummy.zip \
  --timeout 600 \
  --memory-size 2048 \
  --region us-east-1
```

**Note:** You'll need to create a dummy zip file first, or skip this step and use Option 2.

### Option 2: Deploy Script Handles Updates

If the function already exists, the deployment script will update it automatically.

## Deployment Steps

### 1. Build and Package

The deployment script handles building and packaging:

```bash
./scripts/deploy-lambda.sh [function-name] [region]
```

**Example:**
```bash
./scripts/deploy-lambda.sh dreamup-qa-agent us-east-1
```

**What the script does:**
1. Builds TypeScript (`bun run build`)
2. Copies files to package directory
3. Installs production dependencies
4. Creates deployment ZIP
5. Updates Lambda function code
6. Updates function configuration (timeout, memory)
7. Cleans up temporary files

### 2. Manual Deployment (Alternative)

If you prefer manual deployment:

```bash
# Build
bun run build

# Package
cd dist
zip -r ../lambda-package.zip . ../package.json
cd ..

# Deploy
aws lambda update-function-code \
  --function-name dreamup-qa-agent \
  --zip-file fileb://lambda-package.zip \
  --region us-east-1
```

## Environment Variables

Set environment variables for the Lambda function:

### Via AWS Console

1. Go to Lambda → Functions → dreamup-qa-agent → Configuration → Environment variables
2. Add variables:
   - `BROWSERBASE_API_KEY`
   - `BROWSERBASE_PROJECT_ID`
   - `OPENAI_API_KEY`
   - `DEBUG` (optional, default: false)
   - Other feature flags and timeouts as needed

### Via AWS CLI

```bash
aws lambda update-function-configuration \
  --function-name dreamup-qa-agent \
  --environment Variables="{
    BROWSERBASE_API_KEY=your_key,
    BROWSERBASE_PROJECT_ID=your_project_id,
    OPENAI_API_KEY=your_openai_key,
    DEBUG=false
  }" \
  --region us-east-1
```

### Via AWS Secrets Manager (Recommended for Production)

For production, use AWS Secrets Manager:

1. Store secrets in Secrets Manager:
   ```bash
   aws secretsmanager create-secret \
     --name dreamup/api-keys \
     --secret-string '{
       "BROWSERBASE_API_KEY": "your_key",
       "BROWSERBASE_PROJECT_ID": "your_project_id",
       "OPENAI_API_KEY": "your_openai_key"
     }'
   ```

2. Grant Lambda role access:
   ```bash
   aws secretsmanager put-resource-policy \
     --secret-id dreamup/api-keys \
     --resource-policy '{
       "Version": "2012-10-17",
       "Statement": [{
         "Effect": "Allow",
         "Principal": {"AWS": "arn:aws:iam::ACCOUNT_ID:role/lambda-execution-role"},
         "Action": "secretsmanager:GetSecretValue",
         "Resource": "*"
       }]
     }'
   ```

3. Update Lambda code to fetch secrets from Secrets Manager (future enhancement)

## Testing

### Test via AWS Console

1. Go to Lambda → Functions → dreamup-qa-agent → Test
2. Create test event:
   ```json
   {
     "gameUrl": "https://example.com/game",
     "metadata": {
       "metadataVersion": "1.0.0",
       "genre": "arcade",
       "inputSchema": {
         "type": "javascript",
         "content": "gameBuilder.createAction('Jump').bindKey('Space')"
       }
     }
   }
   ```
3. Click "Test" and review results

### Test via AWS CLI

```bash
# Create test event file
cat > test-event.json << EOF
{
  "gameUrl": "https://example.com/game",
  "metadata": {
    "metadataVersion": "1.0.0",
    "inputSchema": {
      "type": "semantic",
      "content": "Use arrow keys to move"
    }
  }
}
EOF

# Invoke function
aws lambda invoke \
  --function-name dreamup-qa-agent \
  --payload file://test-event.json \
  --region us-east-1 \
  response.json

# View response
cat response.json | jq .
```

### Test via API Gateway (Optional)

For HTTP API access:

1. Create API Gateway REST API
2. Create Lambda integration
3. Deploy API
4. Test via HTTP endpoint

## Monitoring and Logging

### CloudWatch Logs

Lambda automatically streams logs to CloudWatch:

```bash
# View logs
aws logs tail /aws/lambda/dreamup-qa-agent --follow --region us-east-1

# View specific log stream
aws logs get-log-events \
  --log-group-name /aws/lambda/dreamup-qa-agent \
  --log-stream-name [stream-name] \
  --region us-east-1
```

### CloudWatch Metrics

Monitor key metrics:
- **Invocations**: Number of function invocations
- **Duration**: Execution time
- **Errors**: Error count
- **Throttles**: Throttled invocations
- **ConcurrentExecutions**: Current concurrent executions

### CloudWatch Alarms

Set up alarms for errors:

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name dreamup-error-alarm \
  --alarm-description "Alert on Lambda errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=FunctionName,Value=dreamup-qa-agent \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:alerts
```

## Cost Optimization

### Memory Configuration

- **Recommended**: 2048 MB (2 GB)
- **Minimum**: 512 MB (may cause timeouts)
- **Maximum**: 10240 MB (10 GB)

Adjust based on your game complexity. Monitor CloudWatch metrics to find optimal memory.

### Timeout Configuration

- **Recommended**: 600 seconds (10 minutes)
- **Minimum**: 240 seconds (4 minutes) for simple games
- **Maximum**: 900 seconds (15 minutes) for complex games

### Reserved Concurrency

Limit concurrent executions to control costs:

```bash
aws lambda put-function-concurrency \
  --function-name dreamup-qa-agent \
  --reserved-concurrent-executions 10 \
  --region us-east-1
```

### Cost Estimates

Typical costs per test:
- **Lambda**: ~$0.0000167 per GB-second (with 2048 MB, 240s = ~$0.008)
- **Browserbase**: ~$0.01-0.02 per session
- **OpenAI GPT-4 Vision**: ~$0.02-0.05 per test (depends on screenshot count)

**Total**: ~$0.03-0.08 per test

### Optimization Tips

1. **Use Metadata**: Reduces vision API calls (saves ~$0.01-0.02 per test)
2. **Enable Screenshot Cleanup**: Reduces storage costs
3. **Optimize Timeouts**: Reduce timeouts for faster games
4. **Batch Testing**: Run multiple tests sequentially (future enhancement)

## Troubleshooting

### Function Timeout

**Error**: Task timed out after X seconds

**Solutions**:
- Increase timeout (max 900 seconds)
- Increase memory (more memory = faster execution)
- Check CloudWatch logs for bottlenecks
- Optimize game loading indicators in metadata

### Out of Memory

**Error**: Runtime exited with error: signal: killed

**Solutions**:
- Increase memory allocation (try 3072 MB or 4096 MB)
- Check CloudWatch metrics for memory usage
- Review game complexity (very complex games may need more memory)

### Missing Environment Variables

**Error**: Missing required environment variables

**Solutions**:
- Verify environment variables are set in Lambda configuration
- Check variable names (case-sensitive)
- Use AWS Secrets Manager for production

### Browserbase Connection Issues

**Error**: Failed to initialize browser

**Solutions**:
- Verify Browserbase API key is correct
- Check Browserbase project ID matches account
- Ensure Browserbase account has sufficient credits
- Check network connectivity (may need VPC configuration)

### OpenAI API Errors

**Error**: Failed to analyze screenshots

**Solutions**:
- Verify OpenAI API key is correct
- Check API key has GPT-4 Vision access
- Ensure sufficient OpenAI credits/balance
- Enable DEBUG=true to see detailed errors

### Deployment Failures

**Error**: UpdateFunctionCode failed

**Solutions**:
- Verify IAM role has Lambda update permissions
- Check deployment package size (< 50 MB unzipped, < 250 MB unzipped with layers)
- Verify runtime is `provided.al2` (Bun runtime)
- Check handler path is correct (`dist/main.handler`)

---

For more information, see:
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [Bun Runtime on Lambda](https://bun.sh/docs/deploy/lambda)
- [DreamUp README](README.md)
- [DreamUp API Documentation](API.md)


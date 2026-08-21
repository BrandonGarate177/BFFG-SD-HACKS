# Deploying to AWS

Three CloudFormation stacks, three GitHub Actions workflows. Run the stacks
once from your laptop; after that everything happens on push.

**Do all of this as an admin IAM user, never as root.** Root should have MFA
on it and otherwise be untouched.

Region below is `us-west-2` (closest to San Diego). If you change it, change
`AWS_REGION` in all three workflows too.

---

## 1. GitHub OIDC trust

Creates a role GitHub can assume with a short-lived token. **No AWS access
keys are created, stored, or shared anywhere.**

```bash
aws cloudformation deploy \
  --template-file infra/01-github-oidc.yml \
  --stack-name bffg-oidc \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-west-2

aws cloudformation describe-stacks --stack-name bffg-oidc \
  --query 'Stacks[0].Outputs' --output table --region us-west-2
```

Copy `DeployRoleArn`.

## 2. Server infrastructure

```bash
VPC=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true \
  --query 'Vpcs[0].VpcId' --output text --region us-west-2)
SUBNETS=$(aws ec2 describe-subnets --filters Name=vpc-id,Values=$VPC \
  --query 'Subnets[*].SubnetId' --output text --region us-west-2 | tr '\t' ',')

aws cloudformation deploy \
  --template-file infra/02-server.yml \
  --stack-name bffg-server \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-west-2 \
  --parameter-overrides \
      VpcId=$VPC SubnetIds="$SUBNETS" AnthropicApiKey="$ANTHROPIC_API_KEY"

aws cloudformation describe-stacks --stack-name bffg-frontend \
  --query 'Stacks[0].Outputs' --output table --region us-west-2
```

### The ECS service will stall unless an image exists first

`AWS::ECS::Service` does not report CREATE_COMPLETE until a task is running
and healthy. With an empty ECR there is nothing to pull, so the stack sits in
CREATE_IN_PROGRESS for up to three hours and then rolls back — it looks like a
slow deploy and is actually a deadlock.

**Push an image as soon as the ECR repository exists** (about 30 seconds into
the stack), in a second terminal:

```bash
REG=<account-id>.dkr.ecr.us-west-2.amazonaws.com
aws ecr get-login-password --region us-west-2 \
  | docker login --username AWS --password-stdin $REG

# --platform is required: Fargate is x86, Apple Silicon is arm64. An arm
# image pulls fine and then crash-loops with an exec format error.
docker build --platform linux/amd64 -f server/Dockerfile -t $REG/bffg-server:latest .
docker push $REG/bffg-server:latest
```

The service picks it up on its next attempt and the stack completes. After the
first deploy this never recurs — the workflow keeps `:latest` populated.

Copy `ApiUrl` (the raw ALB address; the browser will use the CloudFront one).

## 3. Frontend infrastructure

Uses your default VPC rather than building networking from scratch:

```bash
VPC=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true \
  --query 'Vpcs[0].VpcId' --output text --region us-west-2)
SUBNETS=$(aws ec2 describe-subnets --filters Name=vpc-id,Values=$VPC \
  --query 'Subnets[*].SubnetId' --output text --region us-west-2 | tr '\t' ',')

aws cloudformation deploy \
  --template-file infra/03-server.yml \
  --stack-name bffg-server \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-west-2 \
  --parameter-overrides \
      VpcId=$VPC \
      SubnetIds="$SUBNETS" \
      AnthropicApiKey="$ANTHROPIC_API_KEY"
```

Takes the ALB address so CloudFront can proxy `/api/*` to it. CloudFront needs
5–15 minutes to distribute. Copy `SiteBucketName`, `TilesBucketName`,
`DistributionId`, `SiteUrl`, `TilesUrl`, `ApiUrl`.

## 4. GitHub repo variables

Settings → Secrets and variables → Actions → **Variables** (not Secrets —
none of these are sensitive):

| Variable | Value |
|---|---|
| `AWS_DEPLOY_ROLE` | `DeployRoleArn` from step 1 |
| `SITE_BUCKET` | `SiteBucketName` from step 2 |
| `TILES_BUCKET` | `TilesBucketName` from step 2 |
| `DISTRIBUTION_ID` | `DistributionId` from step 2 |
| `VITE_API_BASE` | `ApiUrl` from step 3 — the **CloudFront** `/api` URL, not the ALB |
| `VITE_TILES_URL` | `TilesUrl` from step 3 |

## 5. First deploy, in order

```
Actions → Deploy tiles    → Run workflow     (73 MB, once)
Actions → Deploy server   → Run workflow     (builds image, starts the task)
Actions → Deploy frontend → Run workflow     (needs the API URL to exist)
```

Server first: the frontend bakes `VITE_API_BASE` into its bundle at build
time, so the API needs to be reachable before the frontend build is useful.

After this, pushes to `main` deploy automatically — `frontend/**` and
`server/**` are path-filtered so they don't trigger each other. Tiles stay
manual.

## 6. Verify

```bash
curl $API_URL/health
curl -X POST $API_URL/parcel-detail -H 'Content-Type: application/json' \
  -d '{"apn":"2671503200"}' | head -c 200
curl -I -H 'Range: bytes=0-1023' $TILES_URL     # expect 206 + Accept-Ranges
```

Then open `SiteUrl`, load `/parcel/2671503200`, and confirm the assistant
panel does **not** say `mock`.

---

## Known rough edges

**The API is proxied through CloudFront, deliberately.** The ALB only speaks
HTTP, and a browser on an HTTPS page blocks HTTP calls as mixed content. Rather
than buying a domain and an ACM certificate, CloudFront serves `/api/*` from
the ALB as a second origin: the browser sees only HTTPS, and CloudFront reaches
the ALB over HTTP inside AWS. A CloudFront Function strips the `/api` prefix
before it hits the ALB.

The ALB stays publicly reachable on HTTP. Lock it to CloudFront's prefix list
if that matters.

**CORS is `allow_origins=["*"]`** in `server/main.py`. Tighten it to the
CloudFront domain once you know it. `/rag/chat` is unauthenticated and spends
a real API key.

**No rate limiting.** A public URL plus a loop is an unbounded Anthropic bill.
Keep the link unlisted until there's a limit in front of it.

**Cost.** Fargate 0.5 vCPU / 2 GB running continuously is roughly $18–20/month,
plus about $17 for the ALB. S3 and CloudFront at this traffic are cents. Stop
the service with `--desired-count 0` when you are not demoing.

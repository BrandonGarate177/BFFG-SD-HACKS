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

## 2. Frontend infrastructure

```bash
aws cloudformation deploy \
  --template-file infra/02-frontend.yml \
  --stack-name bffg-frontend \
  --region us-west-2

aws cloudformation describe-stacks --stack-name bffg-frontend \
  --query 'Stacks[0].Outputs' --output table --region us-west-2
```

CloudFront takes 5–15 minutes to finish distributing. Copy `SiteBucketName`,
`TilesBucketName`, `DistributionId`, `SiteUrl`, `TilesUrl`.

## 3. Server infrastructure

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

Export `ANTHROPIC_API_KEY` in your shell first — don't paste it into a file.
The first deploy fails to start a task because ECR is still empty; that's
expected and resolves on the first server workflow run.

Copy `ApiUrl`.

## 4. GitHub repo variables

Settings → Secrets and variables → Actions → **Variables** (not Secrets —
none of these are sensitive):

| Variable | Value |
|---|---|
| `AWS_DEPLOY_ROLE` | `DeployRoleArn` from step 1 |
| `SITE_BUCKET` | `SiteBucketName` from step 2 |
| `TILES_BUCKET` | `TilesBucketName` from step 2 |
| `DISTRIBUTION_ID` | `DistributionId` from step 2 |
| `VITE_API_BASE` | `ApiUrl` from step 3 |
| `VITE_TILES_URL` | `TilesUrl` from step 2 |

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

**HTTP, not HTTPS, on the API.** The ALB listens on port 80. A CloudFront site
on HTTPS calling an HTTP API will be blocked as mixed content by the browser.
Fix: request an ACM certificate for a domain you control, add an HTTPS
listener, and point `VITE_API_BASE` at it. **Without a domain this will not
work in a browser** — it is the one gap between this setup and a working
public site.

**CORS is `allow_origins=["*"]`** in `server/main.py`. Tighten it to the
CloudFront domain once you know it. `/rag/chat` is unauthenticated and spends
a real API key.

**No rate limiting.** A public URL plus a loop is an unbounded Anthropic bill.
Keep the link unlisted until there's a limit in front of it.

**Cost.** Fargate 0.5 vCPU / 2 GB running continuously is roughly $18–20/month,
plus about $17 for the ALB. S3 and CloudFront at this traffic are cents. Stop
the service with `--desired-count 0` when you are not demoing.

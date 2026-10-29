# ── The WebSocket relay on Lambda MicroVMs ───────────────────────────────
#
# A browser has no TCP sockets, so paludarium sends a guest's connections and
# name lookups to a WebSocket relay (ADR 0015). The relay runs in one shared
# MicroVM. No MicroVM is kept in the state: the platform ends one after at
# most 8 hours, so the token function starts one when none is running, and
# the idle policy suspends it when nobody uses it.

locals {
  # The relay comes from the same paludarium release as the core the package
  # ships, so the two speak the same protocol version.
  paludarium_version = jsondecode(file("${path.module}/../../package.json")).devDependencies["@aletheia-works/paludarium-wasm"]

  # The relay connects only here. A guest in the browser clones from GitHub.
  relay_allow = ["github.com:443"]
  # The page that may open the relay's WebSockets and call the token function.
  relay_origin = "https://aletheia-works.github.io"

  relay_name = "formicarium-relay"
  # Lambda's managed MicroVM base image (Amazon Linux 2023), pinned so a plan
  # shows when it changes.
  relay_base_image_arn     = "arn:aws:lambda:${var.aws_region}:aws:microvm-image:al2023-1"
  relay_base_image_version = "2"
  relay_connector          = "arn:aws:lambda:${var.aws_region}:aws:network-connector:aws-network-connector"

  relay_tags = [for key, value in { Project = "formicarium", ManagedBy = "opentofu" } : { key = key, value = value }]
}

# ── The image ────────────────────────────────────────────────────────────

data "archive_file" "relay" {
  type        = "zip"
  output_path = "${path.module}/.build/relay.zip"
  source {
    filename = "Dockerfile"
    content  = templatefile("${path.module}/relay/Dockerfile.tftpl", { paludarium_version = local.paludarium_version })
  }
}

# Named by its digest, so a changed Dockerfile is a new object and a new
# image version, and an unchanged one is never uploaded again.
resource "aws_s3_object" "relay" {
  bucket = aws_s3_bucket.artifacts.id
  key    = "relay/${data.archive_file.relay.output_sha256}.zip"
  source = data.archive_file.relay.output_path
}

resource "aws_cloudwatch_log_group" "relay_build" {
  name              = "/formicarium/relay-build"
  retention_in_days = 30
}

resource "aws_iam_role" "relay_build" {
  name                 = "${local.relay_name}-build"
  description          = "Builds the relay's MicroVM image from its zip in S3."
  permissions_boundary = aws_iam_policy.workload_boundary.arn
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = ["sts:AssumeRole", "sts:TagSession"]
    }]
  })
}

resource "aws_iam_role_policy" "relay_build" {
  name = "relay-build"
  role = aws_iam_role.relay_build.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.artifacts.arn}/relay/*"
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.relay_build.arn}:*"
      },
    ]
  })
}

resource "awscc_lambda_microvm_image" "relay" {
  name               = local.relay_name
  description        = "paludarium ${local.paludarium_version} relay for formicarium's guests in the browser"
  base_image_arn     = local.relay_base_image_arn
  base_image_version = local.relay_base_image_version
  build_role_arn     = aws_iam_role.relay_build.arn
  code_artifact = {
    uri = "s3://${aws_s3_object.relay.bucket}/${aws_s3_object.relay.key}"
  }
  cpu_configurations = [{ architecture = "ARM_64" }]
  # The smallest size: 0.5 GB and a quarter vCPU, up to four times that at
  # peak. The relay is one Node.js process that copies bytes.
  resources                 = [{ minimum_memory_in_mi_b = 512 }]
  egress_network_connectors = ["${local.relay_connector}:INTERNET_EGRESS"]
  # Cloud Control requires both, and awscc drops an empty value. ALL is the
  # only capability value; it applies inside the MicroVM only, which has no
  # execution role and so no AWS credentials.
  additional_os_capabilities = ["ALL"]
  # The relay serves no lifecycle hook, so each is DISABLED (HookState in the
  # AWS::Lambda::MicrovmImage schema).
  hooks = {
    port = 8080
    microvm_image_hooks = {
      ready    = "DISABLED"
      validate = "DISABLED"
    }
    microvm_hooks = {
      run       = "DISABLED"
      resume    = "DISABLED"
      suspend   = "DISABLED"
      terminate = "DISABLED"
    }
  }
  logging = {
    cloud_watch = {
      log_group = aws_cloudwatch_log_group.relay_build.name
    }
  }
  environment_variables = [
    { key = "PALUDARIUM_RELAY_LISTEN", value = "0.0.0.0:8080" },
    { key = "PALUDARIUM_RELAY_ALLOW", value = join(",", local.relay_allow) },
    { key = "PALUDARIUM_RELAY_ORIGINS", value = local.relay_origin },
    { key = "PALUDARIUM_RELAY_MAX_CONNECTIONS", value = "256" },
  ]
  tags = local.relay_tags

  depends_on = [aws_iam_role_policy.relay_build]
}

# ── The token function ───────────────────────────────────────────────────

data "archive_file" "relay_token" {
  type        = "zip"
  output_path = "${path.module}/.build/relay-token.zip"
  source {
    filename = "index.mjs"
    content  = file("${path.module}/relay-token/index.mjs")
  }
}

resource "aws_cloudwatch_log_group" "relay_token" {
  name              = "/formicarium/relay-token"
  retention_in_days = 30
}

resource "aws_iam_role" "relay_token" {
  name                 = "${local.relay_name}-token"
  description          = "Starts the shared relay MicroVM and issues its tokens."
  permissions_boundary = aws_iam_policy.workload_boundary.arn
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "relay_token" {
  name = "relay-token"
  role = aws_iam_role.relay_token.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:RunMicrovm",
          "lambda:GetMicrovm",
          "lambda:CreateMicrovmAuthToken",
        ]
        Resource = awscc_lambda_microvm_image.relay.image_arn
      },
      {
        Effect   = "Allow"
        Action   = "lambda:ListMicrovms"
        Resource = "*"
      },
      {
        # Lambda checks this against no resource (the service reference lists
        # none), so it cannot be scoped to the two connectors.
        Effect   = "Allow"
        Action   = "lambda:PassNetworkConnector"
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.relay_token.arn}:*"
      },
    ]
  })
}

resource "aws_lambda_function" "relay_token" {
  function_name    = "${local.relay_name}-token"
  description      = "Hands a browser the relay's URL and a short-lived token."
  role             = aws_iam_role.relay_token.arn
  runtime          = "nodejs24.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  filename         = data.archive_file.relay_token.output_path
  source_code_hash = data.archive_file.relay_token.output_base64sha256
  memory_size      = 128
  # Covers a new MicroVM's start, which the function waits for.
  timeout = 30
  # A flood of calls cannot take the concurrency the account's other stacks
  # share; the client token keeps two calls from starting two MicroVMs.
  reserved_concurrent_executions = 2
  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.relay_token.name
  }
  environment {
    variables = {
      RELAY_IMAGE_ARN         = awscc_lambda_microvm_image.relay.image_arn
      RELAY_ORIGIN            = local.relay_origin
      RELAY_INGRESS_CONNECTOR = "${local.relay_connector}:ALL_INGRESS"
      RELAY_EGRESS_CONNECTOR  = "${local.relay_connector}:INTERNET_EGRESS"
    }
  }

  depends_on = [aws_iam_role_policy.relay_token]
}

# Public, as a GitHub Pages site can hold no secret; the function answers only
# its origin, and the relay reaches only relay_allow.
resource "aws_lambda_function_url" "relay_token" {
  function_name      = aws_lambda_function.relay_token.function_name
  authorization_type = "NONE"
  cors {
    allow_origins = [local.relay_origin]
    allow_methods = ["GET"]
    max_age       = 300
  }
}

resource "aws_lambda_permission" "relay_token_url" {
  statement_id           = "public-function-url"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.relay_token.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "relay_token_invoke" {
  statement_id             = "public-function-url-invoke"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.relay_token.function_name
  principal                = "*"
  invoked_via_function_url = true
}

output "relay_token_url" {
  description = "The token function's URL, which the site fetches before a run with the network"
  value       = aws_lambda_function_url.relay_token.function_url
}

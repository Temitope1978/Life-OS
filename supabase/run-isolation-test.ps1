#Requires -Version 5.1
<#
.SYNOPSIS
  Runs the AI Life OS cross-user isolation test (§53) against hosted Supabase.

.DESCRIPTION
  Signs in as both seeded demo users via the Supabase Auth API, then executes
  supabase/tests/isolation.test.sql once per user with a real JWT in place. The
  script sets `request.jwt.claims` and SET ROLE authenticated, so RLS evaluates
  exactly as it would in production.

  The service-role key is deliberately NOT used. That role bypasses RLS, so a
  "pass" under it would prove nothing.

.PARAMETER SupabaseUrl
  Project URL, e.g. https://abcdefghijklm.supabase.co
  Falls back to $env:SUPABASE_URL.

.PARAMETER AnonKey
  anon (public) key. Falls back to $env:SUPABASE_ANON_KEY.

.NOTES
  Credentials come from environment variables or SecureString prompts only.
  Nothing is written to disk and nothing is echoed to the console.
#>

[CmdletBinding()]
param(
  [string]$SupabaseUrl = $env:SUPABASE_URL,
  [SecureString]$AnonKey
)

$ErrorActionPreference = 'Stop'

$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$testFile   = Join-Path $scriptDir 'tests\isolation.test.sql'

$users = @(
  @{ Name = 'demo';   Email = 'demo@lifeos.local';   Password = 'demo_password_never_use_in_prod' },
  @{ Name = 'second'; Email = 'second@lifeos.local'; Password = 'demo_password_never_use_in_prod' }
)

# --- locate psql ---------------------------------------------------------
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
  throw "psql not found. Install the Supabase CLI or PostgreSQL client, then re-run."
}

# --- resolve credentials ------------------------------------------------
if (-not $SupabaseUrl) {
  throw "Supabase URL not set. Use -SupabaseUrl or the SUPABASE_URL environment variable."
}

if (-not $AnonKey -and $env:SUPABASE_ANON_KEY) {
  $AnonKey = ConvertTo-SecureString $env:SUPABASE_ANON_KEY -AsPlainText -Force
}
if (-not $AnonKey) {
  $AnonKey = Read-Host -Prompt "Supabase anon key" -AsSecureString
}

$anonPlain = [System.Net.NetworkCredential]::new('', $AnonKey).Password

# --- sign in both users -------------------------------------------------
function Get-AccessToken([string]$email, [string]$password, [string]$anon) {
  $body = @{ email = $email; password = $password } | ConvertTo-Json
  $headers = @{
    'apikey' = $anon
    'Content-Type' = 'application/json'
  }
  $resp = Invoke-RestMethod `
    -Uri "$($SupabaseUrl)/auth/v1/token?grant_type=password" `
    -Method Post -Headers $headers -Body $body

  if (-not $resp.access_token) { throw "Sign-in failed for $email" }
  return $resp.access_token
}

$tokens = @{}
foreach ($u in $users) {
  Write-Host "Signing in $($u.Email)..." -ForegroundColor Cyan
  $tokens[$u.Name] = Get-AccessToken -email $u.Email -password $u.Password -anon $anonPlain
}

# --- resolve the DB password -------------------------------------------
# The pooler transaction string requires the DB password; the session string does not.
# Prefer a password already in the environment, else prompt once.
$dbPasswordPlain = $env:SUPABASE_DB_PASSWORD
if (-not $dbPasswordPlain) {
  $sec = Read-Host -Prompt "Database password (Supabase project settings)" -AsSecureString
  $dbPasswordPlain = [System.Net.NetworkCredential]::new('', $sec).Password
}

# --- run the test once per user ----------------------------------------
$overall = $true

foreach ($u in $users) {
  Write-Host ""
  Write-Host "=== isolation test as $($u.Email) ===" -ForegroundColor Yellow

  $token = $tokens[$u.Name]

  # Decode the JWT payload so psql can set request.jwt.claims from it.
  $jwtPayload = $token.Split('.')[1].Replace('-', '+').Replace('_', '/')
  while ($jwtPayload.Length % 4) { $jwtPayload += '=' }
  $claims = ([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($jwtPayload)))
  # single-quote-escape for psql literal syntax
  $claimsSql = $claims.Replace("'", "''")

  # Combine the test file with the preamble that establishes identity.
  $preamble = @"
\set ON_ERROR_STOP on
select set_config('request.jwt.claims', '$claimsSql', false);
set role authenticated;
"@

  $combined = $env:TEMP + "\lifeos_isolation_" + $u.Name + ".sql"
  Set-Content -LiteralPath $combined -Value ($preamble + "`n" + (Get-Content -LiteralPath $testFile -Raw)) -Encoding UTF8

  # psql needs the password via PGPASSWORD, never on the command line.
  $env:PGPASSWORD = $dbPasswordPlain

  $connString = $env:SUPABASE_DB_URL
  if (-not $connString) {
    $env:PGPASSWORD = $null
    throw "Set SUPABASE_DB_URL (environment variable) to the Postgres connection string."
  }

  & $psql.Source $connString -v ON_ERROR_STOP=1 -f $combined
  $code = $LASTEXITCODE

  if ($code -ne 0) {
    Write-Host "ISOLATION TEST FAILED as $($u.Email) (psql exit $code)" -ForegroundColor Red
    $overall = $false
  } else {
    Write-Host "isolation checks passed as $($u.Email)" -ForegroundColor Green
  }

  Remove-Item -LiteralPath $combined -Force -ErrorAction SilentlyContinue
  $env:PGPASSWORD = $null
}

Write-Host ""
if ($overall) {
  Write-Host "ALL ISOLATION TESTS PASSED — §53 satisfied." -ForegroundColor Green
  exit 0
} else {
  Write-Host "ISOLATION TESTING FAILED — Phase 4 exit condition NOT met." -ForegroundColor Red
  exit 1
}

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI (gh) is not installed. Install it with: winget install GitHub.cli"
}

gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Log in to GitHub first:"
    gh auth login
}

$remote = git remote get-url origin 2>$null
if (-not $remote) {
    gh repo create worldcup2026 --public --source=. --remote=origin --push
} else {
    git push -u origin main
}

$user = gh api user --jq .login
Write-Host ""
Write-Host "Done. Repository: https://github.com/$user/worldcup2026"
Write-Host ""
Write-Host "Enable GitHub Pages once in the repo:"
Write-Host "  Settings -> Pages -> Deploy from branch -> main -> / (root)"
Write-Host "Then your live site will be:"
Write-Host "  https://$user.github.io/worldcup2026/"

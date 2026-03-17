# Script para configurar o proxy na sessão atual do PowerShell
$user = "smart-d33pel1f9vew_area-BR"
$pass = "Y6OtqRfdSRY2Zj4F"
$proxy = "proxy.smartproxy.net:3120"

$env:HTTP_PROXY = "http://$user:$pass@$proxy"
$env:HTTPS_PROXY = "http://$user:$pass@$proxy"

Write-Host "✅ Proxy configurado para esta sessão do PowerShell." -ForegroundColor Green
Write-Host "Comando: curl -I https://www.liveoficial.com.br/" -ForegroundColor Cyan

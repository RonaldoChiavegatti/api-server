$port = 3000
$processId = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess
if ($processId) {
    Write-Host "Processo usando porta $port : $processId"
    Stop-Process -Id $processId -Force
    Write-Host "Processo finalizado com sucesso!"
} else {
    Write-Host "Nenhum processo usando a porta $port"
} 
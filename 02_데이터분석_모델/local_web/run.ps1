$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (Test-Path '.venv/Scripts/python.exe') {
    & '.venv/Scripts/python.exe' -u app.py --open-browser --auto-port
} else {
    python -u app.py --open-browser --auto-port
}

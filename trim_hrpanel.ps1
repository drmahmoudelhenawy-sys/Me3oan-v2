$file = "components\HRPanel.tsx"
$lines = Get-Content $file -Encoding UTF8

# Find the line index of "}" that corresponds to the end of the export default function
# We look for the second-to-last lone "}" (the component closing brace)
# Strategy: find line 776 which should be "}"
# Actually let's just keep lines up to and including the first lone "}" after the component starts

$componentStart = -1
$braceDepth = 0
$componentEnd = -1

for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    if ($line -match 'export default function HRPanel') {
        $componentStart = $i
    }
    if ($componentStart -ge 0) {
        $opens = ($line.ToCharArray() | Where-Object { $_ -eq '{' }).Count
        $closes = ($line.ToCharArray() | Where-Object { $_ -eq '}' }).Count
        $braceDepth += $opens - $closes
        if ($braceDepth -le 0 -and $componentStart -ge 0) {
            $componentEnd = $i
            break
        }
    }
}

Write-Host "Component ends at line: $($componentEnd + 1)"
Write-Host "Total lines in file: $($lines.Count)"

if ($componentEnd -gt 0) {
    $trimmed = $lines[0..$componentEnd]
    Set-Content $file -Value $trimmed -Encoding UTF8
    Write-Host "File trimmed to $($trimmed.Count) lines"
} else {
    Write-Host "Could not find component end"
}

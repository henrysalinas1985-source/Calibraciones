$root = "c:\Users\hesalinas\Music\2025\Investigacion"
$results = @()

$subdirs = Get-ChildItem -Path $root -Directory
foreach ($dir in $subdirs) {
    # Extract Date: DD-MM-YYYY
    $fecha = "N/A"
    if ($dir.Name -match "(\d{2}-\d{2}-\d{4})") {
        $fecha = $Matches[1] -replace "-", "/"
    }

    # Extract Equipo (strip date from start)
    $equipo = $dir.Name -replace "^\d{2}-\d{2}-\d{4}\s*(- )*", ""
    
    # Find files, exclude obvious templates/instruments
    $files = Get-ChildItem -Path $dir.FullName -Recurse -File -Include *.pdf, *.xlsx, *.xls | Where-Object { 
        $_.Name -notmatch "IC-OXI" -and $_.Name -notmatch "Contrastaci" -and $_.FullName -notmatch "Instrumento"
    }

    foreach ($file in $files) {
        $serie = "N/A"
        $base = [io.path]::GetFileNameWithoutExtension($file.Name)
        
        # Priority 1: Specific SN/TER patterns
        if ($base -match "(?:SN|TER-|EZ-)\s*(\d+)") {
            $serie = $Matches[1]
        } 
        # Priority 2: Long numbers (8+ digits)
        elseif ($base -match "(\d{8,})") {
            $serie = $Matches[1]
        }
        # Priority 3: Fallback to basename
        else {
            $serie = $base
        }

        $results += [PSCustomObject]@{
            Folder = $dir.Name
            Equipo = $equipo
            Fecha  = $fecha
            Serie  = $serie
            Archivo = $file.Name
        }
    }
}

$results | ConvertTo-Json

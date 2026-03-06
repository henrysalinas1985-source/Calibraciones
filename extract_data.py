import os
import re
import json

root_dir = r"c:\Users\hesalinas\Music\2025\Investigacion"
extracted_data = []

# Date pattern: DD-MM-YYYY
date_pattern = re.compile(r"(\d{2}-\d{2}-\d{4})")
# Serial pattern: Long numbers or prefixed numbers
serial_pattern = re.compile(r"(\d{8,})")
sn_pattern = re.compile(r"(?:SN|TER-|EZ-)\s*(\d+)")

for folder in os.listdir(root_dir):
    folder_path = os.path.join(root_dir, folder)
    if not os.path.isdir(folder_path):
        continue
    
    # Base info from folder name
    date_match = date_pattern.search(folder)
    fecha = date_match.group(1).replace("-", "/") if date_match else "N/A"
    
    # Strip date from folder name to get equipo
    equipo = re.sub(r"^\d{2}-\d{2}-\d{4}\s*(- )*", "", folder)
    
    # Walk through files
    for root, dirs, files in os.walk(folder_path):
        # Skip 'Instrumento' or 'Excel' subfolders if they just contain duplicates
        # But wait, some data is specifically in XLSX files named after serial numbers.
        for file in files:
            if not file.lower().endswith(('.pdf', '.xlsx', '.xls')):
                continue
            
            # Skip template-like names
            if "IC-OXI" in file or "Contrastación" in file:
                continue

            file_base = os.path.splitext(file)[0]
            
            # Extract serial
            serie = "N/A"
            sn_match = sn_pattern.search(file_base)
            if sn_match:
                serie = sn_match.group(1)
            else:
                long_num_match = serial_pattern.search(file_base)
                if long_num_match:
                    serie = long_num_match.group(1)
                else:
                    serie = file_base

            extracted_data.append({
                "Folder": folder,
                "Equipo": equipo,
                "Fecha": fecha,
                "Serie": serie,
                "File": file
            })

print(json.dumps(extracted_data, indent=2))

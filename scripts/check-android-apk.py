"""Reject universal APKs with missing/wrong ABIs or desktop Node resources."""

import argparse
import struct
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("apk", type=Path)
args = parser.parse_args()
expected = {"arm64-v8a": 183, "armeabi-v7a": 40, "x86": 3, "x86_64": 62}
with zipfile.ZipFile(args.apk) as apk:
    libraries = {
        name.split("/")[1]: name
        for name in apk.namelist()
        if name.startswith("lib/") and name.endswith("/libtomato_todo_lib.so")
    }
    if set(libraries) != set(expected):
        raise SystemExit(f"APK ABIs differ: {sorted(libraries)}")
    for abi, machine in expected.items():
        with apk.open(libraries[abi]) as library:
            header = library.read(20)
        elf_class = 2 if abi in ("arm64-v8a", "x86_64") else 1
        if len(header) != 20 or header[:4] != b"\x7fELF" or header[5] != 1:
            raise SystemExit(f"Invalid little-endian ELF: {libraries[abi]}")
        if header[4] != elf_class or struct.unpack_from("<H", header, 18)[0] != machine:
            raise SystemExit(f"Wrong ELF architecture: {libraries[abi]}")
    for name in apk.namelist():
        if name.endswith(("/bin/node", "/bin/node.exe")):
            raise SystemExit(f"Desktop Node runtime bundled in Android APK: {name}")
print(f"PASS: {args.apk.name}: four native ABIs, no desktop Node runtime")

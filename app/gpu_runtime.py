"""Discover only the NVIDIA runtime installed in this Python environment."""

import os
import sys
from pathlib import Path

_dll_handles = []


def configure_gpu_runtime():
    if os.name == "nt" and not _dll_handles:
        packages = Path(sys.prefix) / "Lib/site-packages/nvidia"
        directories = {dll.parent for dll in packages.rglob("*.dll")}
        for directory in sorted(directories):
            # Keep handles alive; closing one removes its DLL search directory.
            _dll_handles.append(os.add_dll_directory(str(directory)))
        # CTranslate2 uses native LoadLibrary, which also needs this process's PATH.
        os.environ["PATH"] = os.pathsep.join(map(str, sorted(directories))) + os.pathsep + (
            os.environ.get("PATH", "")
        )

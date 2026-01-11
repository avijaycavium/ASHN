#!/usr/bin/env python3
"""
Run script for AASHN LangGraph Agent Server
Start this alongside the Node.js server to enable autonomous healing
"""
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.server import run_server

if __name__ == "__main__":
    port = int(os.environ.get("AGENT_PORT", "5001"))
    print(f"Starting AASHN LangGraph Agent Server on port {port}...")
    print("=" * 50)
    print("Supported fault types:")
    print("  - bgp_link_flap")
    print("  - bgp_session_instability")
    print("  - traffic_drop")
    print("  - cpu_spike")
    print("  - memory_exhaustion")
    print("=" * 50)
    run_server(host="0.0.0.0", port=port)

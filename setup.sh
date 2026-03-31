#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# ZKTrader — Setup Script
#
# This script sets up the entire project from scratch:
#   1. Installs all dependencies
#   2. Compiles smart contracts
#   3. Starts local fhEVM node
#   4. Deploys contracts
#   5. Starts backend server
#   6. Starts frontend dev server
#
# Usage:
#   chmod +x setup.sh
#   ./setup.sh           # Full setup + start all services
#   ./setup.sh install   # Install only
#   ./setup.sh deploy    # Deploy contracts only
#   ./setup.sh dev       # Start dev servers only
# ═══════════════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${CYAN}[ZKTrader]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

# ── Check Prerequisites ──────────────────────────────────────────
check_prerequisites() {
  log "Checking prerequisites..."

  if ! command -v node &> /dev/null; then
    error "Node.js not found. Install Node.js >= 18: https://nodejs.org"
    exit 1
  fi

  NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VERSION" -lt 18 ]; then
    error "Node.js >= 18 required. Current: $(node -v)"
    exit 1
  fi

  if ! command -v pnpm &> /dev/null; then
    warn "pnpm not found. Installing..."
    npm install -g pnpm
  fi

  success "Prerequisites OK (Node $(node -v), pnpm $(pnpm -v))"
}

# ── Install Dependencies ─────────────────────────────────────────
install_deps() {
  log "Installing dependencies..."

  log "  → Contracts..."
  cd contracts
  pnpm install
  cd ..

  log "  → Backend..."
  cd backend
  pnpm install
  cd ..

  log "  → Frontend..."
  cd frontend
  pnpm install
  cd ..

  success "All dependencies installed"
}

# ── Compile Contracts ─────────────────────────────────────────────
compile_contracts() {
  log "Compiling smart contracts..."
  cd contracts
  npx hardhat compile
  cd ..
  success "Contracts compiled"
}

# ── Start Local fhEVM ─────────────────────────────────────────────
start_local_fhevm() {
  log "Starting local fhEVM node..."
  cd contracts
  npx fhevm-hardhat-plugin localfhevm:start &
  FHEVM_PID=$!
  cd ..

  # Wait for node to be ready
  sleep 10
  success "Local fhEVM node started (PID: $FHEVM_PID)"
}

# ── Deploy Contracts ──────────────────────────────────────────────
deploy_contracts() {
  log "Deploying contracts to local fhEVM..."
  cd contracts
  npx hardhat run scripts/deploy.ts --network localfhevm
  cd ..
  success "Contracts deployed! Addresses saved to contracts/deployments.json"
}

# ── Setup Environment Files ───────────────────────────────────────
setup_env() {
  log "Setting up environment files..."

  if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    warn "Backend .env created from template — update after deployment"
  fi

  if [ ! -f frontend/.env.local ]; then
    cp frontend/.env.example frontend/.env.local
    warn "Frontend .env.local created from template — update after deployment"
  fi

  success "Environment files ready"
}

# ── Start Development Servers ─────────────────────────────────────
start_dev() {
  log "Starting development servers..."

  # Backend
  cd backend
  pnpm dev &
  BACKEND_PID=$!
  cd ..

  # Frontend
  cd frontend
  pnpm dev &
  FRONTEND_PID=$!
  cd ..

  echo ""
  echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  ZKTrader is running!${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${CYAN}Frontend:${NC}  http://localhost:3000"
  echo -e "  ${CYAN}Backend:${NC}   http://localhost:3001"
  echo -e "  ${CYAN}WebSocket:${NC} ws://localhost:3001/ws"
  echo -e "  ${CYAN}fhEVM RPC:${NC} http://localhost:8545"
  echo ""
  echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop all services"
  echo ""

  # Trap Ctrl+C and clean up
  trap cleanup INT
  wait
}

cleanup() {
  echo ""
  log "Shutting down..."
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  kill $FHEVM_PID 2>/dev/null
  success "All services stopped"
  exit 0
}

# ── Run Tests ─────────────────────────────────────────────────────
run_tests() {
  log "Running contract tests..."
  cd contracts
  npx hardhat test --network localfhevm
  cd ..
  success "All tests passed"
}

# ── Main ──────────────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${CYAN}╔═══════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║   ZKTrader — Privacy-Preserving DEX Setup    ║${NC}"
  echo -e "${CYAN}║   Powered by Zama fhEVM                      ║${NC}"
  echo -e "${CYAN}╚═══════════════════════════════════════════════╝${NC}"
  echo ""

  case "${1:-full}" in
    install)
      check_prerequisites
      install_deps
      compile_contracts
      ;;
    deploy)
      deploy_contracts
      ;;
    dev)
      setup_env
      start_dev
      ;;
    test)
      run_tests
      ;;
    full)
      check_prerequisites
      install_deps
      compile_contracts
      setup_env
      start_local_fhevm
      deploy_contracts
      start_dev
      ;;
    *)
      echo "Usage: ./setup.sh [install|deploy|dev|test|full]"
      exit 1
      ;;
  esac
}

main "$@"

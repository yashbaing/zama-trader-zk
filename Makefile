.PHONY: all install compile test deploy dev clean help

# ─── Default ──────────────────────────────────────────────────────
help:
	@echo "ZKTrader — Available commands:"
	@echo ""
	@echo "  make install       Install all dependencies"
	@echo "  make compile       Compile smart contracts"
	@echo "  make test          Run contract tests on local fhEVM"
	@echo "  make deploy        Deploy contracts to local fhEVM"
	@echo "  make deploy-devnet Deploy contracts to Zama devnet"
	@echo "  make dev           Start frontend + backend dev servers"
	@echo "  make fhevm-start   Start local fhEVM node"
	@echo "  make fhevm-stop    Stop local fhEVM node"
	@echo "  make docker        Run everything with Docker Compose"
	@echo "  make clean         Remove build artifacts"
	@echo ""

# ─── Installation ─────────────────────────────────────────────────
install:
	cd contracts && pnpm install
	cd backend && pnpm install
	cd frontend && pnpm install

# ─── Smart Contracts ──────────────────────────────────────────────
compile:
	cd contracts && npx hardhat compile

test:
	cd contracts && npx hardhat test --network localfhevm

deploy:
	cd contracts && npx hardhat run scripts/deploy.ts --network localfhevm

deploy-devnet:
	cd contracts && npx hardhat run scripts/deploy.ts --network zamaDevnet

# ─── Local fhEVM ──────────────────────────────────────────────────
fhevm-start:
	cd contracts && npx fhevm-hardhat-plugin localfhevm:start

fhevm-stop:
	cd contracts && npx fhevm-hardhat-plugin localfhevm:stop

# ─── Development ──────────────────────────────────────────────────
dev:
	@echo "Starting backend..."
	cd backend && pnpm dev &
	@echo "Starting frontend..."
	cd frontend && pnpm dev

dev-backend:
	cd backend && pnpm dev

dev-frontend:
	cd frontend && pnpm dev

# ─── Docker ───────────────────────────────────────────────────────
docker:
	docker-compose up --build

docker-down:
	docker-compose down

# ─── Cleanup ──────────────────────────────────────────────────────
clean:
	rm -rf contracts/out contracts/cache contracts/artifacts
	rm -rf backend/dist
	rm -rf frontend/.next
	rm -rf node_modules */node_modules

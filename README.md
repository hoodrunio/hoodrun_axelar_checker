# Axelar Checker

## Overview
Axelar Validator Checker is a Node.js application designed to provide tracking features for running blockchain nodes, specifically tailored for Axelar network validators. The application includes a Telegram bot for monitoring validators' uptime, poll votes, supported EVM chains, and RPC health mechanism.

## Features
- Validator Tracking: Monitor validators' uptime, poll votes, supported EVM chains, and RPC health.
- Environment Configuration: Utilize an environment file for seamless deployment to Docker. All features are configurable via environment variables.
- Poll Vote Indexing: Index poll votes based on the specified voter address to facilitate tracking and analysis.
- Amplifier Polls: Monitor and track Amplifier polls and votes for your verifier.
- Amplifier Signatures: Monitor and track Amplifier signatures for your verifier.
- Telegram Notifications: Receive alerts via Telegram for various validator & verifier performance metrics:
  - Uptime
  - Poll votes (EVM and Amplifier)
  - Signatures (Amplifier)
  - EVM RPCs endpoint health
  - Maintainer registration/deregistration events
- Automated Health Checks: Regular monitoring of node status and performance metrics
- Multi-endpoint Support: Redundancy through multiple API endpoints
- Queue Management: Bull queue implementation for reliable job processing
- Detailed Logging: Comprehensive logging with Winston
- Database Integration: MongoDB storage for historical data

## Project Structure
```
├── src/                       # Source code
   ├── tests/                  # Test files
   ├── dist/                   # Compiled JS files
   ├── logs/                   # Log files
```

## Requirements
Before deploying the application, ensure you have the following prerequisites:
- Docker and Docker Compose
- Node.js v16 or higher (for development)
- MongoDB (automatically handled in Docker)
- Redis (automatically handled in Docker)
- Telegram Bot Token
- Axelar Network endpoints (see [Axelar RPC Resources](https://docs.axelar.dev/resources/rpc/resources) for more information)

### Docker Installation

To install Docker, follow the steps below:

1. **Official Docker Installation Script:**

   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```

2. **Adding User to the Docker Group:** 

   ```bash
   sudo usermod -aG docker $USER
   ```

3. **Verification:**

   ```bash
   docker --version
   docker-compose --version
   ```

## Development
1. Install dependencies:
   ```bash
   npm install
   ```

2. Create and configure `.env` file from `.env.example`

3. Run in development mode:
   ```bash
   npm run dev
   ```

4. Run tests:
   ```bash
   npm test                 # Run all tests
   npm test:coverage        # Run tests with coverage
   npm test:integration     # Run integration tests
   ```

## Environment Variables
Key environment variables required (see `.env.example` for complete list):
- `AXELAR_MAINNET_REST_BASE_URLS`: Axelar Mainnet REST API endpoints (comma-separated, REQUIRED)
- `AXELAR_WS_URLS`: WebSocket URLs for Axelar (comma-separated, REQUIRED)
- `AXELAR_RPC_BASE_URLS`: RPC base URLs (comma-separated, REQUIRED)
- `AXELAR_LCD_BASE_URLS`: LCD base URLs (comma-separated, REQUIRED)
- `MAINNET_AXELAR_ARCHIVE_RPC_BASE_URLS`: Archive RPC base URLs (comma-separated)
- `MAINNET_AXELAR_ARCHIVE_REST_BASE_URLS`: Archive REST base URLs (comma-separated, REQUIRED for getting proxy address)
- `AXELAR_VOTER_ADDRESS`: Your Axelar voter address (REQUIRED)
- `AXELAR_OPERATOR_ADDRESS`: Your Axelar operator address ("axelarvaloper..." | OPTIONAL; Set if the LCD cant query your proxy address)
- `MONITORED_VERIFIERS`: List of verifiers to monitor (comma-separated, REQUIRED if you want to receive notifications for your amplifier verifer)
- `TG_TOKEN`: Telegram bot token (REQUIRED; see [here](https://core.telegram.org/bots/tutorial#obtain-your-bot-token) for creating a bot and getting the token)
- `MONGODB_URI`: MongoDB connection string
- `REDIS_URL`: Redis connection string

## Docker Deployment
### Production
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

### Development
```bash
docker-compose -f docker-compose.dev.yml up -d --build --force-recreate
```

## Monitoring and Logging
- Logs are stored in the `logs` directory with daily rotation
- Winston logger is configured with different log levels
- Monitor the application through Docker logs:
  ```bash
  docker logs -f axelar-checker
  ```

## Troubleshooting
Common issues and solutions:
1. **Connection Issues**
   - Verify network connectivity
   - Check if endpoints are accessible
   - Ensure correct environment variables

2. **MongoDB Connection**
   - Verify MongoDB is running
   - Check connection string
   - Ensure proper authentication

3. **Telegram Bot**
   - Verify bot token
   - Ensure bot has required permissions
   - Check internet connectivity

## Contributing
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Performance Considerations
- Multiple endpoints for redundancy
- Job queue with retries
- Connection pooling for MongoDB
- Caching with Redis
- Rate limiting for API calls

## License
This project is licensed under the MIT License

## Support
For support, please open an issue in this repository, or contact us directly via email at infra@hoodrun.io.
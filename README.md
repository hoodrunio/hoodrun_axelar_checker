# Axelar Checker

## Overview
Axelar Validator Checker is a Node.js application designed to provide tracking features for running blockchain nodes, specifically tailored for Axelar network validators. The application includes a Telegram bot for monitoring validators' uptime, poll votes, supported EVM chains, and RPC health mechanism.

## Features
- Validator Tracking: Monitor validators' uptime, poll votes, supported EVM chains, and RPC health.
- Environment Configuration: Utilize an environment file for seamless deployment to Docker. All features are configurable via environment variables.
- Poll Vote Indexing: Index poll votes based on the specified voter address to facilitate tracking and analysis.
- Telegram Notifications: Receive notifications via Telegram based on uptime thresholds and operator performance.

## Requirements
Before deploying the application, ensure you have the following prerequisites:
- Node.js installed on your system
- Docker installed on your system

### Node.js Installation

To install the required version of Node.js for this project, follow the steps below:

1. **Installation with NodeSource Node.js Binaries:**

   To install the LTS version of Node.js, use the following commands:

   ```bash
   curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

   These commands install the latest LTS version on your system.

2. **Verification of Installation:**

   To check if Node.js and npm were successfully installed, use the following commands:

   ```bash
   node --version
   npm --version
   ```

   These commands print the installed versions of Node.js and npm.

### Docker Installation

To install Docker, follow the steps below:

1. **Official Docker Installation Script:**

   To quickly install Docker, you can use Docker's official installation script:

   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```

   This script installs Docker on your system.

2. **Adding User to the Docker Group (optional):** 

   To run Docker commands without `sudo`, add your user to the `docker` group:

   ```bash
   sudo usermod -aG docker $USER
   ```

   After this command, you may need to log out and log back in for the changes to take effect.

3. **Verification of Docker Installation:**

   To check if Docker was successfully installed:

   ```bash
   docker --version
   ```

   This command prints the installed version of Docker.

## Getting Started
To deploy Axelar Validator Checker to Docker, follow these steps:
1. Clone this repository to your local machine.
2. Navigate to the project directory.
3. Create an .env file with the following variables:
   - `AXELAR_MAINNET_REST_BASE_URLS`: Specify at least three URLs for Axelar Mainnet REST API endpoints.
   - `AXELAR_WS_URLS`: Specify at least three WebSocket URLs for Axelar.
   - `AXELAR_RPC_BASE_URLS`: Specify at least three RPC base URLs for Axelar.
   - `AXELAR_LCD_BASE_URLS`: Specify at least three LCD base URLs for Axelar.
   - `AXELAR_VOTER_ADDRESS`: Provide your Axelar voter address for poll vote indexing.
   - `TG_TOKEN`: Generate your own Telegram token and include it in the .env file for Telegram notifications.

## Environment Variables
Ensure to include the following environment variables in your .env file:
- `AXELAR_MAINNET_REST_BASE_URLS="[https://example1.url, https://example2.url, https://example3.url]"`
- `AXELAR_WS_URLS="[wss://example1.url, wss://example2.url, wss://example3.url]"`
- `AXELAR_RPC_BASE_URLS="[https://example1.url, https://example2.url, https://example3.url]"`
- `AXELAR_LCD_BASE_URLS="[https://example1.url, https://example2.url, https://example3.url]"`
- `AXELAR_VOTER_ADDRESS="<Your Axelar Voter Address>"`
- `TG_TOKEN="<Your Telegram Bot Token>"`

## Docker Deployment
Once your environment file is configured, you can deploy the application to Docker using the following command:
`docker-compose up -d
`
## Usage
- Access the Telegram bot to track validators' uptime, poll votes, and more.
- Monitor notifications sent via Telegram based on uptime thresholds and operator performance.

## License
This project is licensed under the MIT License

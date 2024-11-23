# Gigacharger Controller API

Gigacharger Controller API provides a custom solution for controlling Gigacharger EV chargers programmatically, bypassing the limitations of the official app. This service allows you to manage your EV charging sessions through HTTP and WebSocket integrations, enabling advanced use cases such as scheduled charging during low-energy tariff periods.

## Features

- **Login Integration**: Authenticate with the Gigacharger API using your email and password.
- **Session Management**: Automatically manages and reuses session cookies for seamless API interactions.
- **WebSocket Communication**: Initiate charging sessions securely via Gigacharger's WebSocket interface.
- **Custom Scheduling**: Automate charging processes (e.g., trigger charging at specific times).
- **RESTful Endpoints**: Interact with the service via HTTP requests for easy integration.

---

## Prerequisites

### Environment Variables

Set the following environment variables to configure the API:

| Variable Name            | Description                                  |
|---------------------------|----------------------------------------------|
| `GIGACHARGER_EMAIL`       | Your Gigacharger account email address.     |
| `GIGACHARGER_PASSWORD`    | Your Gigacharger account password.          |
| `GIGACHARGER_MY_CHARGER_ID` | The ID of your Gigacharger.                |
| `TESSIE_TOKEN`            | *(Optional)* Token for third-party integrations. |

---

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/gigacharger-controller.git
   cd gigacharger-controller
   ```
2. Install dependencies:
    ```
    npm install
    ```
3. Create an .env file in the project root and add your configuration (or set up environment variables in your system):
    ```
    GIGACHARGER_EMAIL=your_email@example.com
    GIGACHARGER_PASSWORD=your_password
    GIGACHARGER_MY_CHARGER_ID=your_charger_id
    ```
4. Start the server:
    ```
    npm start
    ```

The API will be accessible at `localhost:3000`.
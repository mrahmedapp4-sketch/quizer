# Local Server Setup and Usage Guide

This project is configured to run locally on your laptop and can be accessed by other devices (phones, tablets, other laptops) on the same WiFi or hotspot.

## Prerequisites
- **Node.js** (v18 or higher) installed on your laptop.
- Both the laptop and other devices must be on the **same WiFi network** or the same **mobile hotspot**.

## How to Run Locally

1. **Extract the Files**: Make sure all files from the project are in a folder on your laptop.
2. **Install Dependencies**:
   Open your terminal (Command Prompt or PowerShell on Windows, Terminal on Mac/Linux) in that folder and run:
   ```bash
   npm install
   ```
3. **Build the Project**:
   Run the following command to prepare the local version:
   ```bash
   npm run build
   ```
4. **Start the Server**:
   Run the following command to start the server:
   ```bash
   npm start
   ```
   The server will start, and you should see a message like:
   `[express] serving on port 5000`

## Accessing from Other Devices

To access the app from another device on the same network:

1. **Find your Laptop's IP Address**:
   - **Windows**: Run `ipconfig` in the terminal. Look for `IPv4 Address` (e.g., `192.168.1.15`).
   - **Mac/Linux**: Run `ifconfig` or `ip addr`. Look for the IP address under `en0` or `wlan0`.
2. **Open the App on Other Devices**:
   On your phone or other device, open a web browser and type:
   `http://<YOUR_LAPTOP_IP>:5000`
   (Example: `http://192.168.1.15:5000`)

## Note on "Fully Local"
This version uses in-memory storage for data, meaning it does not require an external database or internet connection to function. However, data will reset if the server is restarted.

# VetShelter Hardware Bridge - Setup Guide

This local server connects your thermal printer and cash drawer to the VetShelter web application.

## Hardware Requirements

- **Thermal Printer**: Unykach (or any ESC/POS compatible USB printer)
- **Cash Drawer**: Connected via RJ11/RJ12 to the printer (drawer kick)
- **PC**: Windows with Node.js installed

## Installation

### 1. Install Node.js
Download from https://nodejs.org (LTS version recommended)

### 2. Install Dependencies
```bash
cd vetshelter-hardware-bridge
npm install
```

### 3. Connect Hardware
1. Connect thermal printer via USB
2. Connect cash drawer to printer's RJ11/RJ12 port
3. Install printer drivers if needed (Windows usually auto-detects)

### 4. Find Your Printer Name
Start the server and check available printers:
```bash
npm start
```
Then open http://localhost:3456/printers (with API key header)

Or check Windows Settings > Printers & Scanners

### 5. Configure Printer
Edit `.env` file:
```
PRINTER_INTERFACE=printer:YOUR_PRINTER_NAME
```

Example printer names:
- `printer:POS-58`
- `printer:UNYKACH`
- `printer:Thermal Receipt Printer`

## Running the Server

### Start server:
```bash
npm start
```

### Development mode (auto-restart on changes):
```bash
npm run dev
```

## Connecting to VetShelter (Vercel)

Since VetShelter is hosted on Vercel (cloud) and this bridge runs locally, you need a tunnel.

### Option A: ngrok (Recommended for testing)

1. Install ngrok: https://ngrok.com/download
2. Sign up for free account
3. Run:
```bash
ngrok http 3456
```
4. Copy the `https://xxxxx.ngrok.io` URL
5. Add to VetShelter's `.env.local` on Vercel:
```
HARDWARE_BRIDGE_URL=https://xxxxx.ngrok.io
HARDWARE_BRIDGE_API_KEY=vetshelter-hardware-2024
```

### Option B: Cloudflare Tunnel (Free, permanent)

1. Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
2. Login: `cloudflared tunnel login`
3. Create tunnel: `cloudflared tunnel create vetshelter-hardware`
4. Run: `cloudflared tunnel run --url http://localhost:3456 vetshelter-hardware`
5. Use the tunnel URL in VetShelter's env

### Option C: Local Network (Same network only)

If running VetShelter locally on the same network:
1. Find your PC's local IP: `ipconfig`
2. Use `http://192.168.x.x:3456` as HARDWARE_BRIDGE_URL

## API Endpoints

### Health Check
```
GET /health
```

### Open Cash Drawer
```
POST /drawer/open
Headers: x-api-key: vetshelter-hardware-2024
```

### Print Receipt
```
POST /print/receipt
Headers: x-api-key: vetshelter-hardware-2024
Content-Type: application/json

{
  "invoice": {
    "number": "F-2024/001",
    "issueDate": "2024-01-15",
    "total": 150.00,
    "subtotal": 123.97,
    "totalVat": 26.03,
    "lines": [
      { "description": "Consulta", "quantity": 1, "unitPrice": 50.00 }
    ],
    "customer": { "name": "Juan García", "nif": "12345678A" }
  },
  "clinic": {
    "name": "VetShelter Clinic",
    "address": "Calle Example 123",
    "phone": "912345678",
    "cif": "B12345678"
  },
  "openDrawer": true
}
```

### Print Test Page
```
POST /print/test
Headers: x-api-key: vetshelter-hardware-2024
```

### List Printers
```
GET /printers
Headers: x-api-key: vetshelter-hardware-2024
```

## Troubleshooting

### Printer not found
- Check printer is connected and powered on
- Verify printer name in Windows Settings > Printers
- Try different interface formats:
  - `printer:EXACT_NAME`
  - `//localhost/SHARED_NAME` (for shared printers)

### Cash drawer doesn't open
- Verify RJ11/RJ12 cable is connected
- Some drawers need pin 5 instead of pin 2 - modify `openCashDrawer()` call

### Connection errors from VetShelter
- Verify ngrok/tunnel is running
- Check API key matches in both .env files
- Ensure firewall allows port 3456

### Receipt prints garbled text
- Try `CharacterSet.PC858_EURO` or `CharacterSet.SLOVENIA` in index.js
- Remove special characters from text

## Auto-start on Windows Boot

Create a batch file `start-bridge.bat`:
```batch
@echo off
cd C:\Users\smart\documents\claudecode\vetshelter-hardware-bridge
npm start
```

Add to Windows Startup folder or use Task Scheduler.

## Security Notes

- API key provides basic authentication
- For production, use HTTPS (ngrok/cloudflare provide this)
- Keep API key secret
- Consider IP whitelisting if using local network

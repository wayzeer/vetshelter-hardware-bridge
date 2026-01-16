const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3456;
const API_KEY = process.env.API_KEY || 'vetshelter-hardware-2024';
const PRINTER_NAME = process.env.PRINTER_NAME || 'POSPrinter POS-80';

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';
const Commands = {
  INIT: ESC + '@',
  ALIGN_LEFT: ESC + 'a' + '\x00',
  ALIGN_CENTER: ESC + 'a' + '\x01',
  ALIGN_RIGHT: ESC + 'a' + '\x02',
  BOLD_ON: ESC + 'E' + '\x01',
  BOLD_OFF: ESC + 'E' + '\x00',
  DOUBLE_SIZE: GS + '!' + '\x11',
  NORMAL_SIZE: GS + '!' + '\x00',
  CUT: GS + 'V' + '\x00',
  CASH_DRAWER: ESC + 'p' + '\x00' + '\x19' + '\xFA',
  FEED: ESC + 'd' + '\x02',
};

// Print raw data to Windows printer using raw/binary mode
function printRaw(data) {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(os.tmpdir(), `receipt_${Date.now()}.bin`);
    const scriptPath = path.join(__dirname, 'print-raw.ps1');

    // Write binary data
    fs.writeFileSync(tempFile, data, 'binary');

    // Use PowerShell script to send raw data to printer
    const cmd = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -PrinterName "${PRINTER_NAME}" -FilePath "${tempFile}"`;

    exec(cmd, (error, stdout, stderr) => {
      // Clean up temp file
      try { fs.unlinkSync(tempFile); } catch (e) {}

      if (error) {
        console.error('Print error:', stderr || stdout);
        reject(new Error(stderr || error.message));
      } else {
        console.log('Print output:', stdout);
        resolve();
      }
    });
  });
}

// Build ESC/POS text line
function textLine(text) {
  return text + '\n';
}

function drawLine(width = 32) {
  return '-'.repeat(width) + '\n';
}

// Middleware to verify API key
function verifyApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'vetshelter-hardware-bridge',
    printerName: PRINTER_NAME,
    printerReady: true
  });
});

// List printers
app.get('/printers', verifyApiKey, (req, res) => {
  exec('powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"', (error, stdout) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    const printers = stdout.trim().split('\n').filter(p => p.trim());
    res.json({
      printers: printers.map(name => ({ name: name.trim() })),
      configured: PRINTER_NAME
    });
  });
});

// Open cash drawer
app.post('/drawer/open', verifyApiKey, async (req, res) => {
  try {
    const data = Commands.INIT + Commands.CASH_DRAWER;
    await printRaw(data);
    console.log('Cash drawer opened');
    res.json({ success: true, message: 'Cajón abierto' });
  } catch (error) {
    console.error('Error opening cash drawer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Print receipt
app.post('/print/receipt', verifyApiKey, async (req, res) => {
  try {
    const { invoice, clinic, openDrawer = false } = req.body;

    if (!invoice) {
      return res.status(400).json({ error: 'Invoice data required' });
    }

    let receipt = Commands.INIT;

    // Header
    receipt += Commands.ALIGN_CENTER;
    receipt += Commands.BOLD_ON;
    receipt += Commands.DOUBLE_SIZE;
    receipt += textLine(clinic?.name || 'VetWonder');
    receipt += Commands.NORMAL_SIZE;
    receipt += Commands.BOLD_OFF;

    if (clinic?.address) receipt += textLine(clinic.address);
    if (clinic?.phone) receipt += textLine(`Tel: ${clinic.phone}`);
    if (clinic?.cif) receipt += textLine(`CIF: ${clinic.cif}`);

    receipt += drawLine();
    receipt += Commands.ALIGN_LEFT;
    receipt += Commands.BOLD_ON;
    receipt += textLine(`FACTURA: ${invoice.number || invoice.id}`);
    receipt += Commands.BOLD_OFF;
    receipt += textLine(`Fecha: ${new Date(invoice.issueDate || invoice.createdAt).toLocaleDateString('es-ES')}`);

    if (invoice.customer) {
      receipt += textLine(`Cliente: ${invoice.customer.name}`);
      if (invoice.customer.nif) {
        receipt += textLine(`NIF: ${invoice.customer.nif}`);
      }
    }

    receipt += drawLine();

    // Invoice lines
    if (invoice.lines && invoice.lines.length > 0) {
      for (const line of invoice.lines) {
        const description = (line.description || line.concept || 'Item').substring(0, 32);
        const qty = line.quantity || 1;
        const price = parseFloat(line.unitPrice || line.price || 0);
        const total = (qty * price).toFixed(2);
        receipt += textLine(description);
        receipt += textLine(`  ${qty} x ${price.toFixed(2)} = ${total} EUR`);
      }
    }

    receipt += drawLine();

    // Totals
    receipt += Commands.ALIGN_RIGHT;
    if (invoice.subtotal) {
      receipt += textLine(`Subtotal: ${parseFloat(invoice.subtotal).toFixed(2)} EUR`);
    }
    if (invoice.totalVat) {
      receipt += textLine(`IVA: ${parseFloat(invoice.totalVat).toFixed(2)} EUR`);
    }
    if (invoice.discountAmount && parseFloat(invoice.discountAmount) > 0) {
      receipt += textLine(`Descuento: -${parseFloat(invoice.discountAmount).toFixed(2)} EUR`);
    }

    receipt += Commands.BOLD_ON;
    receipt += Commands.DOUBLE_SIZE;
    receipt += textLine(`TOTAL: ${parseFloat(invoice.total).toFixed(2)} EUR`);
    receipt += Commands.NORMAL_SIZE;
    receipt += Commands.BOLD_OFF;

    receipt += Commands.ALIGN_LEFT;
    receipt += drawLine();

    // Payment info
    if (invoice.payments && invoice.payments.length > 0) {
      receipt += textLine('PAGOS:');
      for (const payment of invoice.payments) {
        const method = payment.method || 'efectivo';
        const amount = parseFloat(payment.amount).toFixed(2);
        receipt += textLine(`  ${method}: ${amount} EUR`);
      }
      receipt += drawLine();
    }

    // Footer
    receipt += Commands.ALIGN_CENTER;
    receipt += textLine('Gracias por su visita');
    receipt += Commands.FEED;

    // Open cash drawer if requested
    if (openDrawer) {
      receipt += Commands.CASH_DRAWER;
    }

    receipt += Commands.CUT;

    await printRaw(receipt);
    console.log('Receipt printed for invoice:', invoice.number || invoice.id);
    res.json({ success: true, message: 'Ticket impreso' });
  } catch (error) {
    console.error('Error printing receipt:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Print test page
app.post('/print/test', verifyApiKey, async (req, res) => {
  try {
    let testPage = Commands.INIT;
    testPage += Commands.ALIGN_CENTER;
    testPage += Commands.BOLD_ON;
    testPage += Commands.DOUBLE_SIZE;
    testPage += textLine('VetWonder');
    testPage += Commands.NORMAL_SIZE;
    testPage += Commands.BOLD_OFF;
    testPage += textLine('Hardware Bridge');
    testPage += drawLine();
    testPage += textLine('Test de impresion OK');
    testPage += textLine(new Date().toLocaleString('es-ES'));
    testPage += drawLine();
    testPage += textLine('Impresora configurada');
    testPage += textLine('correctamente');
    testPage += Commands.FEED;
    testPage += Commands.CUT;

    await printRaw(testPage);
    console.log('Test page printed');
    res.json({ success: true, message: 'Pagina de prueba impresa' });
  } catch (error) {
    console.error('Error printing test:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log('============================================');
  console.log('  VetWonder Hardware Bridge');
  console.log('============================================');
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`API Key: ${API_KEY}`);
  console.log(`Impresora: ${PRINTER_NAME}`);
  console.log('');
  console.log('Usando Windows Print Spooler');
  console.log('');
  console.log('Endpoints:');
  console.log('  GET  /health        - Estado del servidor');
  console.log('  GET  /printers      - Lista impresoras Windows');
  console.log('  POST /drawer/open   - Abrir cajon');
  console.log('  POST /print/receipt - Imprimir ticket');
  console.log('  POST /print/test    - Pagina de prueba');
  console.log('============================================');
});

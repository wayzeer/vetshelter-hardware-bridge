const express = require('express');
const cors = require('cors');
const { ThermalPrinter, PrinterTypes, CharacterSet } = require('node-thermal-printer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3456;
const API_KEY = process.env.API_KEY || 'vetshelter-hardware-2024';

// Printer configuration - adjust based on your Unykach printer
let printer = null;

async function initPrinter() {
  try {
    printer = new ThermalPrinter({
      type: PrinterTypes.EPSON, // Most Unykach printers are EPSON compatible
      interface: process.env.PRINTER_INTERFACE || 'printer:POS-58', // Windows printer name
      characterSet: CharacterSet.PC852_LATIN2,
      removeSpecialCharacters: false,
      lineCharacter: '-',
      options: {
        timeout: 5000
      }
    });

    const isConnected = await printer.isPrinterConnected();
    console.log('Printer connected:', isConnected);
    return isConnected;
  } catch (error) {
    console.error('Error initializing printer:', error.message);
    return false;
  }
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
    printerConnected: printer !== null
  });
});

// Open cash drawer
app.post('/drawer/open', verifyApiKey, async (req, res) => {
  try {
    if (!printer) {
      await initPrinter();
    }

    // ESC/POS command to open cash drawer (pin 2)
    // Most cash drawers connected via RJ11 respond to this
    printer.openCashDrawer();
    await printer.execute();
    printer.clear();

    console.log('Cash drawer opened');
    res.json({ success: true, message: 'Cash drawer opened' });
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

    if (!printer) {
      await initPrinter();
    }

    // Build receipt
    printer.alignCenter();
    printer.bold(true);
    printer.setTextSize(1, 1);
    printer.println(clinic?.name || 'VetShelter');
    printer.bold(false);
    printer.setTextNormal();

    if (clinic?.address) {
      printer.println(clinic.address);
    }
    if (clinic?.phone) {
      printer.println(`Tel: ${clinic.phone}`);
    }
    if (clinic?.cif) {
      printer.println(`CIF: ${clinic.cif}`);
    }

    printer.drawLine();
    printer.alignLeft();

    // Invoice header
    printer.bold(true);
    printer.println(`FACTURA: ${invoice.number || invoice.id}`);
    printer.bold(false);
    printer.println(`Fecha: ${new Date(invoice.issueDate || invoice.createdAt).toLocaleDateString('es-ES')}`);

    if (invoice.customer) {
      printer.println(`Cliente: ${invoice.customer.name}`);
      if (invoice.customer.nif) {
        printer.println(`NIF: ${invoice.customer.nif}`);
      }
    }

    printer.drawLine();

    // Invoice lines
    if (invoice.lines && invoice.lines.length > 0) {
      for (const line of invoice.lines) {
        const description = line.description || line.concept || 'Item';
        const qty = line.quantity || 1;
        const price = parseFloat(line.unitPrice || line.price || 0);
        const total = qty * price;

        printer.println(description.substring(0, 32));
        printer.tableCustom([
          { text: `${qty} x ${price.toFixed(2)}`, align: 'LEFT', width: 0.5 },
          { text: `${total.toFixed(2)} EUR`, align: 'RIGHT', width: 0.5 }
        ]);
      }
    }

    printer.drawLine();

    // Totals
    printer.alignRight();

    if (invoice.subtotal) {
      printer.println(`Subtotal: ${parseFloat(invoice.subtotal).toFixed(2)} EUR`);
    }
    if (invoice.totalVat) {
      printer.println(`IVA: ${parseFloat(invoice.totalVat).toFixed(2)} EUR`);
    }
    if (invoice.discountAmount && parseFloat(invoice.discountAmount) > 0) {
      printer.println(`Descuento: -${parseFloat(invoice.discountAmount).toFixed(2)} EUR`);
    }

    printer.bold(true);
    printer.setTextSize(1, 1);
    printer.println(`TOTAL: ${parseFloat(invoice.total).toFixed(2)} EUR`);
    printer.setTextNormal();
    printer.bold(false);

    printer.alignLeft();
    printer.drawLine();

    // Payment info
    if (invoice.payments && invoice.payments.length > 0) {
      printer.println('PAGOS:');
      for (const payment of invoice.payments) {
        const method = payment.method || 'efectivo';
        const amount = parseFloat(payment.amount).toFixed(2);
        printer.println(`  ${method}: ${amount} EUR`);
      }
      printer.drawLine();
    }

    // Footer
    printer.alignCenter();
    printer.println('Gracias por su visita');

    // VeriFactu QR if available
    if (invoice.verifactuQrData) {
      printer.newLine();
      printer.printQR(invoice.verifactuQrData, { cellSize: 4 });
    }

    printer.newLine();
    printer.newLine();
    printer.cut();

    // Open cash drawer if requested
    if (openDrawer) {
      printer.openCashDrawer();
    }

    await printer.execute();
    printer.clear();

    console.log('Receipt printed for invoice:', invoice.number || invoice.id);
    res.json({ success: true, message: 'Receipt printed' });
  } catch (error) {
    console.error('Error printing receipt:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Print simple text (for testing)
app.post('/print/test', verifyApiKey, async (req, res) => {
  try {
    if (!printer) {
      await initPrinter();
    }

    printer.alignCenter();
    printer.bold(true);
    printer.println('VetShelter Hardware Bridge');
    printer.bold(false);
    printer.println('Test de impresion');
    printer.println(new Date().toLocaleString('es-ES'));
    printer.drawLine();
    printer.println('Impresora configurada correctamente');
    printer.newLine();
    printer.cut();

    await printer.execute();
    printer.clear();

    res.json({ success: true, message: 'Test page printed' });
  } catch (error) {
    console.error('Error printing test:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// List available printers (Windows)
app.get('/printers', verifyApiKey, async (req, res) => {
  try {
    const { exec } = require('child_process');
    exec('wmic printer get name', (error, stdout) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      const printers = stdout.split('\n')
        .map(line => line.trim())
        .filter(line => line && line !== 'Name');
      res.json({ printers });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`VetShelter Hardware Bridge running on port ${PORT}`);
  console.log(`API Key: ${API_KEY}`);

  // Try to initialize printer on startup
  await initPrinter();
});

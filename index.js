const express = require('express');
const cors = require('cors');
const escpos = require('escpos');
escpos.USB = require('escpos-usb');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3456;
const API_KEY = process.env.API_KEY || 'vetshelter-hardware-2024';

// Find USB printer
function findPrinter() {
  try {
    const device = new escpos.USB();
    return device;
  } catch (error) {
    console.error('No USB printer found:', error.message);
    return null;
  }
}

// List all USB devices (for debugging)
function listUSBDevices() {
  try {
    const devices = escpos.USB.findPrinter();
    return devices || [];
  } catch (error) {
    return [];
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
  const devices = listUSBDevices();
  res.json({
    status: 'ok',
    service: 'vetshelter-hardware-bridge',
    usbDevicesFound: devices.length,
    printerReady: devices.length > 0
  });
});

// List USB printers
app.get('/printers', verifyApiKey, (req, res) => {
  try {
    const devices = listUSBDevices();
    res.json({
      printers: devices.map((d, i) => ({
        index: i,
        vendorId: d.deviceDescriptor?.idVendor,
        productId: d.deviceDescriptor?.idProduct
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Open cash drawer
app.post('/drawer/open', verifyApiKey, async (req, res) => {
  try {
    const device = findPrinter();
    if (!device) {
      return res.status(503).json({ success: false, error: 'No se encontró impresora USB' });
    }

    const printer = new escpos.Printer(device);

    device.open((err) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }

      // ESC/POS command to open cash drawer
      // Most drawers: ESC p 0 25 250 (pin 2) or ESC p 1 25 250 (pin 5)
      printer
        .cashdraw(2)  // Pin 2 (most common)
        .close(() => {
          console.log('Cash drawer opened');
          res.json({ success: true, message: 'Cajón abierto' });
        });
    });
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

    const device = findPrinter();
    if (!device) {
      return res.status(503).json({ success: false, error: 'No se encontró impresora USB' });
    }

    const printer = new escpos.Printer(device);

    device.open((err) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }

      // Build receipt
      printer
        .align('ct')
        .style('b')
        .size(1, 1)
        .text(clinic?.name || 'VetShelter')
        .style('normal')
        .size(1, 1);

      if (clinic?.address) {
        printer.text(clinic.address);
      }
      if (clinic?.phone) {
        printer.text(`Tel: ${clinic.phone}`);
      }
      if (clinic?.cif) {
        printer.text(`CIF: ${clinic.cif}`);
      }

      printer
        .drawLine()
        .align('lt')
        .style('b')
        .text(`FACTURA: ${invoice.number || invoice.id}`)
        .style('normal')
        .text(`Fecha: ${new Date(invoice.issueDate || invoice.createdAt).toLocaleDateString('es-ES')}`);

      if (invoice.customer) {
        printer.text(`Cliente: ${invoice.customer.name}`);
        if (invoice.customer.nif) {
          printer.text(`NIF: ${invoice.customer.nif}`);
        }
      }

      printer.drawLine();

      // Invoice lines
      if (invoice.lines && invoice.lines.length > 0) {
        for (const line of invoice.lines) {
          const description = (line.description || line.concept || 'Item').substring(0, 32);
          const qty = line.quantity || 1;
          const price = parseFloat(line.unitPrice || line.price || 0);
          const total = (qty * price).toFixed(2);

          printer
            .text(description)
            .text(`  ${qty} x ${price.toFixed(2)} = ${total} EUR`);
        }
      }

      printer.drawLine();

      // Totals
      printer.align('rt');

      if (invoice.subtotal) {
        printer.text(`Subtotal: ${parseFloat(invoice.subtotal).toFixed(2)} EUR`);
      }
      if (invoice.totalVat) {
        printer.text(`IVA: ${parseFloat(invoice.totalVat).toFixed(2)} EUR`);
      }
      if (invoice.discountAmount && parseFloat(invoice.discountAmount) > 0) {
        printer.text(`Descuento: -${parseFloat(invoice.discountAmount).toFixed(2)} EUR`);
      }

      printer
        .style('b')
        .size(1, 1)
        .text(`TOTAL: ${parseFloat(invoice.total).toFixed(2)} EUR`)
        .style('normal')
        .size(1, 1);

      printer
        .align('lt')
        .drawLine();

      // Payment info
      if (invoice.payments && invoice.payments.length > 0) {
        printer.text('PAGOS:');
        for (const payment of invoice.payments) {
          const method = payment.method || 'efectivo';
          const amount = parseFloat(payment.amount).toFixed(2);
          printer.text(`  ${method}: ${amount} EUR`);
        }
        printer.drawLine();
      }

      // Footer
      printer
        .align('ct')
        .text('Gracias por su visita')
        .feed(2);

      // Open cash drawer if requested
      if (openDrawer) {
        printer.cashdraw(2);
      }

      printer
        .cut()
        .close(() => {
          console.log('Receipt printed for invoice:', invoice.number || invoice.id);
          res.json({ success: true, message: 'Ticket impreso' });
        });
    });
  } catch (error) {
    console.error('Error printing receipt:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Print test page
app.post('/print/test', verifyApiKey, async (req, res) => {
  try {
    const device = findPrinter();
    if (!device) {
      return res.status(503).json({ success: false, error: 'No se encontró impresora USB' });
    }

    const printer = new escpos.Printer(device);

    device.open((err) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }

      printer
        .align('ct')
        .style('b')
        .size(2, 2)
        .text('VetShelter')
        .size(1, 1)
        .style('normal')
        .text('Hardware Bridge')
        .drawLine()
        .text('Test de impresion OK')
        .text(new Date().toLocaleString('es-ES'))
        .drawLine()
        .text('Impresora configurada')
        .text('correctamente')
        .feed(2)
        .cut()
        .close(() => {
          console.log('Test page printed');
          res.json({ success: true, message: 'Página de prueba impresa' });
        });
    });
  } catch (error) {
    console.error('Error printing test:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log('============================================');
  console.log('  VetShelter Hardware Bridge');
  console.log('============================================');
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`API Key: ${API_KEY}`);
  console.log('');

  // Check for USB printers
  const devices = listUSBDevices();
  if (devices.length > 0) {
    console.log(`[OK] Impresora USB encontrada (${devices.length} dispositivo(s))`);
  } else {
    console.log('[!] No se encontró impresora USB');
    console.log('    Asegúrate de que la impresora está conectada y encendida');
  }
  console.log('');
  console.log('Endpoints:');
  console.log('  GET  /health        - Estado del servidor');
  console.log('  GET  /printers      - Lista impresoras USB');
  console.log('  POST /drawer/open   - Abrir cajón');
  console.log('  POST /print/receipt - Imprimir ticket');
  console.log('  POST /print/test    - Página de prueba');
  console.log('============================================');
});

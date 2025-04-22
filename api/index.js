import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions
} from '@azure/storage-blob';

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientPath = path.join(__dirname, '..', 'client');

app.use(cors());
app.use(express.json());
app.use(express.static(clientPath));

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
});

app.get('/:page', (req, res, next) => {
    const page = req.params.page;
    const filePath = path.join(clientPath, `${page}.html`);
    
    // Check if file exists before sending
    res.sendFile(filePath, (err) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.status(404).sendFile(path.join(clientPath, '404.html'));
        } else {
          next(err);
        }
      }
    });
});

app.post('/api/get-sas-url', async (req, res) => {
    try {
      console.log('Received SAS URL request:', req.body);
      const { blobName } = req.body;
      
      if (!blobName) {
        console.log('Missing blobName in request');
        return res.status(400).json({ error: 'blobName is required' });
      }
  
      const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
      const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
      const containerName = process.env.AZURE_CONTAINER_NAME;
  
      if (!accountName || !accountKey || !containerName) {
        throw new Error('Missing Azure Storage credentials');
      }
  
      const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
      const blobServiceClient = new BlobServiceClient(
        `https://${accountName}.blob.core.windows.net`,
        sharedKeyCredential
      );
      
      const containerClient = blobServiceClient.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  
      const expiresOn = new Date(new Date().valueOf() + 60 * 60 * 1000); // 1 hour
      const sasToken = generateBlobSASQueryParameters({
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse("cw"),
        expiresOn
      }, sharedKeyCredential).toString();

      console.log('Generated SAS URL successfully for blob:', blobName);
  
      res.setHeader('Content-Type', 'application/json');
      res.json({ sasUrl: `${blockBlobClient.url}?${sasToken}` });
    } catch (err) {
      console.error('SAS generation failed:', err);
      res.status(500).json({ 
        error: 'Error generating SAS URL',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
});

app.post('/delete-blob', async (req, res) => {
  const { blobName } = req.body;
  if (!blobName) {
    return res.status(400).json({ error: 'Missing blobName' });
  }

  try {
    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
    const containerName = process.env.AZURE_CONTAINER_NAME;

    const blobServiceClient = BlobServiceClient.fromConnectionString(
      `DefaultEndpointsProtocol=https;AccountName=${accountName};AccountKey=${accountKey};EndpointSuffix=core.windows.net`
    );
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.delete();
    res.status(200).json({ message: 'Blob deleted successfully' });
  } catch (error) {
    console.error('Error deleting blob:', error);
    res.status(500).json({ error: 'Failed to delete blob' });
  }
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
  console.log(`Serving static files from: ${clientPath}`);
});
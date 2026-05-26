const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());

// Proxy API requests to avoid CORS issues
app.get('/api/*', async (req, res) => {
    // req.params[0] contains everything matched by '*'
    const apiSubPath = req.params[0];
    const queryString = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const targetUrl = `https://www.sankavollerei.com/anime/${apiSubPath}${queryString}`;
    
    console.log(`[Proxy] Routing request to: ${targetUrl}`);
    
    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            }
        });
        
        const contentType = response.headers.get('content-type');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            res.json(data);
        } else {
            const text = await response.text();
            res.send(text);
        }
    } catch (error) {
        console.error('[Proxy Error]:', error.message);
        res.status(500).json({ status: 'error', message: 'Proxy failed to fetch from target API' });
    }
});

module.exports = app;

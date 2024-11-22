const express = require('express');
const axios = require('axios');
const app = express();

app.get('/trigger-ev', async (req, res) => {
    try {
        console.log((new Date()).toTimeString() + " : kur");
        res.send('EV Charger triggered!');
    } catch (error) {
        res.status(500).send('Error triggering EV charger: ' + error.message);
    }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
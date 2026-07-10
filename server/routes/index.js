var express = require('express');
var path = require('path');
var router = express.Router();

/* GET home page — serve the unified SPA when built, otherwise JSON health check */
router.get('/', function(req, res, next) {
  const indexPath = path.resolve(__dirname, '../../website/dist/index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.json({ success: true, message: 'Shipone API is running' });
    }
  });
});

module.exports = router;
